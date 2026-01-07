/**
 * Vault Manager
 *
 * High-level manager for the user's Profile Vault.
 * Integrates identity, encryption, and storage systems.
 * Enhanced with audit log synchronization and JWT key derivation.
 */

import {
    PortableProfile,
    EncryptedProfile,
    VaultState,
    Conversation,
    MemoryFragment,
    UserInsight,
    AIProvider
} from '@/lib/types';
import {
    generateMnemonic,
    validateMnemonic,
    createWalletIdentity,
    deriveEncryptionKey,
    signAccessGrant,
    deriveJwtSigningKey,
    WalletIdentity,
    WalletKeys,
    JwtKeyPair
} from './identity';
import { encryptData, decryptData } from './crypto';
import { AccessGrant } from '@/lib/types';
import { storage } from '@/lib/storage/indexeddb';
import { logger } from '@/lib/logger';
import { AuditEntry, getAuditLogger, AuditLogger } from '@/lib/mcp/audit';
import {
    smartMerge,
    applyResolutions,
    Conflict,
    Resolution,
    MergeResult,
    SyncState,
    SyncStatus,
    getTabSyncManager,
    TabSyncManager,
    ConflictEntityType,
    getSyncQueue,
    SyncQueue,
    SyncQueueStatus,
    QueuedOperation,
    EnqueueResult,
    getPinningManager,
    PinningManager,
    ServiceCredentials
} from '@/lib/sync';

export class VaultManager {
    private keys: WalletKeys | null = null;
    private jwtKeys: JwtKeyPair | null = null;
    private encryptionKey: CryptoKey | null = null;
    private _state: VaultState;
    private auditLogger: AuditLogger;
    private _syncState: SyncState;
    private tabSyncManager: TabSyncManager | null = null;
    private baseProfile: PortableProfile | null = null;  // For three-way merge
    private deviceId: string;
    private syncQueue: SyncQueue | null = null;
    private pinningManager: PinningManager | null = null;
    private pinningCredentials: ServiceCredentials | null = null;

    constructor() {
        this.deviceId = this.getOrCreateDeviceId();
        this._state = {
            status: 'locked',
            did: null,
            profile: null,
            lastSynced: null,
            stats: {
                totalConversations: 0,
                totalMemories: 0,
                totalInsights: 0,
                providers: []
            }
        };
        this._syncState = {
            status: 'idle',
            lastSyncedAt: null,
            pendingConflicts: [],
            pendingResolutions: [],
            deviceId: this.deviceId
        };
        this.auditLogger = getAuditLogger();
    }

    /**
     * Get or create a persistent device ID.
     */
    private getOrCreateDeviceId(): string {
        if (typeof window === 'undefined') {
            return `server-${Date.now()}`;
        }
        let deviceId = localStorage.getItem('vault-device-id');
        if (!deviceId) {
            deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            localStorage.setItem('vault-device-id', deviceId);
        }
        return deviceId;
    }

    /**
     * Get the current sync state.
     */
    get syncState(): SyncState {
        return this._syncState;
    }

    /**
     * Check if there are pending conflicts.
     */
    get hasPendingConflicts(): boolean {
        return this._syncState.pendingConflicts.length > 0;
    }

    /**
     * Initialize tab sync manager.
     */
    initializeTabSync(): void {
        if (typeof window === 'undefined') return;

        this.tabSyncManager = getTabSyncManager({
            onConflict: (conflict) => {
                this._syncState.pendingConflicts.push(conflict);
                this._syncState.status = 'conflict';
            },
            onChange: (change) => {
                // Apply changes from other tabs
                this.applyRemoteChange(change);
            },
            onAuthorityChange: (hasAuthority) => {
                logger.info('Tab authority changed', { hasAuthority });
            }
        });
        this.tabSyncManager.initialize();
    }

    /**
     * Check if this tab has write authority.
     */
    canWrite(): boolean {
        if (!this.tabSyncManager) return true;
        return this.tabSyncManager.canWrite();
    }

    /**
     * Get the tab sync manager.
     */
    getTabSyncManager(): TabSyncManager | null {
        return this.tabSyncManager;
    }

    /**
     * Get the JWT public key for MCP authentication.
     * Returns null if vault is locked.
     */
    getJwtPublicKey(): string | null {
        return this.jwtKeys?.publicKeyHex ?? null;
    }

    /**
     * Get the JWT key pair for token generation.
     * Returns null if vault is locked.
     */
    getJwtKeyPair(): JwtKeyPair | null {
        return this.jwtKeys;
    }

    /**
     * Get the audit logger instance.
     */
    getAuditLogger(): AuditLogger {
        return this.auditLogger;
    }

    // ============================================================
    // Offline-First Sync Queue
    // ============================================================

    /**
     * Initialize the offline sync queue.
     * Must be called after vault is unlocked.
     */
    initializeSyncQueue(): void {
        if (typeof window === 'undefined') return;

        this.syncQueue = getSyncQueue();
        this.pinningManager = getPinningManager();

        // Set up the sync executor
        this.syncQueue.setSyncExecutor(async (operations) => {
            await this.executeSyncOperations(operations);
        });

        logger.info('Sync queue initialized');
    }

    /**
     * Configure pinning service credentials.
     */
    configurePinningServices(credentials: ServiceCredentials): void {
        this.pinningCredentials = credentials;
        if (this.pinningManager) {
            this.pinningManager.initializeServices(credentials);
            logger.info('Pinning services configured', {
                serviceCount: this.pinningManager.getServiceCount()
            });
        }
    }

    /**
     * Get the current sync queue status.
     */
    getSyncQueueStatus(): SyncQueueStatus | null {
        return this.syncQueue?.getStatus() ?? null;
    }

    /**
     * Check if sync queue is blocking new writes.
     */
    isSyncBlocked(): boolean {
        return this.syncQueue?.getStatus().isBlocked ?? false;
    }

    /**
     * Force an immediate sync attempt.
     */
    async forceSyncQueue(): Promise<void> {
        if (!this.syncQueue) {
            throw new Error('Sync queue not initialized');
        }
        await this.syncQueue.forceSync();
    }

    /**
     * Enqueue a profile change for offline-first sync.
     * Returns false if queue is blocked.
     */
    async enqueueChange(
        type: 'create' | 'update' | 'delete',
        entity: 'memory' | 'conversation' | 'profile' | 'preference' | 'project',
        entityId: string,
        payload?: unknown
    ): Promise<EnqueueResult> {
        if (!this.syncQueue) {
            // Sync queue not initialized - proceed without queueing
            return { success: true, blocked: false };
        }

        return this.syncQueue.enqueue({
            type,
            entity,
            entityId,
            payload
        });
    }

    /**
     * Execute sync operations (called by sync queue).
     * Pins to multiple IPFS services and updates registry.
     */
    private async executeSyncOperations(_operations: QueuedOperation[]): Promise<void> {
        if (!this._state.profile || !this._state.did) {
            throw new Error('Vault is not unlocked');
        }

        if (!this.pinningManager || this.pinningManager.getServiceCount() === 0) {
            throw new Error('Pinning services not configured');
        }

        // Export encrypted vault
        const { blob } = await this.exportVaultBackup();
        const data = JSON.parse(await blob.text());

        // Pin to multiple services (requires 2 of 3)
        const pinResult = await this.pinningManager.pinToAll(data);

        if (!pinResult.success || !pinResult.cid) {
            const failedServices = pinResult.results
                .filter(r => !r.success)
                .map(r => `${r.service}: ${r.error}`)
                .join(', ');
            throw new Error(`Pinning failed: ${failedServices}`);
        }

        // Update registry
        const { MockRegistryService } = await import('@/lib/services/registry');
        const registry = new MockRegistryService();
        await registry.updateProfile(this._state.did, pinResult.cid);

        // Update state
        this._state.lastSynced = Date.now();
        this._syncState.lastSyncedAt = Date.now();

        logger.info('Sync completed via queue', {
            cid: pinResult.cid,
            services: pinResult.results.filter(r => r.success).map(r => r.service)
        });

        logger.audit('Vault synced via offline queue', {
            cid: pinResult.cid,
            pinResults: pinResult.results.map(r => ({
                service: r.service,
                success: r.success,
                duration: r.durationMs
            }))
        });
    }

    /**
     * Get pinning service health status.
     */
    async getPinningHealthStatus(): Promise<Array<{ service: string; healthy: boolean }> | null> {
        if (!this.pinningManager) return null;
        return this.pinningManager.getHealthStatus();
    }

    /**
     * Initialize with valid keys for demo purposes so interaction works immediately.
     */
    async initializeDemoMode(): Promise<void> {
        if (this.keys) return; // Already initialized

        console.log('Initializing Vault Demo Mode...');
        const mnemonic = generateMnemonic();
        const { identity, keys } = await createWalletIdentity(mnemonic);
        this.keys = keys;
        this._state.did = identity.did;

        // Mock profile if needed, or keeping existing structure
        if (!this._state.profile) {
            this._state.profile = this.createEmptyProfile(identity.did);
        }

        this._state.status = 'unlocked';
    }

    get state(): VaultState {
        return this._state;
    }

    get isUnlocked(): boolean {
        return this._state.status === 'unlocked';
    }

    get did(): string | null {
        return this._state.did;
    }

    // --- Wallet Creation & Recovery ---

    /**
     * Create a new wallet with a fresh mnemonic.
     * Returns the mnemonic which user MUST save for recovery.
     */
    async createNewWallet(): Promise<string> {
        const mnemonic = generateMnemonic();
        const { identity, keys } = await createWalletIdentity(mnemonic);

        this.keys = keys;
        this._state.did = identity.did;

        // Save identity to storage
        await storage.saveIdentity(identity);

        return mnemonic;
    }

    /**
     * Restore wallet from mnemonic phrase.
     */
    async restoreFromMnemonic(mnemonic: string): Promise<boolean> {
        if (!validateMnemonic(mnemonic)) {
            throw new Error('Invalid mnemonic phrase');
        }

        const { identity, keys } = await createWalletIdentity(mnemonic);

        this.keys = keys;
        this._state.did = identity.did;

        // Save identity
        await storage.saveIdentity(identity);

        return true;
    }

    /**
     * Check if a wallet already exists.
     */
    async hasExistingWallet(): Promise<boolean> {
        const identity = await storage.loadIdentity();
        return identity !== null;
    }

    /**
     * Load existing wallet identity (without unlocking).
     */
    async loadIdentity(): Promise<WalletIdentity | null> {
        const identity = await storage.loadIdentity();
        if (identity) {
            this._state.did = identity.did;
        }
        return identity;
    }

    // --- Vault Lock/Unlock ---

    /**
     * Unlock the vault with password.
     * Password + mnemonic-derived key = full encryption key.
     * Also derives JWT signing keys for MCP authentication.
     */
    async unlock(mnemonic: string, password: string): Promise<PortableProfile> {
        if (!validateMnemonic(mnemonic)) {
            throw new Error('Invalid mnemonic phrase');
        }

        this._state.status = 'syncing';

        try {
            // Derive keys from mnemonic
            const { identity, keys } = await createWalletIdentity(mnemonic);
            this.keys = keys;
            this._state.did = identity.did;

            // Derive JWT signing keys (separate derivation path)
            this.jwtKeys = await deriveJwtSigningKey(mnemonic);
            logger.info('JWT signing keys derived');

            // Derive encryption key from private key + password
            this.encryptionKey = await deriveEncryptionKey(keys.privateKey, password);

            // Try to load and decrypt existing vault
            const encryptedVault = await storage.loadEncryptedVault();

            if (encryptedVault) {
                // Decrypt existing profile
                const decryptedJson = await decryptData(
                    encryptedVault.ciphertext,
                    encryptedVault.iv,
                    this.encryptionKey
                );
                this._state.profile = JSON.parse(decryptedJson);
            } else {
                // Create new empty profile
                this._state.profile = this.createEmptyProfile(identity.did);
            }

            // Load additional data from storage
            await this.loadFromStorage();

            this._state.status = 'unlocked';
            this._state.lastSynced = Date.now();
            this.updateStats();

            logger.info('Vault unlocked successfully', { did: identity.did });
            logger.audit('Vault unlocked', { did: identity.did });

            return this._state.profile!;
        } catch (error) {
            this._state.status = 'locked';
            throw error;
        }
    }

    /**
     * Lock the vault (encrypt and save).
     */
    async lock(): Promise<void> {
        if (!this.encryptionKey || !this._state.profile) {
            throw new Error('Vault is not unlocked');
        }

        this._state.status = 'syncing';

        try {
            // Encrypt the profile
            const profileJson = JSON.stringify(this._state.profile);
            const { ciphertext, iv } = await encryptData(profileJson, this.encryptionKey);

            const encryptedProfile: EncryptedProfile = {
                metadata: {
                    ownerDid: this._state.did!,
                    createdAt: Date.now(),
                    lastModified: Date.now(),
                    version: 1
                },
                ciphertext,
                iv,
                salt: '' // Salt is derived from private key in our implementation
            };

            // Save to storage
            await storage.saveEncryptedVault(encryptedProfile);

            // Clear sensitive data from memory
            this.keys = null;
            this.jwtKeys = null;
            this.encryptionKey = null;
            this._state.profile = null;
            this._state.status = 'locked';

            logger.info('Vault locked successfully');
            logger.audit('Vault locked');
        } catch (error) {
            this._state.status = 'unlocked';
            throw error;
        }
    }

    // --- Data Operations ---

    /**
     * Import conversations from a provider.
     */
    async importConversations(conversations: Conversation[], memories: MemoryFragment[]): Promise<void> {
        if (!this._state.profile) {
            throw new Error('Vault is not unlocked');
        }

        // Add conversations
        for (const conv of conversations) {
            // Check for duplicates by title + provider + date
            const exists = this._state.profile.conversations.some(
                c => c.title === conv.title &&
                    c.metadata.provider === conv.metadata.provider &&
                    Math.abs(c.metadata.createdAt - conv.metadata.createdAt) < 60000
            );

            if (!exists) {
                this._state.profile.conversations.push(conv);
                await storage.saveConversation(conv);
            }
        }

        // Add memories
        for (const memory of memories) {
            this._state.profile.longTermMemory.push(memory);
            await storage.saveMemory(memory);
        }

        this.updateStats();
    }

    /**
     * Add a single memory fragment.
     */
    async addMemory(memory: MemoryFragment): Promise<void> {
        if (!this._state.profile) {
            throw new Error('Vault is not unlocked');
        }

        this._state.profile.shortTermMemory.push(memory);
        await storage.saveMemory(memory);

        // Rotate to long-term if needed
        if (this._state.profile.shortTermMemory.length > 50) {
            const toMove = this._state.profile.shortTermMemory.splice(0, 30);
            this._state.profile.longTermMemory.push(...toMove);
        }

        this.updateStats();
    }

    /**
     * Search memories.
     */
    async searchMemories(query: string): Promise<MemoryFragment[]> {
        return storage.searchMemories(query);
    }

    /**
     * Get all conversations.
     */
    async getConversations(): Promise<Conversation[]> {
        if (this._state.profile) {
            return this._state.profile.conversations;
        }
        return storage.getAllConversations();
    }

    /**
     * Export vault as portable JSON.
     */
    async exportPortable(): Promise<string> {
        if (!this._state.profile) {
            throw new Error('Vault is not unlocked');
        }

        return JSON.stringify({
            version: 1,
            exportedAt: new Date().toISOString(),
            did: this._state.did,
            profile: this._state.profile
        }, null, 2);
    }

    /**
     * Export encrypted vault for backup (legacy JSON string).
     */
    async exportEncrypted(): Promise<string> {
        return storage.exportAll();
    }

    /**
     * Export complete vault as downloadable .pvault file.
     * This is the main portable backup that can be taken anywhere.
     * The file is already encrypted - safe to store in cloud/email.
     * Includes audit logs for complete history preservation.
     */
    async exportVaultBackup(): Promise<{ blob: Blob; filename: string }> {
        const storageData = await storage.exportAll();

        // Parse storage data and add audit logs
        const exportData = JSON.parse(storageData);
        exportData.auditLogs = this.auditLogger.getLogsForSync();
        exportData.auditLogsExportedAt = Date.now();

        const data = JSON.stringify(exportData);
        const blob = new Blob([data], { type: 'application/json' });
        const date = new Date().toISOString().slice(0, 10);
        const filename = `profile-vault-${date}.pvault`;

        return { blob, filename };
    }

    /**
     * Trigger download of vault backup in browser.
     */
    async downloadVaultBackup(): Promise<void> {
        const { blob, filename } = await this.exportVaultBackup();

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Import vault from a .pvault backup file.
     * After import, user still needs to unlock with mnemonic + password.
     * Also imports audit logs if present.
     */
    async importVaultBackup(file: File): Promise<{
        success: boolean;
        stats: { conversations: number; memories: number; blobs: number; auditLogs: number }
    }> {
        const data = await file.text();

        try {
            const parsed = JSON.parse(data);

            // Validate it's a vault backup
            if (!parsed.version || !parsed.identity) {
                throw new Error('Invalid vault backup file');
            }

            // Import audit logs if present
            let auditLogsImported = 0;
            if (parsed.auditLogs && Array.isArray(parsed.auditLogs)) {
                auditLogsImported = this.auditLogger.importLogs(parsed.auditLogs);
                logger.info('Audit logs imported', { count: auditLogsImported });
            }

            // Remove audit logs from storage import (they're handled separately)
            const storageData = { ...parsed };
            delete storageData.auditLogs;
            delete storageData.auditLogsExportedAt;

            await storage.importAll(JSON.stringify(storageData));

            return {
                success: true,
                stats: {
                    conversations: parsed.conversations?.length || 0,
                    memories: parsed.memories?.length || 0,
                    blobs: parsed.blobs?.length || 0,
                    auditLogs: auditLogsImported
                }
            };
        } catch (e) {
            throw new Error(`Failed to import vault: ${(e as Error).message}`);
        }
    }

    // --- Cloud Sync (IPFS + Blockchain) ---

    /**
     * Sync the current vault to Decentralized Storage.
     * 1. Export encrypted vault (includes audit logs)
     * 2. Upload to IPFS (Pinata)
     * 3. Update DID Registry (Blockchain)
     */
    async syncToCloud(config: { pinataJwt: string }): Promise<{ cid: string; txHash: string }> {
        if (!this._state.profile || !this._state.did) {
            throw new Error('Vault is not unlocked or missing DID');
        }

        const { PinataService } = await import('@/lib/services/ipfs');
        const { MockRegistryService } = await import('@/lib/services/registry');

        const ipfs = new PinataService({ jwt: config.pinataJwt });
        const registry = new MockRegistryService(); // Using Mock for now

        // 1. Get Encrypted Blob (includes audit logs)
        const { blob, filename } = await this.exportVaultBackup();

        // 2. Upload to IPFS
        logger.info('Uploading vault to IPFS');
        const cid = await ipfs.upload(blob, filename);
        logger.info('Vault uploaded to IPFS', { cid });

        // 3. Update Registry
        logger.info('Updating Blockchain Registry');
        const txHash = await registry.updateProfile(this._state.did, cid);
        logger.info('Registry update complete', { txHash });
        logger.audit('Vault synced to cloud', { cid, txHash });

        this._state.lastSynced = Date.now();

        return { cid, txHash };
    }

    /**
     * Get audit logs for sync (encrypted with vault).
     */
    getAuditLogsForSync(): AuditEntry[] {
        return this.auditLogger.getLogsForSync();
    }

    /**
     * Import audit logs from sync.
     */
    importAuditLogs(logs: AuditEntry[]): number {
        return this.auditLogger.importLogs(logs);
    }

    // ============================================================
    // Smart Merge & Conflict Resolution
    // ============================================================

    /**
     * Sync with remote profile using smart merge.
     * Returns conflicts that need user resolution, or empty array if auto-merged.
     */
    async syncWithRemote(remoteProfile: PortableProfile): Promise<MergeResult> {
        if (!this._state.profile) {
            throw new Error('Vault is not unlocked');
        }

        this._syncState.status = 'syncing';

        try {
            // Perform smart merge
            const result = await smartMerge(
                this._state.profile,
                remoteProfile,
                this.baseProfile || undefined
            );

            if (result.conflicts.length > 0) {
                // Store conflicts for resolution
                this._syncState.pendingConflicts = result.conflicts;
                this._syncState.status = 'conflict';
                logger.info('Sync conflicts detected', {
                    count: result.conflicts.length,
                    autoMerged: result.autoResolved
                });
            } else {
                // Apply merged profile
                this._state.profile = result.merged;
                this.baseProfile = structuredClone(result.merged);
                this._syncState.status = 'idle';
                this._syncState.lastSyncedAt = Date.now();
                this._state.lastSynced = Date.now();
                this.updateStats();
                logger.info('Sync completed without conflicts', {
                    autoMerged: result.autoResolved
                });
            }

            logger.audit('Profile sync completed', {
                conflicts: result.conflicts.length,
                autoMerged: result.autoResolved,
                stats: result.stats
            });

            return result;
        } catch (error) {
            this._syncState.status = 'error';
            this._syncState.error = (error as Error).message;
            throw error;
        }
    }

    /**
     * Resolve pending conflicts with user-provided resolutions.
     */
    async resolveConflicts(resolutions: Resolution[]): Promise<void> {
        if (!this._state.profile) {
            throw new Error('Vault is not unlocked');
        }

        if (this._syncState.pendingConflicts.length === 0) {
            throw new Error('No pending conflicts to resolve');
        }

        // Build resolution map
        const resolutionMap = new Map<string, { choice: 'local' | 'remote' | 'custom'; customValue?: unknown }>();
        for (const r of resolutions) {
            resolutionMap.set(r.conflictId, {
                choice: r.choice,
                customValue: r.customValue
            });
        }

        // Apply resolutions
        this._state.profile = applyResolutions(
            this._state.profile,
            this._syncState.pendingConflicts,
            resolutionMap
        );

        // Clear conflicts and update state
        this._syncState.pendingConflicts = [];
        this._syncState.pendingResolutions = resolutions;
        this._syncState.status = 'idle';
        this._syncState.lastSyncedAt = Date.now();
        this._state.lastSynced = Date.now();

        // Update base profile for future merges
        this.baseProfile = structuredClone(this._state.profile);

        this.updateStats();

        logger.info('Conflicts resolved', { count: resolutions.length });
        logger.audit('Conflicts resolved', {
            resolutions: resolutions.map(r => ({
                conflictId: r.conflictId,
                choice: r.choice
            }))
        });
    }

    /**
     * Get pending conflicts.
     */
    getPendingConflicts(): Conflict[] {
        return this._syncState.pendingConflicts;
    }

    /**
     * Clear pending conflicts without resolution (discard remote changes).
     */
    discardConflicts(): void {
        this._syncState.pendingConflicts = [];
        this._syncState.status = 'idle';
        logger.info('Conflicts discarded');
    }

    /**
     * Apply a change from another tab or remote source.
     */
    private applyRemoteChange(change: {
        entityType: ConflictEntityType;
        entityId: string;
        operation: 'create' | 'update' | 'delete';
        data: unknown;
    }): void {
        if (!this._state.profile) return;

        switch (change.entityType) {
            case 'memory':
                this.applyMemoryChange(change);
                break;
            case 'conversation':
                this.applyConversationChange(change);
                break;
            case 'insight':
                this.applyInsightChange(change);
                break;
            // Add other entity types as needed
        }

        this.updateStats();
    }

    private applyMemoryChange(change: {
        entityId: string;
        operation: 'create' | 'update' | 'delete';
        data: unknown;
    }): void {
        if (!this._state.profile) return;

        const memory = change.data as MemoryFragment;
        const allMemories = [...this._state.profile.shortTermMemory, ...this._state.profile.longTermMemory];

        switch (change.operation) {
            case 'create':
                this._state.profile.shortTermMemory.push(memory);
                break;
            case 'update':
                const idx = allMemories.findIndex(m => m.id === change.entityId);
                if (idx >= 0) {
                    if (idx < this._state.profile.shortTermMemory.length) {
                        this._state.profile.shortTermMemory[idx] = memory;
                    } else {
                        const longIdx = idx - this._state.profile.shortTermMemory.length;
                        this._state.profile.longTermMemory[longIdx] = memory;
                    }
                }
                break;
            case 'delete':
                this._state.profile.shortTermMemory = this._state.profile.shortTermMemory.filter(m => m.id !== change.entityId);
                this._state.profile.longTermMemory = this._state.profile.longTermMemory.filter(m => m.id !== change.entityId);
                break;
        }
    }

    private applyConversationChange(change: {
        entityId: string;
        operation: 'create' | 'update' | 'delete';
        data: unknown;
    }): void {
        if (!this._state.profile) return;

        const conversation = change.data as Conversation;

        switch (change.operation) {
            case 'create':
                this._state.profile.conversations.push(conversation);
                break;
            case 'update':
                const idx = this._state.profile.conversations.findIndex(c => c.id === change.entityId);
                if (idx >= 0) {
                    this._state.profile.conversations[idx] = conversation;
                }
                break;
            case 'delete':
                this._state.profile.conversations = this._state.profile.conversations.filter(c => c.id !== change.entityId);
                break;
        }
    }

    private applyInsightChange(change: {
        entityId: string;
        operation: 'create' | 'update' | 'delete';
        data: unknown;
    }): void {
        if (!this._state.profile) return;

        const insight = change.data as UserInsight;

        switch (change.operation) {
            case 'create':
                this._state.profile.insights.push(insight);
                break;
            case 'update':
                const idx = this._state.profile.insights.findIndex(i => i.id === change.entityId);
                if (idx >= 0) {
                    this._state.profile.insights[idx] = insight;
                }
                break;
            case 'delete':
                this._state.profile.insights = this._state.profile.insights.filter(i => i.id !== change.entityId);
                break;
        }
    }

    /**
     * Broadcast a local change to other tabs.
     */
    broadcastChange(
        entityType: ConflictEntityType,
        entityId: string,
        operation: 'create' | 'update' | 'delete',
        data: unknown
    ): void {
        if (this.tabSyncManager) {
            this.tabSyncManager.broadcastChange(entityType, entityId, operation, data);
        }
    }

    /**
     * Restore vault from Decentralized Storage.
     */
    async restoreFromCloud(did: string): Promise<boolean> {
        const { MockRegistryService } = await import('@/lib/services/registry');
        const { PinataService } = await import('@/lib/services/ipfs');

        const registry = new MockRegistryService();
        const ipfs = new PinataService({}); // No auth needed for reading gateway usually

        // 1. Resolve DID to CID
        const cid = await registry.getProfileCid(did);
        if (!cid) {
            throw new Error('No profile found for this DID');
        }

        // 2. Download from IPFS
        const url = ipfs.getGatewayUrl(cid);
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error('Failed to fetch vault from IPFS');
        }

        // 3. Import
        const blob = await res.blob();
        const file = new File([blob], 'restored.pvault', { type: 'application/json' });

        const result = await this.importVaultBackup(file);
        return result.success;
    }

    // --- Access Control ---

    /**
     * Create a cryptographically signed access grant.
     */
    async grantAccess(grantee: string, permissions: AccessGrant['permissions'], durationSeconds: number): Promise<AccessGrant> {
        if (!this.keys || !this._state.profile) {
            throw new Error('Vault is not unlocked');
        }

        const grant: Omit<AccessGrant, 'signature'> = {
            id: `grant_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            grantee,
            permissions,
            expiresAt: Date.now() + (durationSeconds * 1000),
        };

        const signedGrant = await signAccessGrant(grant, this.keys.privateKey);

        // Persist the grant
        this._state.profile.activeGrants.push(signedGrant);

        logger.info('Access grant issued', { grantee, permissions });
        logger.audit('Access grant issued', { grantee, permissions, grantId: grant.id });

        // We need a way to save just the profile or grants part.
        // For now, we will rely on the fact that 'lock()' saves everything, 
        // OR we should add a specific save method. 
        // Given existing methods, 'lock()' is too heavy (locks it).
        // Let's assume we implement a specific save, or just keep in memory until lock/export for this demo.
        // Actually, storage.saveEncryptedVault saves the WHOLE profile encrypted.
        // We probably won't re-encrypt automatically on every grant for performance in this demo.
        // So in-memory update is fine until the user clicks "Lock" or "Export".

        return signedGrant;
    }

    // --- Private Methods ---

    private createEmptyProfile(did: string): PortableProfile {
        return {
            identity: {
                displayName: 'User',
                fullName: '',
                email: '',
                location: '',
                role: ''
            },
            preferences: [],
            shortTermMemory: [],
            longTermMemory: [],
            projects: [],
            conversations: [],
            insights: [],
            activeGrants: []
        };
    }

    private async loadFromStorage(): Promise<void> {
        if (!this._state.profile) return;

        // Load conversations from storage
        const conversations = await storage.getAllConversations();
        this._state.profile.conversations = conversations;

        // Load memories
        const memories = await storage.getAllMemories();
        // Distribute between short-term and long-term
        this._state.profile.shortTermMemory = memories.slice(-50);
        this._state.profile.longTermMemory = memories.slice(0, -50);

        // Load insights
        const insights = await storage.getAllInsights();
        this._state.profile.insights = insights;
    }

    private updateStats(): void {
        if (!this._state.profile) return;

        const providers = new Set<AIProvider>();
        for (const conv of this._state.profile.conversations) {
            if (conv.metadata.provider) {
                providers.add(conv.metadata.provider);
            }
        }

        this._state.stats = {
            totalConversations: this._state.profile.conversations.length,
            totalMemories: this._state.profile.shortTermMemory.length + this._state.profile.longTermMemory.length,
            totalInsights: this._state.profile.insights.length,
            providers: Array.from(providers)
        };
    }
}

// Singleton instance
export const vault = new VaultManager();
