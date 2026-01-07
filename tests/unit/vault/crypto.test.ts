/**
 * Unit tests for Crypto module
 *
 * Tests AES-256-GCM encryption/decryption, PBKDF2 key derivation,
 * blob encryption, and error handling for corrupted data.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import {
  generateKeyPair,
  derivedKeyFromPassword,
  encryptData,
  decryptData,
  signMessage,
  encryptBlob,
  decryptBlob,
  arrayBufferToObjectUrl,
  EncryptedBlob
} from '@/lib/vault/crypto'
import { VAULT_CONSTANTS, CRYPTO_CONSTANTS } from '@/lib/constants'
import { PASSWORDS } from '../../fixtures/test-vectors'

describe('Crypto Module', () => {
  // ============================================================
  // PBKDF2 Key Derivation Tests
  // ============================================================
  describe('Key Derivation from Password', () => {
    const testSalt = crypto.getRandomValues(new Uint8Array(16))

    it('should derive AES-GCM key from password and salt', async () => {
      const key = await derivedKeyFromPassword(PASSWORDS.simple, testSalt)

      expect(key).toBeDefined()
      expect(key.algorithm.name).toBe('AES-GCM')
    })

    it('should derive key with correct bit length', async () => {
      const key = await derivedKeyFromPassword(PASSWORDS.simple, testSalt)
      const algorithm = key.algorithm as AesKeyAlgorithm

      expect(algorithm.length).toBe(VAULT_CONSTANTS.AES_KEY_LENGTH)
    })

    it('should derive deterministic key from same password and salt', async () => {
      const key1 = await derivedKeyFromPassword(PASSWORDS.simple, testSalt)
      const key2 = await derivedKeyFromPassword(PASSWORDS.simple, testSalt)

      const exported1 = await crypto.subtle.exportKey('raw', key1)
      const exported2 = await crypto.subtle.exportKey('raw', key2)

      expect(new Uint8Array(exported1)).toEqual(new Uint8Array(exported2))
    })

    it('should derive different keys with different passwords', async () => {
      const key1 = await derivedKeyFromPassword(PASSWORDS.simple, testSalt)
      const key2 = await derivedKeyFromPassword(PASSWORDS.complex, testSalt)

      const exported1 = await crypto.subtle.exportKey('raw', key1)
      const exported2 = await crypto.subtle.exportKey('raw', key2)

      expect(new Uint8Array(exported1)).not.toEqual(new Uint8Array(exported2))
    })

    it('should derive different keys with different salts', async () => {
      const salt1 = crypto.getRandomValues(new Uint8Array(16))
      const salt2 = crypto.getRandomValues(new Uint8Array(16))

      const key1 = await derivedKeyFromPassword(PASSWORDS.simple, salt1)
      const key2 = await derivedKeyFromPassword(PASSWORDS.simple, salt2)

      const exported1 = await crypto.subtle.exportKey('raw', key1)
      const exported2 = await crypto.subtle.exportKey('raw', key2)

      expect(new Uint8Array(exported1)).not.toEqual(new Uint8Array(exported2))
    })

    it('should support unicode passwords', async () => {
      const key = await derivedKeyFromPassword(PASSWORDS.unicode, testSalt)

      expect(key).toBeDefined()
      expect(key.algorithm.name).toBe('AES-GCM')
    })

    it('should support empty password', async () => {
      const key = await derivedKeyFromPassword('', testSalt)

      expect(key).toBeDefined()
      expect(key.algorithm.name).toBe('AES-GCM')
    })

    it('should use configured PBKDF2 iteration count', async () => {
      // This is more of a documentation test - we verify the constant is reasonable
      expect(VAULT_CONSTANTS.PBKDF2_ITERATIONS).toBe(100000)
    })

    it('should create key with encrypt/decrypt usages', async () => {
      const key = await derivedKeyFromPassword(PASSWORDS.simple, testSalt)

      expect(key.usages).toContain('encrypt')
      expect(key.usages).toContain('decrypt')
    })

    it('should use SHA-256 hash algorithm', async () => {
      expect(CRYPTO_CONSTANTS.HASH_ALGORITHM).toBe('SHA-256')
    })
  })

  // ============================================================
  // Key Pair Generation Tests
  // ============================================================
  describe('Key Pair Generation', () => {
    it('should generate ECDSA key pair', async () => {
      const keyPair = await generateKeyPair()

      expect(keyPair).toHaveProperty('privateKey')
      expect(keyPair).toHaveProperty('publicKey')
    })

    it('should generate key pair with configured curve', async () => {
      const keyPair = await generateKeyPair()

      const privateAlg = keyPair.privateKey.algorithm as EcKeyAlgorithm
      const publicAlg = keyPair.publicKey.algorithm as EcKeyAlgorithm

      expect(privateAlg.namedCurve).toBe(CRYPTO_CONSTANTS.ECDSA_CURVE)
      expect(publicAlg.namedCurve).toBe(CRYPTO_CONSTANTS.ECDSA_CURVE)
    })

    it('should generate unique key pairs', async () => {
      const keyPair1 = await generateKeyPair()
      const keyPair2 = await generateKeyPair()

      const pub1 = await crypto.subtle.exportKey('spki', keyPair1.publicKey)
      const pub2 = await crypto.subtle.exportKey('spki', keyPair2.publicKey)

      expect(new Uint8Array(pub1)).not.toEqual(new Uint8Array(pub2))
    })

    it('should create extractable keys for backup', async () => {
      const keyPair = await generateKeyPair()

      expect(keyPair.privateKey.extractable).toBe(true)
      expect(keyPair.publicKey.extractable).toBe(true)
    })

    it('should create private key with sign usage', async () => {
      const keyPair = await generateKeyPair()

      expect(keyPair.privateKey.usages).toContain('sign')
    })

    it('should create public key with verify usage', async () => {
      const keyPair = await generateKeyPair()

      expect(keyPair.publicKey.usages).toContain('verify')
    })
  })

  // ============================================================
  // Data Encryption Tests
  // ============================================================
  describe('Data Encryption', () => {
    let encryptionKey: CryptoKey
    const testSalt = crypto.getRandomValues(new Uint8Array(16))

    beforeAll(async () => {
      encryptionKey = await derivedKeyFromPassword(PASSWORDS.simple, testSalt)
    })

    it('should encrypt string data', async () => {
      const plaintext = 'Hello, World!'
      const result = await encryptData(plaintext, encryptionKey)

      expect(result).toHaveProperty('ciphertext')
      expect(result).toHaveProperty('iv')
      expect(typeof result.ciphertext).toBe('string')
      expect(typeof result.iv).toBe('string')
    })

    it('should return base64-encoded ciphertext', async () => {
      const plaintext = 'Test data'
      const result = await encryptData(plaintext, encryptionKey)

      // Base64 should only contain these characters
      expect(result.ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/)
    })

    it('should return base64-encoded IV', async () => {
      const plaintext = 'Test data'
      const result = await encryptData(plaintext, encryptionKey)

      expect(result.iv).toMatch(/^[A-Za-z0-9+/=]+$/)
    })

    it('should use correct IV length', async () => {
      const plaintext = 'Test data'
      const result = await encryptData(plaintext, encryptionKey)

      const ivBytes = Buffer.from(result.iv, 'base64')
      expect(ivBytes).toHaveLength(VAULT_CONSTANTS.IV_LENGTH)
    })

    it('should produce different ciphertext for same plaintext (random IV)', async () => {
      const plaintext = 'Same message'

      const result1 = await encryptData(plaintext, encryptionKey)
      const result2 = await encryptData(plaintext, encryptionKey)

      // IVs should be different (random)
      expect(result1.iv).not.toBe(result2.iv)
      // Ciphertext should be different due to different IV
      expect(result1.ciphertext).not.toBe(result2.ciphertext)
    })

    it('should encrypt empty string', async () => {
      const result = await encryptData('', encryptionKey)

      expect(result.ciphertext).toBeDefined()
      expect(result.iv).toBeDefined()
    })

    it('should encrypt unicode text', async () => {
      const plaintext = 'Hello, World!'
      const result = await encryptData(plaintext, encryptionKey)

      expect(result.ciphertext).toBeDefined()
    })

    it('should encrypt large data', async () => {
      const plaintext = 'A'.repeat(100000)
      const result = await encryptData(plaintext, encryptionKey)

      expect(result.ciphertext).toBeDefined()
      // Ciphertext should be longer than plaintext (includes auth tag)
      expect(Buffer.from(result.ciphertext, 'base64').length).toBeGreaterThan(plaintext.length)
    })

    it('should encrypt JSON data', async () => {
      const data = JSON.stringify({ name: 'Alice', age: 30, nested: { value: true } })
      const result = await encryptData(data, encryptionKey)

      expect(result.ciphertext).toBeDefined()
    })
  })

  // ============================================================
  // Data Decryption Tests
  // ============================================================
  describe('Data Decryption', () => {
    let encryptionKey: CryptoKey
    const testSalt = crypto.getRandomValues(new Uint8Array(16))

    beforeAll(async () => {
      encryptionKey = await derivedKeyFromPassword(PASSWORDS.simple, testSalt)
    })

    it('should decrypt encrypted data correctly', async () => {
      const plaintext = 'Hello, World!'
      const encrypted = await encryptData(plaintext, encryptionKey)
      const decrypted = await decryptData(encrypted.ciphertext, encrypted.iv, encryptionKey)

      expect(decrypted).toBe(plaintext)
    })

    it('should decrypt empty string', async () => {
      const encrypted = await encryptData('', encryptionKey)
      const decrypted = await decryptData(encrypted.ciphertext, encrypted.iv, encryptionKey)

      expect(decrypted).toBe('')
    })

    it('should decrypt unicode text', async () => {
      const plaintext = 'Hello, World!'
      const encrypted = await encryptData(plaintext, encryptionKey)
      const decrypted = await decryptData(encrypted.ciphertext, encrypted.iv, encryptionKey)

      expect(decrypted).toBe(plaintext)
    })

    it('should decrypt large data', async () => {
      const plaintext = 'A'.repeat(100000)
      const encrypted = await encryptData(plaintext, encryptionKey)
      const decrypted = await decryptData(encrypted.ciphertext, encrypted.iv, encryptionKey)

      expect(decrypted).toBe(plaintext)
    })

    it('should decrypt JSON and preserve structure', async () => {
      const originalData = { name: 'Alice', age: 30, nested: { value: true } }
      const encrypted = await encryptData(JSON.stringify(originalData), encryptionKey)
      const decrypted = await decryptData(encrypted.ciphertext, encrypted.iv, encryptionKey)

      expect(JSON.parse(decrypted)).toEqual(originalData)
    })

    it('should throw error with wrong key', async () => {
      const plaintext = 'Secret message'
      const encrypted = await encryptData(plaintext, encryptionKey)

      const wrongKey = await derivedKeyFromPassword(PASSWORDS.complex, testSalt)

      await expect(
        decryptData(encrypted.ciphertext, encrypted.iv, wrongKey)
      ).rejects.toThrow('Decryption failed')
    })

    it('should throw error with tampered ciphertext', async () => {
      const plaintext = 'Secret message'
      const encrypted = await encryptData(plaintext, encryptionKey)

      // Tamper with ciphertext
      const tamperedCiphertext = Buffer.from(encrypted.ciphertext, 'base64')
      tamperedCiphertext[0] ^= 0xff
      const tampered = tamperedCiphertext.toString('base64')

      await expect(
        decryptData(tampered, encrypted.iv, encryptionKey)
      ).rejects.toThrow('Decryption failed')
    })

    it('should throw error with tampered IV', async () => {
      const plaintext = 'Secret message'
      const encrypted = await encryptData(plaintext, encryptionKey)

      // Tamper with IV
      const tamperedIv = Buffer.from(encrypted.iv, 'base64')
      tamperedIv[0] ^= 0xff
      const tampered = tamperedIv.toString('base64')

      await expect(
        decryptData(encrypted.ciphertext, tampered, encryptionKey)
      ).rejects.toThrow('Decryption failed')
    })

    it('should throw error with truncated ciphertext', async () => {
      const plaintext = 'Secret message'
      const encrypted = await encryptData(plaintext, encryptionKey)

      // Truncate ciphertext
      const truncated = encrypted.ciphertext.substring(0, encrypted.ciphertext.length / 2)

      await expect(
        decryptData(truncated, encrypted.iv, encryptionKey)
      ).rejects.toThrow('Decryption failed')
    })

    it('should throw error with invalid base64 ciphertext', async () => {
      const encrypted = await encryptData('test', encryptionKey)

      await expect(
        decryptData('not valid base64!!!', encrypted.iv, encryptionKey)
      ).rejects.toThrow()
    })
  })

  // ============================================================
  // Round-Trip Encryption Tests
  // ============================================================
  describe('Encryption Round-Trips', () => {
    it('should round-trip various data types', async () => {
      const testSalt = crypto.getRandomValues(new Uint8Array(16))
      const key = await derivedKeyFromPassword(PASSWORDS.simple, testSalt)

      const testCases = [
        'Simple string',
        '',
        'Unicode: Hello World!',
        'Special chars: !@#$%^&*()_+-=[]{}|;:\'",.<>?',
        'Newlines:\nLine 1\nLine 2\nLine 3',
        'Tabs:\tTabbed\tContent',
        JSON.stringify({ array: [1, 2, 3], nested: { deep: true } }),
        'A'.repeat(10000),
        '\u0000\u0001\u0002', // Control characters
        Buffer.from([0x00, 0xff, 0x80]).toString('binary')
      ]

      for (const original of testCases) {
        const encrypted = await encryptData(original, key)
        const decrypted = await decryptData(encrypted.ciphertext, encrypted.iv, key)
        expect(decrypted).toBe(original)
      }
    })

    it('should maintain data integrity across multiple operations', async () => {
      const testSalt = crypto.getRandomValues(new Uint8Array(16))
      const key = await derivedKeyFromPassword(PASSWORDS.simple, testSalt)
      const original = 'Data to encrypt multiple times'

      // Encrypt and decrypt multiple times
      let data = original
      for (let i = 0; i < 5; i++) {
        const encrypted = await encryptData(data, key)
        data = await decryptData(encrypted.ciphertext, encrypted.iv, key)
      }

      expect(data).toBe(original)
    })
  })

  // ============================================================
  // Message Signing Tests
  // ============================================================
  describe('Message Signing (ECDSA)', () => {
    let keyPair: CryptoKeyPair

    beforeAll(async () => {
      keyPair = await generateKeyPair()
    })

    it('should sign message and return base64 signature', async () => {
      const message = 'Test message to sign'
      const signature = await signMessage(keyPair.privateKey, message)

      expect(typeof signature).toBe('string')
      expect(signature).toMatch(/^[A-Za-z0-9+/=]+$/)
    })

    it('should produce different signatures for different messages', async () => {
      const sig1 = await signMessage(keyPair.privateKey, 'Message 1')
      const sig2 = await signMessage(keyPair.privateKey, 'Message 2')

      expect(sig1).not.toBe(sig2)
    })

    it('should sign empty message', async () => {
      const signature = await signMessage(keyPair.privateKey, '')

      expect(signature).toBeDefined()
      expect(signature.length).toBeGreaterThan(0)
    })

    it('should sign unicode message', async () => {
      const signature = await signMessage(keyPair.privateKey, 'Unicode test')

      expect(signature).toBeDefined()
    })

    it('should produce verifiable signature', async () => {
      const message = 'Test message'
      const signature = await signMessage(keyPair.privateKey, message)

      // Verify signature using Web Crypto
      const signatureBytes = Buffer.from(signature, 'base64')
      const messageBytes = new TextEncoder().encode(message)

      const isValid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: { name: CRYPTO_CONSTANTS.HASH_ALGORITHM } },
        keyPair.publicKey,
        signatureBytes,
        messageBytes
      )

      expect(isValid).toBe(true)
    })
  })

  // ============================================================
  // Blob Encryption Tests
  // ============================================================
  describe('Blob Encryption', () => {
    let encryptionKey: CryptoKey
    const testSalt = crypto.getRandomValues(new Uint8Array(16))

    beforeAll(async () => {
      encryptionKey = await derivedKeyFromPassword(PASSWORDS.simple, testSalt)
    })

    const createTestArrayBuffer = (size: number): ArrayBuffer => {
      const buffer = new ArrayBuffer(size)
      const view = new Uint8Array(buffer)
      for (let i = 0; i < size; i++) {
        view[i] = i % 256
      }
      return buffer
    }

    it('should encrypt ArrayBuffer data', async () => {
      const data = createTestArrayBuffer(1024)
      const metadata = {
        id: 'blob-1',
        type: 'file' as const,
        name: 'test.bin',
        mimeType: 'application/octet-stream'
      }

      const encrypted = await encryptBlob(data, encryptionKey, metadata)

      expect(encrypted.id).toBe(metadata.id)
      expect(encrypted.type).toBe(metadata.type)
      expect(encrypted.name).toBe(metadata.name)
      expect(encrypted.mimeType).toBe(metadata.mimeType)
      expect(encrypted.size).toBe(data.byteLength)
      expect(encrypted.encryptedData).toBeDefined()
      expect(encrypted.iv).toBeDefined()
    })

    it('should encrypt different blob types', async () => {
      const data = createTestArrayBuffer(100)
      const types: EncryptedBlob['type'][] = ['image', 'audio', 'file', 'video']

      for (const type of types) {
        const encrypted = await encryptBlob(data, encryptionKey, {
          id: `blob-${type}`,
          type,
          name: `test.${type}`,
          mimeType: `application/${type}`
        })

        expect(encrypted.type).toBe(type)
      }
    })

    it('should use random IV for each encryption', async () => {
      const data = createTestArrayBuffer(100)
      const metadata = {
        id: 'blob-1',
        type: 'file' as const,
        name: 'test.bin',
        mimeType: 'application/octet-stream'
      }

      const encrypted1 = await encryptBlob(data, encryptionKey, metadata)
      const encrypted2 = await encryptBlob(data, encryptionKey, metadata)

      expect(encrypted1.iv).not.toBe(encrypted2.iv)
      expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData)
    })

    it('should encrypt empty buffer', async () => {
      const data = new ArrayBuffer(0)
      const metadata = {
        id: 'empty-blob',
        type: 'file' as const,
        name: 'empty.bin',
        mimeType: 'application/octet-stream'
      }

      const encrypted = await encryptBlob(data, encryptionKey, metadata)

      expect(encrypted.size).toBe(0)
      expect(encrypted.encryptedData).toBeDefined()
    })

    it('should encrypt large blob', async () => {
      const data = createTestArrayBuffer(1024 * 1024) // 1MB
      const metadata = {
        id: 'large-blob',
        type: 'file' as const,
        name: 'large.bin',
        mimeType: 'application/octet-stream'
      }

      const encrypted = await encryptBlob(data, encryptionKey, metadata)

      expect(encrypted.size).toBe(data.byteLength)
    })
  })

  describe('Blob Decryption', () => {
    let encryptionKey: CryptoKey
    const testSalt = crypto.getRandomValues(new Uint8Array(16))

    beforeAll(async () => {
      encryptionKey = await derivedKeyFromPassword(PASSWORDS.simple, testSalt)
    })

    const createTestArrayBuffer = (size: number): ArrayBuffer => {
      const buffer = new ArrayBuffer(size)
      const view = new Uint8Array(buffer)
      for (let i = 0; i < size; i++) {
        view[i] = i % 256
      }
      return buffer
    }

    it('should decrypt blob back to original ArrayBuffer', async () => {
      const original = createTestArrayBuffer(1024)
      const metadata = {
        id: 'blob-1',
        type: 'file' as const,
        name: 'test.bin',
        mimeType: 'application/octet-stream'
      }

      const encrypted = await encryptBlob(original, encryptionKey, metadata)
      const decrypted = await decryptBlob(encrypted, encryptionKey)

      expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(original))
    })

    it('should decrypt empty blob', async () => {
      const original = new ArrayBuffer(0)
      const metadata = {
        id: 'empty-blob',
        type: 'file' as const,
        name: 'empty.bin',
        mimeType: 'application/octet-stream'
      }

      const encrypted = await encryptBlob(original, encryptionKey, metadata)
      const decrypted = await decryptBlob(encrypted, encryptionKey)

      expect(decrypted.byteLength).toBe(0)
    })

    it('should decrypt large blob', async () => {
      const original = createTestArrayBuffer(1024 * 100) // 100KB
      const metadata = {
        id: 'large-blob',
        type: 'file' as const,
        name: 'large.bin',
        mimeType: 'application/octet-stream'
      }

      const encrypted = await encryptBlob(original, encryptionKey, metadata)
      const decrypted = await decryptBlob(encrypted, encryptionKey)

      expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(original))
    })

    it('should throw error with wrong key', async () => {
      const original = createTestArrayBuffer(100)
      const metadata = {
        id: 'blob-1',
        type: 'file' as const,
        name: 'test.bin',
        mimeType: 'application/octet-stream'
      }

      const encrypted = await encryptBlob(original, encryptionKey, metadata)

      const wrongKey = await derivedKeyFromPassword(PASSWORDS.complex, testSalt)

      await expect(
        decryptBlob(encrypted, wrongKey)
      ).rejects.toThrow('Decryption failed')
    })

    it('should throw error with tampered data', async () => {
      const original = createTestArrayBuffer(100)
      const metadata = {
        id: 'blob-1',
        type: 'file' as const,
        name: 'test.bin',
        mimeType: 'application/octet-stream'
      }

      const encrypted = await encryptBlob(original, encryptionKey, metadata)

      // Tamper with encrypted data
      const tamperedData = Buffer.from(encrypted.encryptedData, 'base64')
      tamperedData[0] ^= 0xff
      encrypted.encryptedData = tamperedData.toString('base64')

      await expect(
        decryptBlob(encrypted, encryptionKey)
      ).rejects.toThrow('Decryption failed')
    })

    it('should include blob id in error message on failure', async () => {
      const original = createTestArrayBuffer(100)
      const metadata = {
        id: 'specific-blob-id',
        type: 'file' as const,
        name: 'test.bin',
        mimeType: 'application/octet-stream'
      }

      const encrypted = await encryptBlob(original, encryptionKey, metadata)
      const wrongKey = await derivedKeyFromPassword(PASSWORDS.complex, testSalt)

      await expect(decryptBlob(encrypted, wrongKey)).rejects.toThrow('specific-blob-id')
    })
  })

  // ============================================================
  // Blob Round-Trip Tests
  // ============================================================
  describe('Blob Encryption Round-Trips', () => {
    it('should round-trip image data', async () => {
      const testSalt = crypto.getRandomValues(new Uint8Array(16))
      const key = await derivedKeyFromPassword(PASSWORDS.simple, testSalt)

      // Simulate PNG header
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
      const imageData = pngHeader.buffer

      const encrypted = await encryptBlob(imageData, key, {
        id: 'test-image',
        type: 'image',
        name: 'test.png',
        mimeType: 'image/png'
      })

      const decrypted = await decryptBlob(encrypted, key)

      expect(new Uint8Array(decrypted)).toEqual(pngHeader)
    })

    it('should preserve binary integrity', async () => {
      const testSalt = crypto.getRandomValues(new Uint8Array(16))
      const key = await derivedKeyFromPassword(PASSWORDS.simple, testSalt)

      // Create buffer with all possible byte values
      const allBytes = new Uint8Array(256)
      for (let i = 0; i < 256; i++) {
        allBytes[i] = i
      }

      const encrypted = await encryptBlob(allBytes.buffer, key, {
        id: 'all-bytes',
        type: 'file',
        name: 'bytes.bin',
        mimeType: 'application/octet-stream'
      })

      const decrypted = await decryptBlob(encrypted, key)

      expect(new Uint8Array(decrypted)).toEqual(allBytes)
    })
  })

  // ============================================================
  // Configuration Constants Tests
  // ============================================================
  describe('Crypto Configuration', () => {
    it('should use AES-GCM for symmetric encryption', () => {
      expect(CRYPTO_CONSTANTS.SYMMETRIC_ALGORITHM).toBe('AES-GCM')
    })

    it('should use 256-bit AES keys', () => {
      expect(VAULT_CONSTANTS.AES_KEY_LENGTH).toBe(256)
    })

    it('should use 12-byte IV for AES-GCM', () => {
      // AES-GCM recommends 12-byte IV for optimal security
      expect(VAULT_CONSTANTS.IV_LENGTH).toBe(12)
    })

    it('should use 100000 PBKDF2 iterations', () => {
      // OWASP recommends at least 100,000 iterations for PBKDF2-SHA256
      expect(VAULT_CONSTANTS.PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(100000)
    })

    it('should use P-256 curve for ECDSA', () => {
      expect(CRYPTO_CONSTANTS.ECDSA_CURVE).toBe('P-256')
    })
  })
})
