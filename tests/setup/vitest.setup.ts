import '@testing-library/jest-dom/vitest'
import { vi, beforeAll, afterAll, afterEach } from 'vitest'
import 'fake-indexeddb/auto'

// Use Node.js webcrypto which has better Buffer/ArrayBuffer handling
const { webcrypto } = await import('crypto')

// Override the global crypto with Node's webcrypto
// This ensures better compatibility with Node.js Buffer objects
Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  writable: true,
  configurable: true
})

// Also set window.crypto for jsdom compatibility
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'crypto', {
    value: webcrypto,
    writable: true,
    configurable: true
  })
}

// Mock TextEncoder/TextDecoder if needed
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = await import('util')
  Object.assign(globalThis, { TextEncoder, TextDecoder })
}

// Mock BroadcastChannel for tab sync tests
class MockBroadcastChannel {
  name: string
  onmessage: ((event: MessageEvent) => void) | null = null
  private static channels: Map<string, MockBroadcastChannel[]> = new Map()

  constructor(name: string) {
    this.name = name
    const channels = MockBroadcastChannel.channels.get(name) || []
    channels.push(this)
    MockBroadcastChannel.channels.set(name, channels)
  }

  postMessage(message: unknown) {
    const channels = MockBroadcastChannel.channels.get(this.name) || []
    channels.forEach(channel => {
      if (channel !== this && channel.onmessage) {
        channel.onmessage(new MessageEvent('message', { data: message }))
      }
    })
  }

  close() {
    const channels = MockBroadcastChannel.channels.get(this.name) || []
    const index = channels.indexOf(this)
    if (index > -1) {
      channels.splice(index, 1)
    }
  }

  static reset() {
    MockBroadcastChannel.channels.clear()
  }
}

if (typeof globalThis.BroadcastChannel === 'undefined') {
  Object.defineProperty(globalThis, 'BroadcastChannel', {
    value: MockBroadcastChannel,
    writable: true
  })
}

// Mock fetch for service tests
const originalFetch = globalThis.fetch
beforeAll(() => {
  // Keep original fetch but can be overridden in tests
})

afterEach(() => {
  vi.clearAllMocks()
  MockBroadcastChannel.reset()
})

afterAll(() => {
  vi.restoreAllMocks()
})

// Global test utilities
declare global {
  var testUtils: {
    generateTestMnemonic: () => string
    createMockVault: () => Record<string, unknown>
    waitFor: (ms: number) => Promise<void>
  }
}

globalThis.testUtils = {
  generateTestMnemonic: () =>
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  createMockVault: () => ({
    identity: {
      displayName: 'Test User',
      fullName: 'Test User',
      email: 'test@example.com',
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
  }),
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
}
