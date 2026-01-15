// tests/unit/auth/guards.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, render, screen, waitFor } from '@testing-library/react'

// Mock at module level with vi.fn() directly
vi.mock('@/lib/auth/context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

// Import after mocks
import { useRequireAuth, useRedirectIfAuth, withAuth } from '@/lib/auth/guards'
import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'

const mockPush = vi.fn()

describe('guards.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      back: vi.fn(),
    })
    ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      authMethod: null,
      user: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
    })
  })

  describe('useRequireAuth', () => {
    it('redirects to /signin when not authenticated and not loading', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      })

      renderHook(() => useRequireAuth())

      // Should redirect immediately in useEffect
      expect(mockPush).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith('/signin')
    })

    it('does not redirect while loading', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
      })

      renderHook(() => useRequireAuth())

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('does not redirect when authenticated', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      })

      renderHook(() => useRequireAuth())

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('uses custom redirect path when provided', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      })

      renderHook(() => useRequireAuth('/login'))

      expect(mockPush).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith('/login')
    })

    it('returns auth state', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      })

      const { result } = renderHook(() => useRequireAuth())

      expect(result.current).toEqual({
        isAuthenticated: true,
        isLoading: false,
      })
    })

    it('redirects when loading completes and user not authenticated', async () => {
      // Start with loading state
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
      })

      const { rerender } = renderHook(() => useRequireAuth())
      expect(mockPush).not.toHaveBeenCalled()

      // Loading completes, not authenticated
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      })
      rerender()

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/signin')
      })
    })
  })

  describe('useRedirectIfAuth', () => {
    it('redirects to /dashboard when authenticated and not loading', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      })

      renderHook(() => useRedirectIfAuth())

      expect(mockPush).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('does not redirect when not authenticated', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      })

      renderHook(() => useRedirectIfAuth())

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('does not redirect while loading', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: true,
        isLoading: true,
      })

      renderHook(() => useRedirectIfAuth())

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('uses custom redirect path when provided', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      })

      renderHook(() => useRedirectIfAuth('/home'))

      expect(mockPush).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith('/home')
    })

    it('returns auth state', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
      })

      const { result } = renderHook(() => useRedirectIfAuth())

      expect(result.current).toEqual({
        isAuthenticated: false,
        isLoading: true,
      })
    })

    it('redirects when loading completes and user is authenticated', async () => {
      // Start with loading state
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: true,
        isLoading: true,
      })

      const { rerender } = renderHook(() => useRedirectIfAuth())
      expect(mockPush).not.toHaveBeenCalled()

      // Loading completes, authenticated
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      })
      rerender()

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })
  })

  describe('withAuth HOC', () => {
    const TestComponent = ({ message }: { message: string }) => (
      <div data-testid="protected-content">{message}</div>
    )

    it('shows loading spinner when isLoading=true', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
      })

      const ProtectedComponent = withAuth(TestComponent)
      render(<ProtectedComponent message="Hello" />)

      // Loading spinner should be present (animate-spin class)
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    })

    it('returns null when not authenticated (after loading)', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      })

      const ProtectedComponent = withAuth(TestComponent)
      const { container } = render(<ProtectedComponent message="Hello" />)

      expect(container.firstChild).toBeNull()
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    })

    it('renders component when authenticated', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      })

      const ProtectedComponent = withAuth(TestComponent)
      render(<ProtectedComponent message="Secret Content" />)

      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      expect(screen.getByText('Secret Content')).toBeInTheDocument()
    })

    it('passes props to wrapped component', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      })

      const ProtectedComponent = withAuth(TestComponent)
      render(<ProtectedComponent message="Custom Message" />)

      expect(screen.getByText('Custom Message')).toBeInTheDocument()
    })

    it('uses custom redirect path', () => {
      ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      })

      const ProtectedComponent = withAuth(TestComponent, '/custom-login')
      render(<ProtectedComponent message="Hello" />)

      expect(mockPush).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith('/custom-login')
    })
  })
})
