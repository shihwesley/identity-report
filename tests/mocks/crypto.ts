import { vi } from 'vitest'

// Test vectors for deterministic testing
export const TEST_VECTORS = {
  // Standard BIP39 test mnemonic
  mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',

  // Expected DID from the test mnemonic (computed)
  expectedDid: 'did:key:z6Mk', // Prefix - full DID depends on implementation

  // Test password
  password: 'test-password-123!',

  // Salt for PBKDF2 (for deterministic testing)
  salt: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),

  // Test plaintext
  plaintext: 'Hello, World! This is a test message.',

  // Known encrypted output for verification (will be populated)
  knownCiphertext: null as Uint8Array | null
}

// Mock for testing without actual crypto operations (faster tests)
export const mockCrypto = {
  encrypt: vi.fn(async (plaintext: string) => {
    return Buffer.from(plaintext).toString('base64')
  }),

  decrypt: vi.fn(async (ciphertext: string) => {
    return Buffer.from(ciphertext, 'base64').toString()
  }),

  deriveKey: vi.fn(async () => {
    return new Uint8Array(32).fill(1) // Mock key
  }),

  generateMnemonic: vi.fn(() => TEST_VECTORS.mnemonic),

  validateMnemonic: vi.fn((mnemonic: string) => {
    // Basic validation
    const words = mnemonic.trim().split(/\s+/)
    return words.length === 12 || words.length === 24
  }),

  reset() {
    this.encrypt.mockClear()
    this.decrypt.mockClear()
    this.deriveKey.mockClear()
    this.generateMnemonic.mockClear()
    this.validateMnemonic.mockClear()
  }
}

// Helper to create deterministic random for testing
export function createDeterministicRandom(seed: number = 12345) {
  let state = seed

  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

// Helper for generating test keys
export async function generateTestKeyPair() {
  const { ed25519 } = await import('@noble/ed25519')

  // Use deterministic seed for testing
  const seed = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    seed[i] = i
  }

  const privateKey = seed
  const publicKey = await ed25519.getPublicKey(privateKey)

  return { privateKey, publicKey }
}
