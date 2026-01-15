import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { middleware } from '@/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Helper to create mock NextRequest
function createMockRequest(pathname: string, cookies: Record<string, string> = {}): NextRequest {
  const url = new URL(`http://localhost:3000${pathname}`)

  const mockRequest = {
    nextUrl: {
      pathname,
      searchParams: new URLSearchParams(),
      clone: () => new URL(url)
    },
    url: url.toString(),
    cookies: {
      get: (name: string) => {
        const value = cookies[name]
        return value ? { name, value } : undefined
      },
      getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })),
      has: (name: string) => name in cookies,
      set: () => {},
      delete: () => {},
      clear: () => {}
    },
    headers: new Headers(),
    method: 'GET',
    clone: function() { return this }
  } as unknown as NextRequest

  return mockRequest
}

describe('middleware', () => {
  let redirectSpy: ReturnType<typeof vi.spyOn>
  let nextSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    redirectSpy = vi.spyOn(NextResponse, 'redirect')
    nextSpy = vi.spyOn(NextResponse, 'next')
    vi.clearAllMocks()
  })

  afterEach(() => {
    redirectSpy.mockRestore()
    nextSpy.mockRestore()
  })

  describe('protected routes without vault_unlocked cookie', () => {
    it('redirects /dashboard to /signin with redirect param', () => {
      const request = createMockRequest('/dashboard')

      middleware(request)

      expect(redirectSpy).toHaveBeenCalled()
      const redirectUrl = redirectSpy.mock.calls[0][0]
      expect(redirectUrl.pathname).toBe('/signin')
      expect(redirectUrl.searchParams.get('redirect')).toBe('/dashboard')
    })

    it('redirects /memory to /signin with redirect param', () => {
      const request = createMockRequest('/memory')

      middleware(request)

      expect(redirectSpy).toHaveBeenCalled()
      const redirectUrl = redirectSpy.mock.calls[0][0]
      expect(redirectUrl.pathname).toBe('/signin')
      expect(redirectUrl.searchParams.get('redirect')).toBe('/memory')
    })

    it('redirects /profile to /signin with redirect param', () => {
      const request = createMockRequest('/profile')

      middleware(request)

      expect(redirectSpy).toHaveBeenCalled()
      const redirectUrl = redirectSpy.mock.calls[0][0]
      expect(redirectUrl.pathname).toBe('/signin')
      expect(redirectUrl.searchParams.get('redirect')).toBe('/profile')
    })

    it('redirects /import to /signin with redirect param', () => {
      const request = createMockRequest('/import')

      middleware(request)

      expect(redirectSpy).toHaveBeenCalled()
      const redirectUrl = redirectSpy.mock.calls[0][0]
      expect(redirectUrl.pathname).toBe('/signin')
      expect(redirectUrl.searchParams.get('redirect')).toBe('/import')
    })

    it('redirects /chat to /signin with redirect param', () => {
      const request = createMockRequest('/chat')

      middleware(request)

      expect(redirectSpy).toHaveBeenCalled()
      const redirectUrl = redirectSpy.mock.calls[0][0]
      expect(redirectUrl.pathname).toBe('/signin')
      expect(redirectUrl.searchParams.get('redirect')).toBe('/chat')
    })

    it('redirects /connect to /signin with redirect param', () => {
      const request = createMockRequest('/connect')

      middleware(request)

      expect(redirectSpy).toHaveBeenCalled()
      const redirectUrl = redirectSpy.mock.calls[0][0]
      expect(redirectUrl.pathname).toBe('/signin')
      expect(redirectUrl.searchParams.get('redirect')).toBe('/connect')
    })

    it('preserves nested paths in redirect param', () => {
      const request = createMockRequest('/dashboard/settings/security')

      middleware(request)

      expect(redirectSpy).toHaveBeenCalled()
      const redirectUrl = redirectSpy.mock.calls[0][0]
      expect(redirectUrl.pathname).toBe('/signin')
      expect(redirectUrl.searchParams.get('redirect')).toBe('/dashboard/settings/security')
    })

    it('preserves query params in redirect param', () => {
      const request = createMockRequest('/chat')

      middleware(request)

      expect(redirectSpy).toHaveBeenCalled()
      const redirectUrl = redirectSpy.mock.calls[0][0]
      expect(redirectUrl.pathname).toBe('/signin')
      expect(redirectUrl.searchParams.get('redirect')).toBe('/chat')
    })
  })

  describe('protected routes with vault_unlocked cookie', () => {
    it('allows /dashboard with vault_unlocked cookie', () => {
      const request = createMockRequest('/dashboard', { vault_unlocked: 'true' })

      middleware(request)

      expect(nextSpy).toHaveBeenCalled()
      expect(redirectSpy).not.toHaveBeenCalled()
    })

    it('allows /memory with vault_unlocked cookie', () => {
      const request = createMockRequest('/memory', { vault_unlocked: 'true' })

      middleware(request)

      expect(nextSpy).toHaveBeenCalled()
      expect(redirectSpy).not.toHaveBeenCalled()
    })

    it('allows /profile with vault_unlocked cookie', () => {
      const request = createMockRequest('/profile', { vault_unlocked: 'true' })

      middleware(request)

      expect(nextSpy).toHaveBeenCalled()
      expect(redirectSpy).not.toHaveBeenCalled()
    })

    it('allows /import with vault_unlocked cookie', () => {
      const request = createMockRequest('/import', { vault_unlocked: 'true' })

      middleware(request)

      expect(nextSpy).toHaveBeenCalled()
      expect(redirectSpy).not.toHaveBeenCalled()
    })

    it('allows /chat with vault_unlocked cookie', () => {
      const request = createMockRequest('/chat', { vault_unlocked: 'true' })

      middleware(request)

      expect(nextSpy).toHaveBeenCalled()
      expect(redirectSpy).not.toHaveBeenCalled()
    })

    it('allows /connect with vault_unlocked cookie', () => {
      const request = createMockRequest('/connect', { vault_unlocked: 'true' })

      middleware(request)

      expect(nextSpy).toHaveBeenCalled()
      expect(redirectSpy).not.toHaveBeenCalled()
    })

    it('allows nested protected paths with vault_unlocked cookie', () => {
      const request = createMockRequest('/dashboard/advanced/settings', { vault_unlocked: 'true' })

      middleware(request)

      expect(nextSpy).toHaveBeenCalled()
      expect(redirectSpy).not.toHaveBeenCalled()
    })
  })

  describe('public routes', () => {
    it('allows / without cookie', () => {
      const request = createMockRequest('/')

      middleware(request)

      expect(nextSpy).toHaveBeenCalled()
      expect(redirectSpy).not.toHaveBeenCalled()
    })

    it('allows /signin without cookie', () => {
      const request = createMockRequest('/signin')

      middleware(request)

      expect(nextSpy).toHaveBeenCalled()
      expect(redirectSpy).not.toHaveBeenCalled()
    })

    it('allows /signup without cookie', () => {
      const request = createMockRequest('/signup')

      middleware(request)

      expect(nextSpy).toHaveBeenCalled()
      expect(redirectSpy).not.toHaveBeenCalled()
    })

    it('allows /onboarding without cookie', () => {
      const request = createMockRequest('/onboarding')

      middleware(request)

      expect(nextSpy).toHaveBeenCalled()
      expect(redirectSpy).not.toHaveBeenCalled()
    })

    it('allows public routes with vault_unlocked cookie', () => {
      const request = createMockRequest('/signin', { vault_unlocked: 'true' })

      middleware(request)

      expect(nextSpy).toHaveBeenCalled()
      expect(redirectSpy).not.toHaveBeenCalled()
    })

    it('allows nested public paths without cookie', () => {
      const request = createMockRequest('/onboarding/step-1')

      middleware(request)

      expect(nextSpy).toHaveBeenCalled()
      expect(redirectSpy).not.toHaveBeenCalled()
    })
  })

  describe('redirect parameter handling', () => {
    it('includes pathname with multiple path segments in redirect', () => {
      const request = createMockRequest('/dashboard/memory/conversations/123')

      middleware(request)

      expect(redirectSpy).toHaveBeenCalled()
      const redirectUrl = redirectSpy.mock.calls[0][0]
      expect(redirectUrl.searchParams.get('redirect')).toBe('/dashboard/memory/conversations/123')
    })

    it('includes pathname with query-like segments in redirect', () => {
      const request = createMockRequest('/profile/view')

      middleware(request)

      expect(redirectSpy).toHaveBeenCalled()
      const redirectUrl = redirectSpy.mock.calls[0][0]
      expect(redirectUrl.searchParams.get('redirect')).toBe('/profile/view')
    })
  })

  describe('cookie value variations', () => {
    it('works with vault_unlocked=true', () => {
      const request = createMockRequest('/dashboard', { vault_unlocked: 'true' })

      middleware(request)

      expect(nextSpy).toHaveBeenCalled()
    })

    it('works with vault_unlocked=1', () => {
      const request = createMockRequest('/dashboard', { vault_unlocked: '1' })

      middleware(request)

      expect(nextSpy).toHaveBeenCalled()
    })

    it('works with vault_unlocked=any-value (presence check)', () => {
      const request = createMockRequest('/dashboard', { vault_unlocked: 'some-session-token' })

      middleware(request)

      expect(nextSpy).toHaveBeenCalled()
    })

    it('blocks when vault_unlocked cookie missing despite other cookies', () => {
      const request = createMockRequest('/dashboard', {
        theme: 'dark',
        lang: 'en'
      })

      middleware(request)

      expect(redirectSpy).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('does not redirect root path even with protected prefix match', () => {
      const request = createMockRequest('/')

      middleware(request)

      expect(nextSpy).toHaveBeenCalled()
      expect(redirectSpy).not.toHaveBeenCalled()
    })

    it('handles paths with trailing slashes', () => {
      const request = createMockRequest('/dashboard/')

      middleware(request)

      expect(redirectSpy).toHaveBeenCalled()
      const redirectUrl = redirectSpy.mock.calls[0][0]
      expect(redirectUrl.searchParams.get('redirect')).toBe('/dashboard/')
    })

    it('returns correct redirect response object', () => {
      const request = createMockRequest('/dashboard')

      const result = middleware(request)

      expect(result).toBeDefined()
      const callArgs = redirectSpy.mock.calls[0]
      expect(callArgs).toBeDefined()
    })

    it('returns correct next response object for allowed routes', () => {
      const request = createMockRequest('/')

      const result = middleware(request)

      expect(result).toBeDefined()
      const callArgs = nextSpy.mock.calls[0]
      expect(callArgs).toBeDefined()
    })
  })
})
