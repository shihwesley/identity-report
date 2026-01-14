// tests/unit/auth/session.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Parse a single cookie string "name=value; attr=val; attr2" into parts
function parseCookie(cookieStr: string): { name: string; value: string; attrs: Record<string, string> } {
  const parts = cookieStr.split(';').map(p => p.trim())
  const [nameValue, ...attrParts] = parts
  const [name, value] = nameValue.split('=')
  const attrs: Record<string, string> = {}
  for (const attr of attrParts) {
    const [key, val] = attr.split('=')
    attrs[key.toLowerCase()] = val ?? ''
  }
  return { name, value, attrs }
}

describe('session.ts', () => {
  // Mock document that simulates browser cookie behavior:
  // - setting cookie appends to list (browsers track multiple cookies)
  // - getting cookie returns "name=value; name2=value2" format
  // Note: HttpOnly/Secure flags cannot be set from client-side JS (HttpOnly prevents JS access)
  const mockDocument = {
    _cookies: [] as string[],
    get cookie() {
      // Return only name=value pairs, not attributes (browser behavior)
      return this._cookies.map(c => {
        const [nameVal] = c.split(';')
        return nameVal.trim()
      }).join('; ')
    },
    set cookie(value: string) {
      // Parse incoming cookie to check for overwrites
      const parsed = parseCookie(value)
      // Remove existing cookie with same name
      this._cookies = this._cookies.filter(c => {
        const [nameVal] = c.split(';')
        const [name] = nameVal.split('=')
        return name !== parsed.name
      })
      // Add new cookie (unless expired)
      const isExpired = parsed.attrs['expires']?.includes('1970')
      if (!isExpired) {
        this._cookies.push(value)
      }
    }
  }

  // Store last raw cookie set for attribute verification
  let lastSetCookie = ''
  const captureDocument = {
    get cookie() {
      return mockDocument.cookie
    },
    set cookie(value: string) {
      lastSetCookie = value
      mockDocument.cookie = value
    }
  }

  beforeEach(() => {
    mockDocument._cookies = []
    lastSetCookie = ''
    // @ts-expect-error - mocking global document
    globalThis.document = captureDocument
    // Clear module cache to reset imports
    vi.resetModules()
  })

  afterEach(() => {
    // @ts-expect-error - cleanup
    delete globalThis.document
  })

  describe('setVaultSession', () => {
    it('sets vault_unlocked cookie with 7 day expiry', async () => {
      const { setVaultSession } = await import('@/lib/auth/session')
      setVaultSession()

      // Parse and verify exact attribute values
      const parsed = parseCookie(lastSetCookie)
      expect(parsed.name).toBe('vault_unlocked')
      expect(parsed.value).toBe('true')
      expect(parsed.attrs['path']).toBe('/')
      expect(parsed.attrs['max-age']).toBe('604800') // 7 days in seconds
    })
  })

  describe('clearVaultSession', () => {
    it('clears vault_unlocked cookie by setting expired date', async () => {
      const { setVaultSession, clearVaultSession } = await import('@/lib/auth/session')
      // First set, then clear
      setVaultSession()
      clearVaultSession()

      // Parse and verify expiry set to epoch
      const parsed = parseCookie(lastSetCookie)
      expect(parsed.name).toBe('vault_unlocked')
      expect(parsed.attrs['expires']).toContain('Thu, 01 Jan 1970')
      // Cookie should be removed from mock's internal list
      expect(mockDocument._cookies.length).toBe(0)
    })
  })

  describe('hasVaultSession', () => {
    it('returns true when vault_unlocked cookie exists', async () => {
      const { setVaultSession, hasVaultSession } = await import('@/lib/auth/session')
      setVaultSession()
      expect(hasVaultSession()).toBe(true)
    })

    it('returns false when vault_unlocked cookie missing', async () => {
      const { hasVaultSession } = await import('@/lib/auth/session')
      expect(hasVaultSession()).toBe(false)
    })

    it('returns true when vault_unlocked exists among multiple cookies', async () => {
      const { setVaultSession, hasVaultSession } = await import('@/lib/auth/session')
      // Set other cookies first
      mockDocument._cookies.push('theme=dark; path=/')
      mockDocument._cookies.push('lang=en; path=/')
      // Then set vault cookie
      setVaultSession()
      expect(hasVaultSession()).toBe(true)
      // Verify all cookies present
      expect(mockDocument.cookie).toContain('theme=dark')
      expect(mockDocument.cookie).toContain('lang=en')
      expect(mockDocument.cookie).toContain('vault_unlocked=true')
    })

    it('returns false on server (no document)', async () => {
      // @ts-expect-error - testing edge case
      delete globalThis.document
      const { hasVaultSession } = await import('@/lib/auth/session')
      expect(hasVaultSession()).toBe(false)
      // Restore for afterEach cleanup
      // @ts-expect-error - restore mock
      globalThis.document = captureDocument
    })
  })

  describe('checkServerSession', () => {
    it('returns true when cookie header contains vault_unlocked', async () => {
      const { checkServerSession } = await import('@/lib/auth/session')
      expect(checkServerSession('vault_unlocked=true; other=value')).toBe(true)
    })

    it('returns false when cookie header null', async () => {
      const { checkServerSession } = await import('@/lib/auth/session')
      expect(checkServerSession(null)).toBe(false)
    })

    it('returns false when vault_unlocked not in header', async () => {
      const { checkServerSession } = await import('@/lib/auth/session')
      expect(checkServerSession('other=value')).toBe(false)
    })

    it('returns false for similarly named cookies with suffix (no substring false positives)', async () => {
      const { checkServerSession } = await import('@/lib/auth/session')
      // vault_unlocked_backup=true should NOT match vault_unlocked=true
      // (the =true suffix in search string prevents suffix-based false positives)
      expect(checkServerSession('vault_unlocked_backup=true')).toBe(false)
      expect(checkServerSession('vault_unlocked_v2=true')).toBe(false)
      // But exact match should work
      expect(checkServerSession('vault_unlocked=true')).toBe(true)
    })
  })
})
