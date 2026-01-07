# IdentityReport Testing Strategy

## Executive Summary

This document outlines a production-grade testing strategy for the IdentityReport application - a local-first, privacy-preserving identity management system. The strategy covers all layers of the full-stack application from cryptographic primitives to end-to-end user flows.

## Technology Stack Assessment

| Layer | Technology | Testing Approach |
|-------|------------|------------------|
| Frontend | Next.js 16, React 19 | Vitest + React Testing Library |
| Backend | Node.js MCP Server | Vitest + Supertest |
| Crypto | @noble/ed25519, bip39 | Unit tests with test vectors |
| Blockchain | viem, Polygon | Hardhat + Foundry |
| Storage | IndexedDB | fake-indexeddb |
| E2E | Next.js App Router | Playwright |

## Testing Pyramid

```
                    ┌─────────┐
                    │   E2E   │ (~10%)
                   ┌┴─────────┴┐
                   │Integration│ (~20%)
                  ┌┴───────────┴┐
                  │  Component   │ (~20%)
                 ┌┴─────────────┴┐
                 │     Unit       │ (~50%)
                └─────────────────┘
```

---

## Test Framework Configuration

### Recommended Stack

```json
{
  "devDependencies": {
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0",
    "@vitest/ui": "^3.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "playwright": "^1.49.0",
    "@playwright/test": "^1.49.0",
    "fake-indexeddb": "^6.0.0",
    "msw": "^2.0.0",
    "hardhat": "^2.22.0",
    "@nomicfoundation/hardhat-toolbox": "^5.0.0"
  }
}
```

### Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:component": "vitest run --project component",
    "test:e2e": "playwright test",
    "test:contracts": "hardhat test",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui"
  }
}
```

---

## Test Areas and Priority

### Priority 1: Core Cryptography (Critical)

**Location**: `src/lib/vault/`

| Module | File | Size | Priority | Risk |
|--------|------|------|----------|------|
| Identity | identity.ts | 12KB | P0 | Critical |
| Crypto | crypto.ts | 5.6KB | P0 | Critical |
| Vault Manager | manager.ts | 36KB | P0 | Critical |

**Test Focus**:
- BIP39 mnemonic generation/validation
- Ed25519 key derivation determinism
- DID generation correctness
- PBKDF2 key derivation
- AES-256-GCM encryption/decryption
- Vault lock/unlock cycles
- Data corruption detection

### Priority 2: Sync System (High)

**Location**: `src/lib/sync/`

| Module | File | Size | Priority |
|--------|------|------|----------|
| Three-way Merge | merge.ts | 27KB | P1 |
| Offline Queue | queue.ts | 17KB | P1 |
| IPFS Pinning | pinning.ts | 15KB | P1 |
| Tab Coordination | tabs.ts | 12KB | P1 |

**Test Focus**:
- Conflict detection and resolution
- Merge algorithm correctness
- Queue persistence and replay
- Multi-tab write authority
- Offline/online transitions

### Priority 3: Recovery System (High)

**Location**: `src/lib/recovery/`

| Module | File | Size | Priority |
|--------|------|------|----------|
| Shamir's SSS | shamir.ts | 10KB | P1 |
| Guardian | guardian.ts | 22KB | P1 |
| Monitor | monitor.ts | 9.4KB | P2 |

**Test Focus**:
- Share generation and reconstruction
- Threshold requirements (k-of-n)
- Guardian management flows
- Recovery attestation

### Priority 4: MCP Server (High)

**Location**: `src/lib/mcp/`

| Module | File | Size | Priority |
|--------|------|------|----------|
| Server | server.ts | 16KB | P1 |
| Auth | auth.ts | 18KB | P0 |
| Audit | audit.ts | 11KB | P2 |
| SSE Transport | transports/sse.ts | 10KB | P1 |

**Test Focus**:
- JWT validation and scope checking
- Resource access control
- Tool invocation authorization
- Transport handshake (SSE/STDIO)
- Audit log integrity
- Sensitive data scrubbing

### Priority 5: Importers (Medium)

**Location**: `src/lib/importers/`

| Module | File | Size | Priority |
|--------|------|------|----------|
| OpenAI | openai.ts | 21KB | P2 |
| Claude | claude.ts | 6.6KB | P2 |
| Gemini | gemini.ts | 9.4KB | P2 |

**Test Focus**:
- Streaming parser correctness
- Large file handling
- Format validation
- Memory consumption
- Error recovery

### Priority 6: Smart Contracts (Critical)

**Location**: `contracts/`

| Contract | File | Priority |
|----------|------|----------|
| ProfileRegistry | ProfileRegistry.sol | P0 |
| ProfileRegistryV2 | ProfileRegistryV2.sol | P0 |

**Test Focus**:
- Access control
- Upgrade safety (UUPS)
- State transitions
- Gas optimization
- Edge cases

### Priority 7: React Components (Medium)

**Location**: `src/components/`

| Component | Priority | Complexity |
|-----------|----------|------------|
| ConflictResolution | P1 | High (24KB) |
| RecoverySetup | P1 | High (25KB) |
| SyncStatus | P2 | High (19KB) |
| ConnectWallet | P2 | Medium |
| TimelineView | P3 | Medium |
| KnowledgeGraph | P3 | Medium |

### Priority 8: E2E Flows (Medium)

| Flow | Priority | Coverage |
|------|----------|----------|
| Onboarding | P1 | Identity creation |
| Import | P1 | AI export import |
| Sync | P2 | Multi-device sync |
| Recovery | P2 | Guardian recovery |
| Connect | P3 | Wallet connection |

---

## Directory Structure

```
tests/
├── unit/
│   ├── vault/
│   │   ├── identity.test.ts
│   │   ├── crypto.test.ts
│   │   └── manager.test.ts
│   ├── sync/
│   │   ├── merge.test.ts
│   │   ├── queue.test.ts
│   │   ├── pinning.test.ts
│   │   └── tabs.test.ts
│   ├── recovery/
│   │   ├── shamir.test.ts
│   │   ├── guardian.test.ts
│   │   └── monitor.test.ts
│   ├── mcp/
│   │   ├── auth.test.ts
│   │   ├── audit.test.ts
│   │   └── server.test.ts
│   ├── importers/
│   │   ├── openai.test.ts
│   │   ├── claude.test.ts
│   │   └── gemini.test.ts
│   └── services/
│       ├── ipfs.test.ts
│       ├── registry.test.ts
│       └── summarizer.test.ts
├── integration/
│   ├── mcp/
│   │   ├── sse-transport.test.ts
│   │   ├── stdio-transport.test.ts
│   │   └── resources.test.ts
│   ├── sync/
│   │   └── sync-flow.test.ts
│   └── vault/
│       └── full-lifecycle.test.ts
├── component/
│   ├── dashboard/
│   │   ├── ConflictResolution.test.tsx
│   │   ├── RecoverySetup.test.tsx
│   │   ├── SyncStatus.test.tsx
│   │   └── IdentityCard.test.tsx
│   └── layout/
│       └── Sidebar.test.tsx
├── e2e/
│   ├── onboarding.spec.ts
│   ├── import.spec.ts
│   ├── sync.spec.ts
│   └── recovery.spec.ts
├── contracts/
│   ├── ProfileRegistry.test.ts
│   └── ProfileRegistryV2.test.ts
├── fixtures/
│   ├── openai-export.json
│   ├── claude-export.json
│   ├── gemini-export.json
│   └── test-vectors.ts
├── mocks/
│   ├── indexeddb.ts
│   ├── crypto.ts
│   ├── ipfs.ts
│   └── handlers.ts (MSW)
└── setup/
    ├── vitest.setup.ts
    ├── playwright.setup.ts
    └── hardhat.config.ts
```

---

## Configuration Files

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'tests/contracts/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/types/**'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80
      }
    },
    workspace: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts']
        }
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          testTimeout: 30000
        }
      },
      {
        extends: true,
        test: {
          name: 'component',
          include: ['tests/component/**/*.test.tsx'],
          environment: 'jsdom'
        }
      }
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI
  }
})
```

### hardhat.config.ts

```typescript
import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./tests/contracts",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    hardhat: {
      chainId: 31337
    }
  }
}

export default config
```

---

## Test Implementation Guidelines

### Unit Test Example (Crypto)

```typescript
// tests/unit/vault/crypto.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { encrypt, decrypt, deriveKey } from '@/lib/vault/crypto'

describe('AES-256-GCM Encryption', () => {
  const testPassword = 'test-password-123'
  const testMnemonic = 'abandon abandon abandon...'

  describe('deriveKey', () => {
    it('should derive consistent keys from same inputs', async () => {
      const key1 = await deriveKey(testMnemonic, testPassword)
      const key2 = await deriveKey(testMnemonic, testPassword)
      expect(key1).toEqual(key2)
    })

    it('should derive different keys for different passwords', async () => {
      const key1 = await deriveKey(testMnemonic, 'password1')
      const key2 = await deriveKey(testMnemonic, 'password2')
      expect(key1).not.toEqual(key2)
    })
  })

  describe('encrypt/decrypt', () => {
    it('should round-trip data correctly', async () => {
      const key = await deriveKey(testMnemonic, testPassword)
      const plaintext = JSON.stringify({ secret: 'data' })

      const encrypted = await encrypt(plaintext, key)
      const decrypted = await decrypt(encrypted, key)

      expect(decrypted).toBe(plaintext)
    })

    it('should fail decryption with wrong key', async () => {
      const key1 = await deriveKey(testMnemonic, 'password1')
      const key2 = await deriveKey(testMnemonic, 'password2')

      const encrypted = await encrypt('secret', key1)

      await expect(decrypt(encrypted, key2)).rejects.toThrow()
    })
  })
})
```

### Component Test Example

```typescript
// tests/component/dashboard/IdentityCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IdentityCard } from '@/components/dashboard/IdentityCard'

describe('IdentityCard', () => {
  const mockIdentity = {
    displayName: 'Test User',
    did: 'did:key:z6MkTest123...',
    fullName: 'Test User Full',
    email: 'test@example.com'
  }

  it('should render identity information', () => {
    render(<IdentityCard identity={mockIdentity} />)

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText(/did:key:/)).toBeInTheDocument()
  })

  it('should copy DID to clipboard on click', async () => {
    const user = userEvent.setup()
    const mockClipboard = vi.fn()
    Object.assign(navigator, {
      clipboard: { writeText: mockClipboard }
    })

    render(<IdentityCard identity={mockIdentity} />)

    await user.click(screen.getByRole('button', { name: /copy/i }))

    expect(mockClipboard).toHaveBeenCalledWith(mockIdentity.did)
  })
})
```

### Integration Test Example

```typescript
// tests/integration/mcp/sse-transport.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from 'http'
import { MCPServer } from '@/lib/mcp/server'

describe('SSE Transport Integration', () => {
  let server: ReturnType<typeof createServer>
  let mcpServer: MCPServer

  beforeAll(async () => {
    mcpServer = new MCPServer({ transport: 'sse', port: 3099 })
    await mcpServer.start()
  })

  afterAll(async () => {
    await mcpServer.stop()
  })

  it('should establish SSE connection', async () => {
    const response = await fetch('http://localhost:3099/sse')
    expect(response.headers.get('content-type')).toContain('text/event-stream')
  })

  it('should handle resource requests', async () => {
    // Test MCP resource protocol
  })
})
```

### E2E Test Example

```typescript
// tests/e2e/onboarding.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Onboarding Flow', () => {
  test('should create new identity', async ({ page }) => {
    await page.goto('/onboarding')

    // Generate mnemonic
    await page.click('[data-testid="generate-mnemonic"]')
    const mnemonic = await page.textContent('[data-testid="mnemonic-display"]')
    expect(mnemonic?.split(' ')).toHaveLength(12)

    // Confirm mnemonic
    await page.click('[data-testid="confirm-mnemonic"]')

    // Set password
    await page.fill('[data-testid="password-input"]', 'SecurePass123!')
    await page.fill('[data-testid="confirm-password-input"]', 'SecurePass123!')
    await page.click('[data-testid="create-identity"]')

    // Verify redirect to dashboard
    await expect(page).toHaveURL('/')
    await expect(page.locator('[data-testid="identity-card"]')).toBeVisible()
  })
})
```

---

## Parallel Implementation Areas

For spawning multiple agents, the work can be divided into these independent areas:

### Area 1: Vault & Crypto Tests
- `identity.test.ts`
- `crypto.test.ts`
- `manager.test.ts`
- Test vectors and fixtures

### Area 2: Sync System Tests
- `merge.test.ts`
- `queue.test.ts`
- `tabs.test.ts`
- `pinning.test.ts`

### Area 3: Recovery & MCP Tests
- `shamir.test.ts`
- `guardian.test.ts`
- `auth.test.ts`
- `audit.test.ts`

### Area 4: Importers & Services Tests
- `openai.test.ts`
- `claude.test.ts`
- `gemini.test.ts`
- `registry.test.ts`

### Area 5: Component Tests
- Dashboard components
- Layout components
- Test setup and mocks

### Area 6: E2E & Contract Tests
- Playwright E2E tests
- Hardhat contract tests
- CI/CD configuration

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:coverage

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e

  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:contracts
```

---

## Coverage Requirements

| Area | Statement | Branch | Function | Line |
|------|-----------|--------|----------|------|
| vault/ | 90% | 85% | 90% | 90% |
| sync/ | 85% | 80% | 85% | 85% |
| recovery/ | 90% | 85% | 90% | 90% |
| mcp/ | 80% | 75% | 80% | 80% |
| importers/ | 75% | 70% | 75% | 75% |
| components/ | 70% | 65% | 70% | 70% |
| **Overall** | **80%** | **75%** | **80%** | **80%** |

---

## Next Steps

1. Install test dependencies
2. Set up test configuration files
3. Create test directory structure
4. Implement tests in parallel by area
5. Configure CI/CD pipeline
6. Achieve coverage targets
