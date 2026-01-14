// tests/unit/auth/session.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('session.ts', () => {
  let cookieValue = ''

  // Mock document for node environment
  const mockDocument = {
    get cookie() {
      return cookieValue
    },
    set cookie(value: string) {
      cookieValue = value
    }
  }

  beforeEach(() => {
    cookieValue = ''
    // @ts-expect-error - mocking global document
    globalThis.document = mockDocument
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
      expect(cookieValue).toContain('vault_unlocked=true')
      expect(cookieValue).toContain('path=/')
      expect(cookieValue).toContain('max-age=604800')
    })
  })

  describe('clearVaultSession', () => {
    it('clears vault_unlocked cookie by setting expired date', async () => {
      const { clearVaultSession } = await import('@/lib/auth/session')
      cookieValue = 'vault_unlocked=true; path=/'
      clearVaultSession()
      expect(cookieValue).toContain('expires=Thu, 01 Jan 1970')
    })
  })

  describe('hasVaultSession', () => {
    it('returns true when vault_unlocked cookie exists', async () => {
      const { hasVaultSession } = await import('@/lib/auth/session')
      cookieValue = 'vault_unlocked=true; path=/'
      expect(hasVaultSession()).toBe(true)
    })

    it('returns false when vault_unlocked cookie missing', async () => {
      const { hasVaultSession } = await import('@/lib/auth/session')
      cookieValue = ''
      expect(hasVaultSession()).toBe(false)
    })

    it('returns false on server (no document)', async () => {
      // @ts-expect-error - testing edge case
      delete globalThis.document
      const { hasVaultSession } = await import('@/lib/auth/session')
      expect(hasVaultSession()).toBe(false)
      // Restore for afterEach cleanup
      // @ts-expect-error - restore mock
      globalThis.document = mockDocument
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
  })
})
