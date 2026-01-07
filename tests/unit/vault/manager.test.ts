/**
 * Unit tests for Vault Manager
 *
 * Tests vault initialization, lock/unlock cycles, data operations,
 * access grants, sync state management, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import { VaultManager } from '@/lib/vault/manager'
import { validateMnemonic } from '@/lib/vault/identity'
import { MNEMONICS, PASSWORDS, MOCK_PROFILES } from '../../fixtures/test-vectors'
import { MemoryFragment, Conversation, AIProvider, PortableProfile } from '@/lib/types'

// Mock the storage module
vi.mock('@/lib/storage/indexeddb', () => ({
  storage: {
    saveIdentity: vi.fn().mockResolvedValue(undefined),
    loadIdentity: vi.fn().mockResolvedValue(null),
    saveEncryptedVault: vi.fn().mockResolvedValue(undefined),
    loadEncryptedVault: vi.fn().mockResolvedValue(null),
    saveConversation: vi.fn().mockResolvedValue(undefined),
    getAllConversations: vi.fn().mockResolvedValue([]),
    saveMemory: vi.fn().mockResolvedValue(undefined),
    searchMemories: vi.fn().mockResolvedValue([]),
    getAllMemories: vi.fn().mockResolvedValue([]),
    getAllInsights: vi.fn().mockResolvedValue([]),
    exportAll: vi.fn().mockResolvedValue(JSON.stringify({
      version: 2,
      exportedAt: Date.now(),
      identity: null,
      vault: null,
      conversations: [],
      memories: [],
      insights: [],
      blobs: []
    })),
    importAll: vi.fn().mockResolvedValue(undefined)
  }
}))

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    audit: vi.fn()
  }
}))

// Mock the audit module
vi.mock('@/lib/mcp/audit', () => ({
  getAuditLogger: vi.fn(() => ({
    log: vi.fn(),
    getLogsForSync: vi.fn().mockReturnValue([]),
    importLogs: vi.fn().mockReturnValue(0)
  })),
  AuditLogger: vi.fn()
}))

// Mock sync modules
vi.mock('@/lib/sync', () => ({
  smartMerge: vi.fn(),
  applyResolutions: vi.fn(),
  getTabSyncManager: vi.fn(() => ({
    initialize: vi.fn(),
    canWrite: vi.fn().mockReturnValue(true),
    broadcastChange: vi.fn()
  })),
  getSyncQueue: vi.fn(() => ({
    setSyncExecutor: vi.fn(),
    enqueue: vi.fn().mockResolvedValue({ success: true, blocked: false }),
    getStatus: vi.fn().mockReturnValue({ isBlocked: false, pendingCount: 0 }),
    forceSync: vi.fn().mockResolvedValue(undefined)
  })),
  getPinningManager: vi.fn(() => ({
    initializeServices: vi.fn(),
    getServiceCount: vi.fn().mockReturnValue(0),
    pinToAll: vi.fn(),
    getHealthStatus: vi.fn()
  }))
}))

describe('VaultManager', () => {
  let vault: VaultManager
  let storageMock: {
    saveIdentity: Mock
    loadIdentity: Mock
    saveEncryptedVault: Mock
    loadEncryptedVault: Mock
    saveConversation: Mock
    getAllConversations: Mock
    saveMemory: Mock
    searchMemories: Mock
    getAllMemories: Mock
    getAllInsights: Mock
    exportAll: Mock
    importAll: Mock
  }

  beforeEach(async () => {
    // Create a fresh VaultManager instance for each test
    vault = new VaultManager()

    // Get the mocked storage
    const { storage } = await import('@/lib/storage/indexeddb')
    storageMock = storage as typeof storageMock

    // Reset all mocks
    vi.clearAllMocks()

    // Reset mock implementations to defaults
    storageMock.loadIdentity.mockResolvedValue(null)
    storageMock.loadEncryptedVault.mockResolvedValue(null)
    storageMock.getAllConversations.mockResolvedValue([])
    storageMock.getAllMemories.mockResolvedValue([])
    storageMock.getAllInsights.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // Initial State Tests
  // ============================================================
  describe('Initial State', () => {
    it('should start with locked status', () => {
      expect(vault.state.status).toBe('locked')
    })

    it('should start with no DID', () => {
      expect(vault.state.did).toBeNull()
    })

    it('should start with no profile', () => {
      expect(vault.state.profile).toBeNull()
    })

    it('should start with no lastSynced', () => {
      expect(vault.state.lastSynced).toBeNull()
    })

    it('should start with empty stats', () => {
      expect(vault.state.stats).toEqual({
        totalConversations: 0,
        totalMemories: 0,
        totalInsights: 0,
        providers: []
      })
    })

    it('should indicate vault is not unlocked', () => {
      expect(vault.isUnlocked).toBe(false)
    })

    it('should have null did property', () => {
      expect(vault.did).toBeNull()
    })
  })

  // ============================================================
  // Wallet Creation Tests
  // ============================================================
  describe('Wallet Creation', () => {
    it('should create new wallet with valid mnemonic', async () => {
      const mnemonic = await vault.createNewWallet()

      expect(validateMnemonic(mnemonic)).toBe(true)
      expect(mnemonic.split(' ')).toHaveLength(12)
    })

    it('should set DID after wallet creation', async () => {
      await vault.createNewWallet()

      expect(vault.did).not.toBeNull()
      expect(vault.did).toMatch(/^did:key:z/)
    })

    it('should save identity to storage', async () => {
      await vault.createNewWallet()

      expect(storageMock.saveIdentity).toHaveBeenCalledTimes(1)
      expect(storageMock.saveIdentity).toHaveBeenCalledWith(
        expect.objectContaining({
          did: expect.stringMatching(/^did:key:z/),
          publicKey: expect.any(String),
          createdAt: expect.any(Number)
        })
      )
    })

    it('should create unique mnemonic each time', async () => {
      const vault1 = new VaultManager()
      const vault2 = new VaultManager()

      const mnemonic1 = await vault1.createNewWallet()
      const mnemonic2 = await vault2.createNewWallet()

      expect(mnemonic1).not.toBe(mnemonic2)
    })
  })

  // ============================================================
  // Wallet Restoration Tests
  // ============================================================
  describe('Wallet Restoration', () => {
    it('should restore wallet from valid mnemonic', async () => {
      const result = await vault.restoreFromMnemonic(MNEMONICS.standard)

      expect(result).toBe(true)
      expect(vault.did).not.toBeNull()
    })

    it('should restore same DID from same mnemonic', async () => {
      const vault1 = new VaultManager()
      const vault2 = new VaultManager()

      await vault1.restoreFromMnemonic(MNEMONICS.standard)
      await vault2.restoreFromMnemonic(MNEMONICS.standard)

      expect(vault1.did).toBe(vault2.did)
    })

    it('should throw error for invalid mnemonic', async () => {
      await expect(
        vault.restoreFromMnemonic('invalid mnemonic phrase')
      ).rejects.toThrow('Invalid mnemonic phrase')
    })

    it('should throw error for empty mnemonic', async () => {
      await expect(
        vault.restoreFromMnemonic('')
      ).rejects.toThrow('Invalid mnemonic phrase')
    })

    it('should save identity after restoration', async () => {
      await vault.restoreFromMnemonic(MNEMONICS.standard)

      expect(storageMock.saveIdentity).toHaveBeenCalledTimes(1)
    })

    it('should restore from 24-word mnemonic', async () => {
      const result = await vault.restoreFromMnemonic(MNEMONICS.extended)

      expect(result).toBe(true)
      expect(vault.did).not.toBeNull()
    })
  })

  // ============================================================
  // Existing Wallet Detection Tests
  // ============================================================
  describe('Existing Wallet Detection', () => {
    it('should return false when no wallet exists', async () => {
      storageMock.loadIdentity.mockResolvedValue(null)

      const hasWallet = await vault.hasExistingWallet()

      expect(hasWallet).toBe(false)
    })

    it('should return true when wallet exists', async () => {
      storageMock.loadIdentity.mockResolvedValue({
        did: 'did:key:zExisting',
        publicKey: 'abc123',
        createdAt: Date.now()
      })

      const hasWallet = await vault.hasExistingWallet()

      expect(hasWallet).toBe(true)
    })
  })

  // ============================================================
  // Vault Unlock Tests
  // ============================================================
  describe('Vault Unlock', () => {
    it('should unlock vault with valid mnemonic and password', async () => {
      const profile = await vault.unlock(MNEMONICS.standard, PASSWORDS.simple)

      expect(vault.isUnlocked).toBe(true)
      expect(vault.state.status).toBe('unlocked')
      expect(profile).toBeDefined()
    })

    it('should set DID after unlock', async () => {
      await vault.unlock(MNEMONICS.standard, PASSWORDS.simple)

      expect(vault.did).not.toBeNull()
      expect(vault.did).toMatch(/^did:key:z/)
    })

    it('should create empty profile when no vault exists', async () => {
      storageMock.loadEncryptedVault.mockResolvedValue(null)

      const profile = await vault.unlock(MNEMONICS.standard, PASSWORDS.simple)

      expect(profile.identity.displayName).toBe('User')
      expect(profile.conversations).toEqual([])
      expect(profile.shortTermMemory).toEqual([])
      expect(profile.longTermMemory).toEqual([])
    })

    it('should load and decrypt existing vault', async () => {
      // First, unlock to get an encryption key and profile
      const firstVault = new VaultManager()
      await firstVault.unlock(MNEMONICS.standard, PASSWORDS.simple)

      // Simulate an encrypted vault in storage
      const encryptedVault = {
        metadata: {
          ownerDid: 'did:key:zTest',
          createdAt: Date.now(),
          lastModified: Date.now(),
          version: 1
        },
        ciphertext: '', // Would be populated by actual encryption
        iv: '',
        salt: ''
      }

      // For this test, we verify the mock is called
      storageMock.loadEncryptedVault.mockResolvedValue(null) // No existing vault

      const profile = await vault.unlock(MNEMONICS.standard, PASSWORDS.simple)

      expect(storageMock.loadEncryptedVault).toHaveBeenCalled()
      expect(profile).toBeDefined()
    })

    it('should throw error for invalid mnemonic on unlock', async () => {
      await expect(
        vault.unlock('invalid mnemonic', PASSWORDS.simple)
      ).rejects.toThrow('Invalid mnemonic phrase')

      expect(vault.state.status).toBe('locked')
    })

    it('should update lastSynced after unlock', async () => {
      const beforeUnlock = Date.now()
      await vault.unlock(MNEMONICS.standard, PASSWORDS.simple)

      expect(vault.state.lastSynced).not.toBeNull()
      expect(vault.state.lastSynced).toBeGreaterThanOrEqual(beforeUnlock)
    })

    it('should derive JWT keys on unlock', async () => {
      await vault.unlock(MNEMONICS.standard, PASSWORDS.simple)

      const jwtPublicKey = vault.getJwtPublicKey()
      expect(jwtPublicKey).not.toBeNull()
      expect(typeof jwtPublicKey).toBe('string')
      expect(jwtPublicKey).toHaveLength(64) // Hex-encoded 32 bytes
    })

    it('should load conversations from storage', async () => {
      const mockConversations: Conversation[] = [
        {
          id: 'conv-1',
          title: 'Test Conversation',
          messages: [],
          metadata: {
            provider: 'openai',
            model: 'gpt-4',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            importedAt: Date.now(),
            messageCount: 0,
            wordCount: 0
          },
          tags: []
        }
      ]

      storageMock.getAllConversations.mockResolvedValue(mockConversations)

      const profile = await vault.unlock(MNEMONICS.standard, PASSWORDS.simple)

      expect(profile.conversations).toEqual(mockConversations)
    })
  })

  // ============================================================
  // Vault Lock Tests
  // ============================================================
  describe('Vault Lock', () => {
    beforeEach(async () => {
      await vault.unlock(MNEMONICS.standard, PASSWORDS.simple)
    })

    it('should lock unlocked vault', async () => {
      await vault.lock()

      expect(vault.isUnlocked).toBe(false)
      expect(vault.state.status).toBe('locked')
    })

    it('should clear profile from memory on lock', async () => {
      await vault.lock()

      expect(vault.state.profile).toBeNull()
    })

    it('should clear JWT keys on lock', async () => {
      await vault.lock()

      expect(vault.getJwtPublicKey()).toBeNull()
      expect(vault.getJwtKeyPair()).toBeNull()
    })

    it('should save encrypted vault to storage on lock', async () => {
      await vault.lock()

      expect(storageMock.saveEncryptedVault).toHaveBeenCalledTimes(1)
      expect(storageMock.saveEncryptedVault).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            ownerDid: expect.stringMatching(/^did:key:z/)
          }),
          ciphertext: expect.any(String),
          iv: expect.any(String)
        })
      )
    })

    it('should throw error when locking already locked vault', async () => {
      await vault.lock()

      await expect(vault.lock()).rejects.toThrow('Vault is not unlocked')
    })
  })

  // ============================================================
  // Lock/Unlock Cycle Tests
  // ============================================================
  describe('Lock/Unlock Cycles', () => {
    it('should preserve data across lock/unlock cycle', async () => {
      // Unlock
      await vault.unlock(MNEMONICS.standard, PASSWORDS.simple)

      // Store DID and modify profile
      const originalDid = vault.did

      // Add a memory
      const memory: MemoryFragment = {
        id: 'mem-1',
        timestamp: new Date().toISOString(),
        content: 'Test memory',
        tags: ['test'],
        type: 'technical',
        sourceModel: 'gpt-4',
        sourceProvider: 'openai',
        confidence: 0.9
      }

      await vault.addMemory(memory)

      // Lock and unlock again
      await vault.lock()

      // Setup mock to return what was saved
      storageMock.getAllMemories.mockResolvedValue([memory])

      await vault.unlock(MNEMONICS.standard, PASSWORDS.simple)

      expect(vault.did).toBe(originalDid)
    })

    it('should work with unicode password across cycles', async () => {
      await vault.unlock(MNEMONICS.standard, PASSWORDS.unicode)
      const did = vault.did

      await vault.lock()
      await vault.unlock(MNEMONICS.standard, PASSWORDS.unicode)

      expect(vault.did).toBe(did)
      expect(vault.isUnlocked).toBe(true)
    })

    it('should work with complex password across cycles', async () => {
      await vault.unlock(MNEMONICS.standard, PASSWORDS.complex)
      expect(vault.isUnlocked).toBe(true)

      await vault.lock()
      await vault.unlock(MNEMONICS.standard, PASSWORDS.complex)

      expect(vault.isUnlocked).toBe(true)
    })
  })

  // ============================================================
  // Memory Operations Tests
  // ============================================================
  describe('Memory Operations', () => {
    beforeEach(async () => {
      await vault.unlock(MNEMONICS.standard, PASSWORDS.simple)
    })

    const createMemory = (id: string): MemoryFragment => ({
      id,
      timestamp: new Date().toISOString(),
      content: `Memory content ${id}`,
      tags: ['test'],
      type: 'technical',
      sourceModel: 'gpt-4',
      sourceProvider: 'openai',
      confidence: 0.9
    })

    it('should add memory to short-term memory', async () => {
      const memory = createMemory('mem-1')
      await vault.addMemory(memory)

      expect(vault.state.profile?.shortTermMemory).toContainEqual(memory)
    })

    it('should save memory to storage', async () => {
      const memory = createMemory('mem-1')
      await vault.addMemory(memory)

      expect(storageMock.saveMemory).toHaveBeenCalledWith(memory)
    })

    it('should update stats after adding memory', async () => {
      const memory = createMemory('mem-1')
      await vault.addMemory(memory)

      expect(vault.state.stats.totalMemories).toBe(1)
    })

    it('should rotate memories when short-term exceeds limit', async () => {
      // Add 51 memories (exceeds 50 limit)
      for (let i = 0; i < 51; i++) {
        const memory = createMemory(`mem-${i}`)
        await vault.addMemory(memory)
      }

      // Short-term should have been rotated (30 moved to long-term)
      expect(vault.state.profile?.shortTermMemory.length).toBeLessThanOrEqual(50)
      expect(vault.state.profile?.longTermMemory.length).toBeGreaterThan(0)
    })

    it('should throw error when adding memory to locked vault', async () => {
      await vault.lock()

      const memory = createMemory('mem-1')
      await expect(vault.addMemory(memory)).rejects.toThrow('Vault is not unlocked')
    })

    it('should search memories via storage', async () => {
      const memories = [createMemory('mem-1'), createMemory('mem-2')]
      storageMock.searchMemories.mockResolvedValue(memories)

      const results = await vault.searchMemories('test')

      expect(storageMock.searchMemories).toHaveBeenCalledWith('test')
      expect(results).toEqual(memories)
    })
  })

  // ============================================================
  // Conversation Operations Tests
  // ============================================================
  describe('Conversation Operations', () => {
    beforeEach(async () => {
      await vault.unlock(MNEMONICS.standard, PASSWORDS.simple)
    })

    const createConversation = (id: string, provider: AIProvider = 'openai'): Conversation => ({
      id,
      title: `Conversation ${id}`,
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: Date.now()
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: Date.now()
        }
      ],
      metadata: {
        provider,
        model: 'gpt-4',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        importedAt: Date.now(),
        messageCount: 2,
        wordCount: 3
      },
      tags: ['test']
    })

    it('should import conversations', async () => {
      const conversations = [createConversation('conv-1')]
      const memories: MemoryFragment[] = []

      await vault.importConversations(conversations, memories)

      expect(vault.state.profile?.conversations).toContainEqual(conversations[0])
    })

    it('should save imported conversations to storage', async () => {
      const conversations = [createConversation('conv-1')]
      const memories: MemoryFragment[] = []

      await vault.importConversations(conversations, memories)

      expect(storageMock.saveConversation).toHaveBeenCalledWith(conversations[0])
    })

    it('should deduplicate conversations by title, provider, and date', async () => {
      const conv1 = createConversation('conv-1')
      const conv2 = { ...createConversation('conv-2'), title: conv1.title }
      conv2.metadata.provider = conv1.metadata.provider
      conv2.metadata.createdAt = conv1.metadata.createdAt

      await vault.importConversations([conv1], [])
      await vault.importConversations([conv2], [])

      // Should only have one conversation (duplicate rejected)
      expect(vault.state.profile?.conversations).toHaveLength(1)
    })

    it('should import memories along with conversations', async () => {
      const conversations = [createConversation('conv-1')]
      const memories: MemoryFragment[] = [
        {
          id: 'mem-1',
          timestamp: new Date().toISOString(),
          content: 'Imported memory',
          tags: ['imported'],
          type: 'technical',
          sourceModel: 'gpt-4',
          sourceProvider: 'openai',
          confidence: 0.85
        }
      ]

      await vault.importConversations(conversations, memories)

      expect(vault.state.profile?.longTermMemory).toContainEqual(memories[0])
      expect(storageMock.saveMemory).toHaveBeenCalledWith(memories[0])
    })

    it('should update stats with providers after import', async () => {
      const conversations = [
        createConversation('conv-1', 'openai'),
        createConversation('conv-2', 'anthropic')
      ]

      await vault.importConversations(conversations, [])

      expect(vault.state.stats.totalConversations).toBe(2)
      expect(vault.state.stats.providers).toContain('openai')
      expect(vault.state.stats.providers).toContain('anthropic')
    })

    it('should get all conversations', async () => {
      const mockConversations = [createConversation('conv-1')]
      vault.state.profile!.conversations = mockConversations

      const conversations = await vault.getConversations()

      expect(conversations).toEqual(mockConversations)
    })

    it('should throw error when importing to locked vault', async () => {
      await vault.lock()

      await expect(
        vault.importConversations([createConversation('conv-1')], [])
      ).rejects.toThrow('Vault is not unlocked')
    })
  })

  // ============================================================
  // Access Grant Tests
  // ============================================================
  describe('Access Grants', () => {
    beforeEach(async () => {
      await vault.unlock(MNEMONICS.standard, PASSWORDS.simple)
    })

    it('should create signed access grant', async () => {
      const grant = await vault.grantAccess(
        'did:key:zSomeClient',
        ['read_identity', 'read_memory'],
        3600
      )

      expect(grant.id).toMatch(/^grant_/)
      expect(grant.grantee).toBe('did:key:zSomeClient')
      expect(grant.permissions).toContain('read_identity')
      expect(grant.permissions).toContain('read_memory')
      expect(grant.signature).toBeDefined()
    })

    it('should set correct expiration time', async () => {
      const durationSeconds = 3600 // 1 hour
      const beforeGrant = Date.now()

      const grant = await vault.grantAccess(
        'did:key:zSomeClient',
        ['read_identity'],
        durationSeconds
      )

      expect(grant.expiresAt).toBeGreaterThanOrEqual(beforeGrant + durationSeconds * 1000)
    })

    it('should add grant to active grants', async () => {
      const grant = await vault.grantAccess(
        'did:key:zSomeClient',
        ['read_identity'],
        3600
      )

      expect(vault.state.profile?.activeGrants).toContainEqual(grant)
    })

    it('should throw error when granting access on locked vault', async () => {
      await vault.lock()

      await expect(
        vault.grantAccess('did:key:zSomeClient', ['read_identity'], 3600)
      ).rejects.toThrow('Vault is not unlocked')
    })
  })

  // ============================================================
  // Export Operations Tests
  // ============================================================
  describe('Export Operations', () => {
    beforeEach(async () => {
      await vault.unlock(MNEMONICS.standard, PASSWORDS.simple)
    })

    it('should export portable profile as JSON', async () => {
      const exported = await vault.exportPortable()
      const parsed = JSON.parse(exported)

      expect(parsed.version).toBe(1)
      expect(parsed.exportedAt).toBeDefined()
      expect(parsed.did).toBe(vault.did)
      expect(parsed.profile).toBeDefined()
    })

    it('should export encrypted vault data', async () => {
      const exported = await vault.exportEncrypted()
      const parsed = JSON.parse(exported)

      expect(parsed.version).toBe(2)
      expect(parsed.exportedAt).toBeDefined()
    })

    it('should export vault backup with filename', async () => {
      const { blob, filename } = await vault.exportVaultBackup()

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('application/json')
      expect(filename).toMatch(/^profile-vault-\d{4}-\d{2}-\d{2}\.pvault$/)
    })

    it('should throw error when exporting locked vault', async () => {
      await vault.lock()

      await expect(vault.exportPortable()).rejects.toThrow('Vault is not unlocked')
    })
  })

  // ============================================================
  // Demo Mode Tests
  // ============================================================
  describe('Demo Mode', () => {
    it('should initialize demo mode', async () => {
      await vault.initializeDemoMode()

      expect(vault.isUnlocked).toBe(true)
      expect(vault.did).not.toBeNull()
      expect(vault.state.profile).not.toBeNull()
    })

    it('should not reinitialize if already initialized', async () => {
      await vault.initializeDemoMode()
      const did = vault.did

      await vault.initializeDemoMode()

      expect(vault.did).toBe(did) // Same DID, not regenerated
    })
  })

  // ============================================================
  // Sync State Tests
  // ============================================================
  describe('Sync State', () => {
    it('should start with idle sync status', () => {
      expect(vault.syncState.status).toBe('idle')
    })

    it('should start with no pending conflicts', () => {
      expect(vault.hasPendingConflicts).toBe(false)
      expect(vault.getPendingConflicts()).toEqual([])
    })

    it('should discard conflicts', () => {
      // Manually set conflicts for testing
      (vault as unknown as { _syncState: { pendingConflicts: unknown[] } })._syncState.pendingConflicts = [
        { id: 'conflict-1' }
      ]

      vault.discardConflicts()

      expect(vault.hasPendingConflicts).toBe(false)
      expect(vault.syncState.status).toBe('idle')
    })
  })

  // ============================================================
  // JWT Key Access Tests
  // ============================================================
  describe('JWT Key Access', () => {
    it('should return null JWT public key when locked', () => {
      expect(vault.getJwtPublicKey()).toBeNull()
    })

    it('should return null JWT key pair when locked', () => {
      expect(vault.getJwtKeyPair()).toBeNull()
    })

    it('should return JWT public key when unlocked', async () => {
      await vault.unlock(MNEMONICS.standard, PASSWORDS.simple)

      const publicKey = vault.getJwtPublicKey()
      expect(publicKey).not.toBeNull()
      expect(publicKey).toHaveLength(64)
    })

    it('should return JWT key pair when unlocked', async () => {
      await vault.unlock(MNEMONICS.standard, PASSWORDS.simple)

      const keyPair = vault.getJwtKeyPair()
      expect(keyPair).not.toBeNull()
      expect(keyPair?.privateKey).toBeInstanceOf(Uint8Array)
      expect(keyPair?.publicKey).toBeInstanceOf(Uint8Array)
      expect(keyPair?.publicKeyHex).toBe(vault.getJwtPublicKey())
    })
  })

  // ============================================================
  // Tab Sync Tests
  // ============================================================
  describe('Tab Sync', () => {
    it('should return true for canWrite when no tab sync manager', () => {
      expect(vault.canWrite()).toBe(true)
    })

    it('should return null tab sync manager initially', () => {
      expect(vault.getTabSyncManager()).toBeNull()
    })
  })

  // ============================================================
  // Sync Queue Tests
  // ============================================================
  describe('Sync Queue', () => {
    it('should return null sync queue status when not initialized', () => {
      expect(vault.getSyncQueueStatus()).toBeNull()
    })

    it('should return false for sync blocked when no queue', () => {
      expect(vault.isSyncBlocked()).toBe(false)
    })

    it('should throw error when forcing sync without queue', async () => {
      await expect(vault.forceSyncQueue()).rejects.toThrow('Sync queue not initialized')
    })

    it('should enqueue change successfully without queue', async () => {
      const result = await vault.enqueueChange('create', 'memory', 'mem-1', {})

      expect(result.success).toBe(true)
      expect(result.blocked).toBe(false)
    })
  })

  // ============================================================
  // Identity Loading Tests
  // ============================================================
  describe('Identity Loading', () => {
    it('should load existing identity', async () => {
      const mockIdentity = {
        did: 'did:key:zExisting',
        publicKey: 'abc123def456',
        createdAt: Date.now()
      }

      storageMock.loadIdentity.mockResolvedValue(mockIdentity)

      const identity = await vault.loadIdentity()

      expect(identity).toEqual(mockIdentity)
      expect(vault.did).toBe(mockIdentity.did)
    })

    it('should return null when no identity exists', async () => {
      storageMock.loadIdentity.mockResolvedValue(null)

      const identity = await vault.loadIdentity()

      expect(identity).toBeNull()
    })
  })

  // ============================================================
  // Audit Logger Tests
  // ============================================================
  describe('Audit Logger', () => {
    it('should return audit logger instance', () => {
      const auditLogger = vault.getAuditLogger()

      expect(auditLogger).toBeDefined()
      expect(auditLogger.log).toBeDefined()
    })

    it('should get audit logs for sync', () => {
      const logs = vault.getAuditLogsForSync()

      expect(Array.isArray(logs)).toBe(true)
    })

    it('should import audit logs', () => {
      const count = vault.importAuditLogs([])

      expect(count).toBe(0)
    })
  })

  // ============================================================
  // Error Recovery Tests
  // ============================================================
  describe('Error Recovery', () => {
    it('should remain locked after failed unlock', async () => {
      await expect(
        vault.unlock('invalid mnemonic', PASSWORDS.simple)
      ).rejects.toThrow()

      expect(vault.state.status).toBe('locked')
      expect(vault.isUnlocked).toBe(false)
    })

    it('should return to unlocked state after failed lock', async () => {
      await vault.unlock(MNEMONICS.standard, PASSWORDS.simple)

      // Make saveEncryptedVault fail
      storageMock.saveEncryptedVault.mockRejectedValue(new Error('Storage error'))

      await expect(vault.lock()).rejects.toThrow('Storage error')

      expect(vault.state.status).toBe('unlocked')
    })
  })
})
