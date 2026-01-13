// Session management utilities for vault authentication
// Cookie-based session for middleware compatibility

const VAULT_COOKIE = 'vault_unlocked';

export function setVaultSession(): void {
  // Set session cookie (client-side)
  document.cookie = `${VAULT_COOKIE}=true; path=/; max-age=${60 * 60 * 24 * 7}`; // 7 days
}

export function clearVaultSession(): void {
  document.cookie = `${VAULT_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function hasVaultSession(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.includes(`${VAULT_COOKIE}=true`);
}

// Server-side session check (for API routes)
export function checkServerSession(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.includes(`${VAULT_COOKIE}=true`);
}
