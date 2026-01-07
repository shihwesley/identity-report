/**
 * Unit tests for Identity module
 *
 * Tests BIP39 mnemonic generation/validation, Ed25519 key derivation,
 * DID creation, signing/verification, JWT operations, and access grants.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import {
  generateMnemonic,
  validateMnemonic,
  deriveKeysFromMnemonic,
  createDidFromPublicKey,
  createWalletIdentity,
  deriveEncryptionKey,
  signMessage,
  verifySignature,
  exportIdentity,
  importIdentity,
  signAccessGrant,
  deriveJwtSigningKey,
  createJwt,
  verifyJwt,
  KEY_DERIVATION_PATHS,
  WalletIdentity,
  WalletKeys,
  JwtKeyPair
} from '@/lib/vault/identity'
import { MNEMONICS, PASSWORDS } from '../../fixtures/test-vectors'

describe('Identity Module', () => {
  // ============================================================
  // BIP39 Mnemonic Tests
  // ============================================================
  describe('Mnemonic Generation', () => {
    it('should generate a valid 12-word mnemonic', () => {
      const mnemonic = generateMnemonic()
      const words = mnemonic.split(' ')

      expect(words).toHaveLength(12)
      expect(validateMnemonic(mnemonic)).toBe(true)
    })

    it('should generate unique mnemonics on each call', () => {
      const mnemonic1 = generateMnemonic()
      const mnemonic2 = generateMnemonic()
      const mnemonic3 = generateMnemonic()

      expect(mnemonic1).not.toBe(mnemonic2)
      expect(mnemonic2).not.toBe(mnemonic3)
      expect(mnemonic1).not.toBe(mnemonic3)
    })

    it('should generate mnemonics from BIP39 wordlist', () => {
      const mnemonic = generateMnemonic()
      const words = mnemonic.split(' ')

      // Each word should be lowercase and alphabetic
      words.forEach(word => {
        expect(word).toMatch(/^[a-z]+$/)
      })
    })
  })

  describe('Mnemonic Validation', () => {
    it('should validate standard 12-word mnemonic', () => {
      expect(validateMnemonic(MNEMONICS.standard)).toBe(true)
    })

    it('should validate alternative 12-word mnemonic', () => {
      expect(validateMnemonic(MNEMONICS.alternative)).toBe(true)
    })

    it('should validate 24-word extended mnemonic', () => {
      expect(validateMnemonic(MNEMONICS.extended)).toBe(true)
    })

    it('should reject invalid mnemonic with wrong word count', () => {
      const invalidMnemonic = 'abandon abandon abandon'
      expect(validateMnemonic(invalidMnemonic)).toBe(false)
    })

    it('should reject mnemonic with non-BIP39 words', () => {
      const invalidMnemonic = 'invalid words that are not in the bip39 wordlist at all whatsoever'
      expect(validateMnemonic(invalidMnemonic)).toBe(false)
    })

    it('should reject mnemonic with invalid checksum', () => {
      // Last word is wrong for the checksum
      const invalidChecksum = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon'
      expect(validateMnemonic(invalidChecksum)).toBe(false)
    })

    it('should reject empty mnemonic', () => {
      expect(validateMnemonic('')).toBe(false)
    })

    it('should reject mnemonic with extra whitespace', () => {
      const mnemonicWithExtraSpaces = 'abandon  abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      expect(validateMnemonic(mnemonicWithExtraSpaces)).toBe(false)
    })

    it('should handle mnemonic with leading/trailing whitespace', () => {
      // BIP39 library typically trims, but this tests edge behavior
      const trimmedMnemonic = MNEMONICS.standard
      expect(validateMnemonic(` ${trimmedMnemonic} `)).toBe(false)
    })
  })

  // ============================================================
  // Key Derivation Tests
  // ============================================================
  describe('Key Derivation from Mnemonic', () => {
    it('should derive keys deterministically from mnemonic', async () => {
      const keys1 = await deriveKeysFromMnemonic(MNEMONICS.standard)
      const keys2 = await deriveKeysFromMnemonic(MNEMONICS.standard)

      expect(keys1.privateKey).toBeInstanceOf(Uint8Array)
      expect(keys1.publicKey).toBeInstanceOf(Uint8Array)
      expect(keys1.privateKey).toEqual(keys2.privateKey)
      expect(keys1.publicKey).toEqual(keys2.publicKey)
    })

    it('should derive Ed25519 keys with correct lengths', async () => {
      const keys = await deriveKeysFromMnemonic(MNEMONICS.standard)

      // Ed25519 private key is 32 bytes
      expect(keys.privateKey).toHaveLength(32)
      // Ed25519 public key is 32 bytes
      expect(keys.publicKey).toHaveLength(32)
    })

    it('should derive different keys from different mnemonics', async () => {
      const keys1 = await deriveKeysFromMnemonic(MNEMONICS.standard)
      const keys2 = await deriveKeysFromMnemonic(MNEMONICS.alternative)

      expect(keys1.privateKey).not.toEqual(keys2.privateKey)
      expect(keys1.publicKey).not.toEqual(keys2.publicKey)
    })

    it('should derive different keys from 24-word mnemonic', async () => {
      const keys12 = await deriveKeysFromMnemonic(MNEMONICS.standard)
      const keys24 = await deriveKeysFromMnemonic(MNEMONICS.extended)

      expect(keys12.privateKey).not.toEqual(keys24.privateKey)
      expect(keys12.publicKey).not.toEqual(keys24.publicKey)
    })

    it('should throw error for invalid mnemonic', async () => {
      await expect(deriveKeysFromMnemonic('invalid mnemonic')).rejects.toThrow('Invalid mnemonic phrase')
    })

    it('should throw error for empty mnemonic', async () => {
      await expect(deriveKeysFromMnemonic('')).rejects.toThrow('Invalid mnemonic phrase')
    })
  })

  // ============================================================
  // DID Creation Tests
  // ============================================================
  describe('DID Creation', () => {
    it('should create DID in did:key format', async () => {
      const keys = await deriveKeysFromMnemonic(MNEMONICS.standard)
      const did = createDidFromPublicKey(keys.publicKey)

      expect(did).toMatch(/^did:key:z/)
    })

    it('should create deterministic DID from same public key', async () => {
      const keys = await deriveKeysFromMnemonic(MNEMONICS.standard)
      const did1 = createDidFromPublicKey(keys.publicKey)
      const did2 = createDidFromPublicKey(keys.publicKey)

      expect(did1).toBe(did2)
    })

    it('should create different DIDs from different public keys', async () => {
      const keys1 = await deriveKeysFromMnemonic(MNEMONICS.standard)
      const keys2 = await deriveKeysFromMnemonic(MNEMONICS.alternative)

      const did1 = createDidFromPublicKey(keys1.publicKey)
      const did2 = createDidFromPublicKey(keys2.publicKey)

      expect(did1).not.toBe(did2)
    })

    it('should include multicodec prefix for Ed25519', async () => {
      const keys = await deriveKeysFromMnemonic(MNEMONICS.standard)
      const did = createDidFromPublicKey(keys.publicKey)

      // did:key:z prefix followed by hex-encoded ed01 + public key
      // The 'z' indicates multibase encoding, ed01 is Ed25519 prefix
      expect(did).toMatch(/^did:key:zed01/)
    })

    it('should handle empty public key gracefully', () => {
      const emptyKey = new Uint8Array(0)
      const did = createDidFromPublicKey(emptyKey)

      // Should still produce valid format even if key is empty
      expect(did).toMatch(/^did:key:zed01$/)
    })
  })

  // ============================================================
  // Wallet Identity Tests
  // ============================================================
  describe('Wallet Identity Creation', () => {
    it('should create complete wallet identity from mnemonic', async () => {
      const { identity, keys } = await createWalletIdentity(MNEMONICS.standard)

      expect(identity).toHaveProperty('did')
      expect(identity).toHaveProperty('publicKey')
      expect(identity).toHaveProperty('createdAt')

      expect(identity.did).toMatch(/^did:key:z/)
      expect(typeof identity.publicKey).toBe('string')
      expect(typeof identity.createdAt).toBe('number')

      expect(keys.privateKey).toBeInstanceOf(Uint8Array)
      expect(keys.publicKey).toBeInstanceOf(Uint8Array)
    })

    it('should create deterministic identity from same mnemonic', async () => {
      const result1 = await createWalletIdentity(MNEMONICS.standard)
      const result2 = await createWalletIdentity(MNEMONICS.standard)

      expect(result1.identity.did).toBe(result2.identity.did)
      expect(result1.identity.publicKey).toBe(result2.identity.publicKey)
      expect(result1.keys.privateKey).toEqual(result2.keys.privateKey)
      expect(result1.keys.publicKey).toEqual(result2.keys.publicKey)

      // createdAt may differ as it uses Date.now()
      expect(result1.identity.createdAt).toBeLessThanOrEqual(result2.identity.createdAt)
    })

    it('should export public key as hex string', async () => {
      const { identity } = await createWalletIdentity(MNEMONICS.standard)

      // Hex string should be 64 characters (32 bytes * 2)
      expect(identity.publicKey).toHaveLength(64)
      expect(identity.publicKey).toMatch(/^[0-9a-f]+$/)
    })

    it('should throw for invalid mnemonic', async () => {
      await expect(createWalletIdentity('invalid')).rejects.toThrow('Invalid mnemonic phrase')
    })
  })

  // ============================================================
  // Encryption Key Derivation Tests
  // ============================================================
  describe('Encryption Key Derivation', () => {
    let keys: WalletKeys

    beforeAll(async () => {
      keys = await deriveKeysFromMnemonic(MNEMONICS.standard)
    })

    it('should derive AES-GCM encryption key from private key and password', async () => {
      const encryptionKey = await deriveEncryptionKey(keys.privateKey, PASSWORDS.simple)

      expect(encryptionKey).toBeDefined()
      expect(encryptionKey.algorithm.name).toBe('AES-GCM')
    })

    it('should derive key with correct length (256 bits)', async () => {
      const encryptionKey = await deriveEncryptionKey(keys.privateKey, PASSWORDS.simple)

      const algorithm = encryptionKey.algorithm as AesKeyAlgorithm
      expect(algorithm.length).toBe(256)
    })

    it('should derive deterministic key from same inputs', async () => {
      const key1 = await deriveEncryptionKey(keys.privateKey, PASSWORDS.simple)
      const key2 = await deriveEncryptionKey(keys.privateKey, PASSWORDS.simple)

      // Export keys to compare
      const exported1 = await crypto.subtle.exportKey('raw', key1)
      const exported2 = await crypto.subtle.exportKey('raw', key2)

      expect(new Uint8Array(exported1)).toEqual(new Uint8Array(exported2))
    })

    it('should derive different keys with different passwords', async () => {
      const key1 = await deriveEncryptionKey(keys.privateKey, PASSWORDS.simple)
      const key2 = await deriveEncryptionKey(keys.privateKey, PASSWORDS.complex)

      const exported1 = await crypto.subtle.exportKey('raw', key1)
      const exported2 = await crypto.subtle.exportKey('raw', key2)

      expect(new Uint8Array(exported1)).not.toEqual(new Uint8Array(exported2))
    })

    it('should derive different keys with different private keys', async () => {
      const keys2 = await deriveKeysFromMnemonic(MNEMONICS.alternative)

      const key1 = await deriveEncryptionKey(keys.privateKey, PASSWORDS.simple)
      const key2 = await deriveEncryptionKey(keys2.privateKey, PASSWORDS.simple)

      const exported1 = await crypto.subtle.exportKey('raw', key1)
      const exported2 = await crypto.subtle.exportKey('raw', key2)

      expect(new Uint8Array(exported1)).not.toEqual(new Uint8Array(exported2))
    })

    it('should support unicode passwords', async () => {
      const key = await deriveEncryptionKey(keys.privateKey, PASSWORDS.unicode)

      expect(key).toBeDefined()
      expect(key.algorithm.name).toBe('AES-GCM')
    })

    it('should support empty password', async () => {
      const key = await deriveEncryptionKey(keys.privateKey, '')

      expect(key).toBeDefined()
      expect(key.algorithm.name).toBe('AES-GCM')
    })

    it('should create key with encrypt/decrypt usages', async () => {
      const key = await deriveEncryptionKey(keys.privateKey, PASSWORDS.simple)

      expect(key.usages).toContain('encrypt')
      expect(key.usages).toContain('decrypt')
    })
  })

  // ============================================================
  // Signing and Verification Tests
  // ============================================================
  describe('Message Signing', () => {
    let keys: WalletKeys

    beforeAll(async () => {
      keys = await deriveKeysFromMnemonic(MNEMONICS.standard)
    })

    it('should sign a message with Ed25519', async () => {
      const message = 'Hello, World!'
      const signature = await signMessage(keys.privateKey, message)

      expect(typeof signature).toBe('string')
      // Ed25519 signature is 64 bytes = 128 hex chars
      expect(signature).toHaveLength(128)
      expect(signature).toMatch(/^[0-9a-f]+$/)
    })

    it('should produce deterministic signatures', async () => {
      const message = 'Test message'
      const sig1 = await signMessage(keys.privateKey, message)
      const sig2 = await signMessage(keys.privateKey, message)

      expect(sig1).toBe(sig2)
    })

    it('should produce different signatures for different messages', async () => {
      const sig1 = await signMessage(keys.privateKey, 'Message 1')
      const sig2 = await signMessage(keys.privateKey, 'Message 2')

      expect(sig1).not.toBe(sig2)
    })

    it('should sign empty message', async () => {
      const signature = await signMessage(keys.privateKey, '')

      expect(signature).toHaveLength(128)
    })

    it('should sign unicode message', async () => {
      const signature = await signMessage(keys.privateKey, 'Hello, World!')

      expect(signature).toHaveLength(128)
    })

    it('should sign long message', async () => {
      const longMessage = 'A'.repeat(10000)
      const signature = await signMessage(keys.privateKey, longMessage)

      expect(signature).toHaveLength(128)
    })
  })

  describe('Signature Verification', () => {
    let keys: WalletKeys

    beforeAll(async () => {
      keys = await deriveKeysFromMnemonic(MNEMONICS.standard)
    })

    it('should verify valid signature with Uint8Array public key', async () => {
      const message = 'Test message'
      const signature = await signMessage(keys.privateKey, message)

      const isValid = await verifySignature(keys.publicKey, message, signature)
      expect(isValid).toBe(true)
    })

    it('should verify valid signature with hex string public key', async () => {
      const message = 'Test message'
      const signature = await signMessage(keys.privateKey, message)
      const publicKeyHex = Array.from(keys.publicKey)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      const isValid = await verifySignature(publicKeyHex, message, signature)
      expect(isValid).toBe(true)
    })

    it('should reject signature with wrong message', async () => {
      const signature = await signMessage(keys.privateKey, 'Original message')

      const isValid = await verifySignature(keys.publicKey, 'Different message', signature)
      expect(isValid).toBe(false)
    })

    it('should reject signature with wrong public key', async () => {
      const message = 'Test message'
      const signature = await signMessage(keys.privateKey, message)

      const otherKeys = await deriveKeysFromMnemonic(MNEMONICS.alternative)
      const isValid = await verifySignature(otherKeys.publicKey, message, signature)
      expect(isValid).toBe(false)
    })

    it('should reject tampered signature', async () => {
      const message = 'Test message'
      const signature = await signMessage(keys.privateKey, message)

      // Tamper with signature by changing first character
      const tamperedSig = signature[0] === 'a' ? 'b' + signature.slice(1) : 'a' + signature.slice(1)

      const isValid = await verifySignature(keys.publicKey, message, tamperedSig)
      expect(isValid).toBe(false)
    })
  })

  // ============================================================
  // Identity Export/Import Tests
  // ============================================================
  describe('Identity Export/Import', () => {
    it('should export identity as JSON string', async () => {
      const { identity } = await createWalletIdentity(MNEMONICS.standard)
      const exported = exportIdentity(identity)

      expect(typeof exported).toBe('string')

      const parsed = JSON.parse(exported)
      expect(parsed.did).toBe(identity.did)
      expect(parsed.publicKey).toBe(identity.publicKey)
      expect(parsed.createdAt).toBe(identity.createdAt)
    })

    it('should import valid identity JSON', async () => {
      const { identity } = await createWalletIdentity(MNEMONICS.standard)
      const exported = exportIdentity(identity)

      const imported = importIdentity(exported)

      expect(imported.did).toBe(identity.did)
      expect(imported.publicKey).toBe(identity.publicKey)
      expect(imported.createdAt).toBe(identity.createdAt)
    })

    it('should throw on invalid JSON', () => {
      expect(() => importIdentity('not json')).toThrow()
    })

    it('should throw on missing did field', () => {
      const invalid = JSON.stringify({ publicKey: 'abc', createdAt: 123 })
      expect(() => importIdentity(invalid)).toThrow('Invalid identity format')
    })

    it('should throw on missing publicKey field', () => {
      const invalid = JSON.stringify({ did: 'did:key:z123', createdAt: 123 })
      expect(() => importIdentity(invalid)).toThrow('Invalid identity format')
    })

    it('should throw on missing createdAt field', () => {
      const invalid = JSON.stringify({ did: 'did:key:z123', publicKey: 'abc' })
      expect(() => importIdentity(invalid)).toThrow('Invalid identity format')
    })
  })

  // ============================================================
  // Access Grant Signing Tests
  // ============================================================
  describe('Access Grant Signing', () => {
    let keys: WalletKeys

    beforeAll(async () => {
      keys = await deriveKeysFromMnemonic(MNEMONICS.standard)
    })

    it('should sign access grant with all required fields', async () => {
      const grant = {
        id: 'grant_123',
        grantee: 'did:key:zSomeClient',
        permissions: ['read:identity', 'read:memories'] as ('read:identity' | 'write:all' | 'read:memories')[],
        expiresAt: Date.now() + 3600000
      }

      const signedGrant = await signAccessGrant(grant, keys.privateKey)

      expect(signedGrant.id).toBe(grant.id)
      expect(signedGrant.grantee).toBe(grant.grantee)
      expect(signedGrant.permissions).toEqual(grant.permissions)
      expect(signedGrant.expiresAt).toBe(grant.expiresAt)
      expect(signedGrant.signature).toBeDefined()
      expect(signedGrant.signature).toHaveLength(128) // Ed25519 signature
    })

    it('should produce deterministic grant signatures', async () => {
      const grant = {
        id: 'grant_123',
        grantee: 'did:key:zSomeClient',
        permissions: ['read:identity'] as ('read:identity')[],
        expiresAt: 1704067200000 // Fixed timestamp
      }

      const signed1 = await signAccessGrant(grant, keys.privateKey)
      const signed2 = await signAccessGrant(grant, keys.privateKey)

      expect(signed1.signature).toBe(signed2.signature)
    })

    it('should sort permissions before signing for consistency', async () => {
      const grant1 = {
        id: 'grant_123',
        grantee: 'did:key:zSomeClient',
        permissions: ['read:memories', 'read:identity'] as ('read:memories' | 'read:identity')[],
        expiresAt: 1704067200000
      }

      const grant2 = {
        id: 'grant_123',
        grantee: 'did:key:zSomeClient',
        permissions: ['read:identity', 'read:memories'] as ('read:identity' | 'read:memories')[],
        expiresAt: 1704067200000
      }

      const signed1 = await signAccessGrant(grant1, keys.privateKey)
      const signed2 = await signAccessGrant(grant2, keys.privateKey)

      // Should produce same signature regardless of permission order
      expect(signed1.signature).toBe(signed2.signature)
    })
  })

  // ============================================================
  // JWT Key Derivation Tests
  // ============================================================
  describe('JWT Key Derivation', () => {
    it('should derive JWT signing key pair from mnemonic', async () => {
      const jwtKeys = await deriveJwtSigningKey(MNEMONICS.standard)

      expect(jwtKeys.privateKey).toBeInstanceOf(Uint8Array)
      expect(jwtKeys.publicKey).toBeInstanceOf(Uint8Array)
      expect(typeof jwtKeys.publicKeyHex).toBe('string')
    })

    it('should derive deterministic JWT keys', async () => {
      const keys1 = await deriveJwtSigningKey(MNEMONICS.standard)
      const keys2 = await deriveJwtSigningKey(MNEMONICS.standard)

      expect(keys1.privateKey).toEqual(keys2.privateKey)
      expect(keys1.publicKey).toEqual(keys2.publicKey)
      expect(keys1.publicKeyHex).toBe(keys2.publicKeyHex)
    })

    it('should derive JWT keys different from main encryption keys', async () => {
      const mainKeys = await deriveKeysFromMnemonic(MNEMONICS.standard)
      const jwtKeys = await deriveJwtSigningKey(MNEMONICS.standard)

      // JWT keys should be isolated from main keys
      expect(jwtKeys.privateKey).not.toEqual(mainKeys.privateKey)
      expect(jwtKeys.publicKey).not.toEqual(mainKeys.publicKey)
    })

    it('should produce 32-byte Ed25519 keys', async () => {
      const jwtKeys = await deriveJwtSigningKey(MNEMONICS.standard)

      expect(jwtKeys.privateKey).toHaveLength(32)
      expect(jwtKeys.publicKey).toHaveLength(32)
      expect(jwtKeys.publicKeyHex).toHaveLength(64)
    })

    it('should throw for invalid mnemonic', async () => {
      await expect(deriveJwtSigningKey('invalid')).rejects.toThrow('Invalid mnemonic phrase')
    })
  })

  describe('KEY_DERIVATION_PATHS constants', () => {
    it('should have distinct paths for different purposes', () => {
      expect(KEY_DERIVATION_PATHS.ENCRYPTION).toBe(0)
      expect(KEY_DERIVATION_PATHS.JWT_SIGNING).toBe(1)
      expect(KEY_DERIVATION_PATHS.RECOVERY).toBe(2)

      // Ensure all paths are unique
      const paths = Object.values(KEY_DERIVATION_PATHS)
      const uniquePaths = new Set(paths)
      expect(uniquePaths.size).toBe(paths.length)
    })
  })

  // ============================================================
  // JWT Creation and Verification Tests
  // ============================================================
  describe('JWT Creation', () => {
    let jwtKeys: JwtKeyPair
    let did: string

    beforeAll(async () => {
      jwtKeys = await deriveJwtSigningKey(MNEMONICS.standard)
      const { identity } = await createWalletIdentity(MNEMONICS.standard)
      did = identity.did
    })

    it('should create valid JWT token', async () => {
      const token = await createJwt(
        {
          sub: did,
          exp: Math.floor(Date.now() / 1000) + 3600,
          client: 'test-client',
          scope: ['read:identity']
        },
        jwtKeys.privateKey
      )

      expect(typeof token).toBe('string')
      const parts = token.split('.')
      expect(parts).toHaveLength(3)
    })

    it('should include correct header', async () => {
      const token = await createJwt(
        {
          sub: did,
          exp: Math.floor(Date.now() / 1000) + 3600,
          client: 'test-client',
          scope: ['read:identity']
        },
        jwtKeys.privateKey
      )

      const [headerB64] = token.split('.')
      const header = JSON.parse(Buffer.from(headerB64, 'base64').toString())

      expect(header.alg).toBe('EdDSA')
      expect(header.typ).toBe('JWT')
    })

    it('should auto-generate iat and jti claims', async () => {
      const beforeCreate = Math.floor(Date.now() / 1000)

      const token = await createJwt(
        {
          sub: did,
          exp: Math.floor(Date.now() / 1000) + 3600,
          client: 'test-client',
          scope: ['read:identity']
        },
        jwtKeys.privateKey
      )

      const [, payloadB64] = token.split('.')
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString())

      expect(payload.iat).toBeGreaterThanOrEqual(beforeCreate)
      expect(payload.jti).toBeDefined()
      expect(typeof payload.jti).toBe('string')
    })
  })

  describe('JWT Verification', () => {
    let jwtKeys: JwtKeyPair
    let did: string

    beforeAll(async () => {
      jwtKeys = await deriveJwtSigningKey(MNEMONICS.standard)
      const { identity } = await createWalletIdentity(MNEMONICS.standard)
      did = identity.did
    })

    it('should verify valid token with Uint8Array public key', async () => {
      const token = await createJwt(
        {
          sub: did,
          exp: Math.floor(Date.now() / 1000) + 3600,
          client: 'test-client',
          scope: ['read:identity']
        },
        jwtKeys.privateKey
      )

      const payload = await verifyJwt(token, jwtKeys.publicKey)

      expect(payload.sub).toBe(did)
      expect(payload.client).toBe('test-client')
      expect(payload.scope).toContain('read:identity')
    })

    it('should verify valid token with hex string public key', async () => {
      const token = await createJwt(
        {
          sub: did,
          exp: Math.floor(Date.now() / 1000) + 3600,
          client: 'test-client',
          scope: ['read:identity']
        },
        jwtKeys.privateKey
      )

      const payload = await verifyJwt(token, jwtKeys.publicKeyHex)

      expect(payload.sub).toBe(did)
    })

    it('should reject expired token', async () => {
      const token = await createJwt(
        {
          sub: did,
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
          client: 'test-client',
          scope: ['read:identity']
        },
        jwtKeys.privateKey
      )

      await expect(verifyJwt(token, jwtKeys.publicKey)).rejects.toThrow('JWT has expired')
    })

    it('should reject token with invalid signature', async () => {
      const token = await createJwt(
        {
          sub: did,
          exp: Math.floor(Date.now() / 1000) + 3600,
          client: 'test-client',
          scope: ['read:identity']
        },
        jwtKeys.privateKey
      )

      // Use different key for verification
      const otherKeys = await deriveJwtSigningKey(MNEMONICS.alternative)
      await expect(verifyJwt(token, otherKeys.publicKey)).rejects.toThrow('Invalid JWT signature')
    })

    it('should reject malformed token (wrong number of parts)', async () => {
      await expect(verifyJwt('not.a.valid.jwt', jwtKeys.publicKey)).rejects.toThrow('Invalid JWT format')
      await expect(verifyJwt('onlyonepart', jwtKeys.publicKey)).rejects.toThrow('Invalid JWT format')
    })

    it('should reject token with unsupported algorithm', async () => {
      // Create a fake token with RS256 algorithm
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64')
      const payload = Buffer.from(JSON.stringify({ sub: did, exp: 9999999999 })).toString('base64')
      const fakeToken = `${header}.${payload}.fakesig`

      await expect(verifyJwt(fakeToken, jwtKeys.publicKey)).rejects.toThrow('Unsupported algorithm')
    })
  })
})
