// tests/unit/auth/guards.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, render, screen, waitFor } from '@testing-library/react'
import { useRequireAuth, useRedirectIfAuth, withAuth } from '@/lib/auth/guards'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
}))

// Mock useAuth from context
const mockUseAuth = vi.fn()
vi.mock('@/lib/auth/context', () => ({
  useAuth: () => mockUseAuth(),
}))

describe('guards.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      authMethod: null,
      user: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
    })
  })

  describe('useRequireAuth', () => {
    it('redirects to /signin when not authenticated and not loading', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      })

      renderHook(() => useRequireAuth())

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/signin')
      })
    })

    it('does not redirect while loading', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
      })

      renderHook(() => useRequireAuth())

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('does not redirect when authenticated', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      })

      renderHook(() => useRequireAuth())

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('uses custom redirect path when provided', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      })

      renderHook(() => useRequireAuth('/login'))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login')
      })
    })

    it('returns auth state', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      })

      const { result } = renderHook(() => useRequireAuth())

      expect(result.current).toEqual({
        isAuthenticated: true,
        isLoading: false,
      })
    })
  })

  describe('useRedirectIfAuth', () => {
    it('redirects to /dashboard when authenticated and not loading', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      })

      renderHook(() => useRedirectIfAuth())

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('does not redirect when not authenticated', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      })

      renderHook(() => useRedirectIfAuth())

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('does not redirect while loading', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: true,
      })

      renderHook(() => useRedirectIfAuth())

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('uses custom redirect path when provided', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      })

      renderHook(() => useRedirectIfAuth('/home'))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/home')
      })
    })

    it('returns auth state', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
      })

      const { result } = renderHook(() => useRedirectIfAuth())

      expect(result.current).toEqual({
        isAuthenticated: false,
        isLoading: true,
      })
    })
  })

  describe('withAuth HOC', () => {
    const TestComponent = ({ message }: { message: string }) => (
      <div data-testid="protected-content">{message}</div>
    )

    it('shows loading spinner when isLoading=true', () => {
      mockUseAuth.mockReturnValue({
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
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      })

      const ProtectedComponent = withAuth(TestComponent)
      const { container } = render(<ProtectedComponent message="Hello" />)

      expect(container.firstChild).toBeNull()
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    })

    it('renders component when authenticated', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      })

      const ProtectedComponent = withAuth(TestComponent)
      render(<ProtectedComponent message="Secret Content" />)

      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      expect(screen.getByText('Secret Content')).toBeInTheDocument()
    })

    it('passes props to wrapped component', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      })

      const ProtectedComponent = withAuth(TestComponent)
      render(<ProtectedComponent message="Custom Message" />)

      expect(screen.getByText('Custom Message')).toBeInTheDocument()
    })

    it('uses custom redirect path', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      })

      const ProtectedComponent = withAuth(TestComponent, '/custom-login')
      render(<ProtectedComponent message="Hello" />)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/custom-login')
      })
    })
  })
})
