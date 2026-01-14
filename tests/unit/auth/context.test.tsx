// tests/unit/auth/context.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'

// Mock session module - assign vi.fn() directly to track calls
vi.mock('@/lib/auth/session', () => ({
  setVaultSession: vi.fn(),
  clearVaultSession: vi.fn(),
  hasVaultSession: vi.fn(),
}))

// Import mocked functions for configuration
import { setVaultSession, clearVaultSession, hasVaultSession } from '@/lib/auth/session'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
}))

// Import after mocks
import { AuthProvider, useAuth } from '@/lib/auth/context'

describe('context.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(hasVaultSession as ReturnType<typeof vi.fn>).mockReturnValue(false)
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  )

  describe('AuthProvider', () => {
    it('provides isLoading=true initially then false after mount', async () => {
      // Track loading states over time
      const loadingStates: boolean[] = []

      const { result } = renderHook(() => {
        const auth = useAuth()
        // Capture loading state on each render
        loadingStates.push(auth.isLoading)
        return auth
      }, { wrapper })

      // Wait for effect to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Verify initial state was true and final state is false
      expect(loadingStates[0]).toBe(true)
      expect(loadingStates[loadingStates.length - 1]).toBe(false)
    })

    it('checks existing session on mount via hasVaultSession()', async () => {
      renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(hasVaultSession).toHaveBeenCalled()
      })
    })

    it('sets isAuthenticated=true if session exists', async () => {
      ;(hasVaultSession as ReturnType<typeof vi.fn>).mockReturnValue(true)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('sets isAuthenticated=false if no session exists', async () => {
      ;(hasVaultSession as ReturnType<typeof vi.fn>).mockReturnValue(false)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false)
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('signIn', () => {
    it('sets authenticated state (isAuthenticated, authMethod, user)', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      const testUser = { did: 'did:key:test123', email: 'test@example.com' }

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      act(() => {
        result.current.signIn('email', testUser)
      })

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.authMethod).toBe('email')
      expect(result.current.user).toEqual(testUser)
    })

    it('calls setVaultSession()', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      const testUser = { did: 'did:key:test123' }

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      act(() => {
        result.current.signIn('wallet', testUser)
      })

      expect(setVaultSession).toHaveBeenCalledTimes(1)
    })

    it('supports wallet auth method', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      const testUser = { did: 'did:key:wallet123', walletAddress: '0x123...' }

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      act(() => {
        result.current.signIn('wallet', testUser)
      })

      expect(result.current.authMethod).toBe('wallet')
      expect(result.current.user?.walletAddress).toBe('0x123...')
    })

    it('supports mnemonic auth method', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      const testUser = { did: 'did:key:mnemonic123' }

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      act(() => {
        result.current.signIn('mnemonic', testUser)
      })

      expect(result.current.authMethod).toBe('mnemonic')
    })
  })

  describe('signOut', () => {
    it('clears state (isAuthenticated=false, user=null, authMethod=null)', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      const testUser = { did: 'did:key:test123', email: 'test@example.com' }

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // First sign in
      act(() => {
        result.current.signIn('email', testUser)
      })

      expect(result.current.isAuthenticated).toBe(true)

      // Then sign out
      act(() => {
        result.current.signOut()
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(result.current.authMethod).toBeNull()
    })

    it('calls clearVaultSession()', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      act(() => {
        result.current.signOut()
      })

      expect(clearVaultSession).toHaveBeenCalledTimes(1)
    })

    it('redirects to / via router.push', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      act(() => {
        result.current.signOut()
      })

      expect(mockPush).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  describe('useAuth', () => {
    it('throws error when used outside AuthProvider', () => {
      // Render without wrapper
      expect(() => {
        renderHook(() => useAuth())
      }).toThrow('useAuth must be used within an AuthProvider')
    })

    it('returns all auth state properties', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current).toHaveProperty('isAuthenticated')
      expect(result.current).toHaveProperty('isLoading')
      expect(result.current).toHaveProperty('authMethod')
      expect(result.current).toHaveProperty('user')
      expect(result.current).toHaveProperty('signIn')
      expect(result.current).toHaveProperty('signOut')
      expect(typeof result.current.signIn).toBe('function')
      expect(typeof result.current.signOut).toBe('function')
    })
  })
})
