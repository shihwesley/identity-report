import { vi } from 'vitest'

export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn()
}

export const mockSession = {
  user: {
    did: 'did:key:z6MkhaXgBZDvotDkL5scsqP84MCZ6aV7d86PRYWNrVd8NpY8',
    email: 'test@example.com',
    name: 'Test User',
    walletAddress: '0x1234567890123456789012345678901234567890'
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
}

export const mockAuthContext = (overrides = {}) => ({
  session: null,
  isLoading: false,
  isAuthenticated: false,
  user: null,
  signIn: vi.fn().mockResolvedValue({ ok: true }),
  signOut: vi.fn().mockResolvedValue(undefined),
  signUp: vi.fn().mockResolvedValue({ ok: true }),
  error: null,
  ...overrides
})

export const mockUser = {
  did: 'did:key:z6MkhaXgBZDvotDkL5scsqP84MCZ6aV7d86PRYWNrVd8NpY8',
  email: 'test@example.com',
  name: 'Test User',
  walletAddress: '0x1234567890123456789012345678901234567890',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

export const mockEthereum = {
  isMetaMask: true,
  request: vi.fn().mockResolvedValue(['0x1234567890123456789012345678901234567890']),
  on: vi.fn(),
  removeListener: vi.fn(),
  once: vi.fn(),
  off: vi.fn()
}

export const mockNextAuth = {
  getSession: vi.fn().mockResolvedValue(mockSession),
  getCsrfToken: vi.fn().mockResolvedValue('mock-csrf-token'),
  signIn: vi.fn().mockResolvedValue({ ok: true, error: null }),
  signOut: vi.fn().mockResolvedValue(undefined)
}

// Helper to create a mock session with custom data
export function createMockSession(overrides = {}) {
  return {
    ...mockSession,
    user: {
      ...mockSession.user,
      ...overrides
    }
  }
}

// Helper to create a mock user with custom data
export function createMockUser(overrides = {}) {
  return {
    ...mockUser,
    ...overrides
  }
}

// Helper to setup Ethereum provider mock globally
export function setupEthereumMock(mockFns = {}) {
  const ethereum = {
    ...mockEthereum,
    ...mockFns
  }

  Object.defineProperty(window, 'ethereum', {
    value: ethereum,
    writable: true,
    configurable: true
  })

  return ethereum
}

// Helper to reset all auth mocks
export function resetAuthMocks() {
  mockRouter.push.mockClear()
  mockRouter.replace.mockClear()
  mockRouter.back.mockClear()
  mockRouter.forward.mockClear()
  mockRouter.refresh.mockClear()
  mockRouter.prefetch.mockClear()

  mockEthereum.request.mockClear()
  mockEthereum.on.mockClear()
  mockEthereum.removeListener.mockClear()
  mockEthereum.once.mockClear()
  mockEthereum.off.mockClear()

  mockNextAuth.getSession.mockClear()
  mockNextAuth.getCsrfToken.mockClear()
  mockNextAuth.signIn.mockClear()
  mockNextAuth.signOut.mockClear()
}
