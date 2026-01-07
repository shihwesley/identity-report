# Identity Report — Improvement Specifications

> **Version**: 2.0
> **Created**: January 6, 2026
> **Updated**: January 6, 2026
> **Status**: Approved

---

## Overview

This document outlines five critical areas of improvement identified during the architecture review of Identity Report v2.0. Each specification includes context, requirements, design decisions, and implementation guidance.

---

## Design Decisions Summary

| Area | Decision |
|------|----------|
| Conflict UX | Smart merge + review with pick-and-edit capability |
| Shamir Share Expiry | Optional, with auto-prompt reminders |
| STDIO Transport Auth | Trust local (no auth required) |
| Contract Governance | Progressive decentralization, programmatic enforcement at 500 users |
| Queue Overflow | Block new writes until synced |
| Access Revocation | Graceful expiry (existing connections continue) |
| Message Merge Strategy | Append as blocks (preserve device grouping) |
| Recovery Time-lock | User-configurable, 24-hour minimum floor |
| Audit Log Scope | Full (all read and write operations) |
| Guardian Key Shares | IPFS storage + on-chain CID pointers |
| Tab Sync | Real-time via BroadcastChannel, heartbeat-based authority |
| IPFS Redundancy | 2 of 3 pinning services required for success |
| JWT Key Derivation | Separate derivation path from main encryption key |

---

## 1. Sync Conflict Resolution

### Context
The current architecture supports cloud sync via IPFS + Polygon registry, but lacks handling for concurrent edits from multiple devices. This creates a risk of silent data loss when the same profile is modified on different devices before syncing.

### Requirements

**Functional**:
- Detect when local changes conflict with remote state
- Preserve both versions when conflicts occur
- Provide user interface for conflict resolution
- Support automatic resolution for non-conflicting field changes

**Non-functional**:
- Conflict detection must complete in < 100ms
- No data loss under any conflict scenario

### Design Decisions

#### Conflict Resolution UX: Smart Merge + Review
- Auto-merge non-conflicting fields without user intervention
- Only surface true conflicts that require human decision
- Users can **pick a base version then edit** (not binary choice)
- UI presents diff of conflicting fields with edit capability

#### Conversation Message Merging: Append as Blocks
When Device A and Device B both add messages to the same conversation offline:
- Messages are **appended as blocks**, not interleaved by timestamp
- Preserves context of each device's conversation flow
- Format: `[Device A messages] → [Device B messages]`
- Each block labeled with device/timestamp for clarity

#### Multi-Tab Sync: Real-Time with Heartbeat Authority
- Use `BroadcastChannel` API for instant cross-tab communication
- **Heartbeat-based authority**: tabs send periodic heartbeats
- Most recently active tab has write authority
- Inactive tabs (no heartbeat for 30s) become read-only
- **Immediate local resolution**: conflicts between tabs trigger resolution UI instantly

### Implementation Guidance

```typescript
// Enhanced SyncMetadata with device tracking
interface SyncMetadata {
  version: number;
  lastModified: number;
  deviceId: string;
  vectorClock: Record<string, number>;
}

// Conflict types
interface Conflict {
  type: 'memory' | 'conversation' | 'preference' | 'project';
  entityId: string;
  localVersion: unknown;
  remoteVersion: unknown;
  autoMergeable: boolean;  // True if only non-overlapping fields changed
  conflictingFields: string[];
}

// Smart merge logic
async function smartMerge(
  local: PortableProfile,
  remote: PortableProfile
): Promise<{ merged: PortableProfile; conflicts: Conflict[] }> {
  const conflicts: Conflict[] = [];
  const merged = structuredClone(local);

  // Auto-merge non-conflicting entities
  for (const remoteMemory of remote.shortTermMemory) {
    const localMemory = local.shortTermMemory.find(m => m.id === remoteMemory.id);

    if (!localMemory) {
      // New remote memory - auto-add
      merged.shortTermMemory.push(remoteMemory);
    } else if (localMemory.lastModified === remoteMemory.lastModified) {
      // Unchanged - skip
      continue;
    } else {
      // Check field-level conflicts
      const fieldConflicts = detectFieldConflicts(localMemory, remoteMemory);

      if (fieldConflicts.length === 0) {
        // Different fields changed - auto-merge
        Object.assign(
          merged.shortTermMemory.find(m => m.id === localMemory.id)!,
          mergeNonConflictingFields(localMemory, remoteMemory)
        );
      } else {
        // True conflict - needs human decision
        conflicts.push({
          type: 'memory',
          entityId: localMemory.id,
          localVersion: localMemory,
          remoteVersion: remoteMemory,
          autoMergeable: false,
          conflictingFields: fieldConflicts
        });
      }
    }
  }

  return { merged, conflicts };
}

// Conversation block merge
function mergeConversationMessages(
  localConv: Conversation,
  remoteConv: Conversation
): Conversation {
  const baseMessageIds = new Set(
    localConv.messages
      .filter(m => m.timestamp < localConv.lastSyncedAt)
      .map(m => m.id)
  );

  const localNewMessages = localConv.messages.filter(m => !baseMessageIds.has(m.id));
  const remoteNewMessages = remoteConv.messages.filter(m => !baseMessageIds.has(m.id));

  // Append as blocks, not interleaved
  return {
    ...localConv,
    messages: [
      ...localConv.messages.filter(m => baseMessageIds.has(m.id)),
      // Block A: Local device messages
      ...localNewMessages.map(m => ({ ...m, _syncBlock: 'local' })),
      // Block B: Remote device messages
      ...remoteNewMessages.map(m => ({ ...m, _syncBlock: 'remote' })),
    ]
  };
}

// BroadcastChannel tab sync
class TabSyncManager {
  private channel: BroadcastChannel;
  private heartbeatInterval: number;
  private lastHeartbeats: Map<string, number> = new Map();
  private tabId = crypto.randomUUID();
  private hasWriteAuthority = false;

  constructor() {
    this.channel = new BroadcastChannel('identity-report-sync');
    this.channel.onmessage = this.handleMessage.bind(this);
    this.heartbeatInterval = window.setInterval(() => this.sendHeartbeat(), 10000);
    this.sendHeartbeat();
  }

  private sendHeartbeat() {
    this.channel.postMessage({
      type: 'heartbeat',
      tabId: this.tabId,
      timestamp: Date.now()
    });
    this.checkAuthority();
  }

  private checkAuthority() {
    // Clean stale heartbeats (> 30s old)
    const now = Date.now();
    for (const [tabId, timestamp] of this.lastHeartbeats) {
      if (now - timestamp > 30000) {
        this.lastHeartbeats.delete(tabId);
      }
    }

    // Most recent heartbeat (including self) gets authority
    let mostRecent = { tabId: this.tabId, timestamp: now };
    for (const [tabId, timestamp] of this.lastHeartbeats) {
      if (timestamp > mostRecent.timestamp) {
        mostRecent = { tabId, timestamp };
      }
    }

    this.hasWriteAuthority = mostRecent.tabId === this.tabId;
  }

  canWrite(): boolean {
    return this.hasWriteAuthority;
  }

  broadcastChange(change: VaultChange) {
    this.channel.postMessage({
      type: 'change',
      tabId: this.tabId,
      change
    });
  }
}
```

### Conflict Resolution UI Components

```typescript
// ConflictResolutionModal.tsx props
interface ConflictResolutionProps {
  conflicts: Conflict[];
  onResolve: (resolutions: Resolution[]) => void;
}

interface Resolution {
  conflictId: string;
  choice: 'local' | 'remote' | 'custom';
  customValue?: unknown;  // For pick-and-edit
}
```

### Files to Modify
- `src/lib/vault/manager.ts` - Add smart merge to `syncToCloud()` and `restoreFromCloud()`
- `src/lib/types.ts` - Add `SyncMetadata`, `Conflict` interfaces
- New: `src/lib/sync/merge.ts` - Smart merge logic
- New: `src/lib/sync/tabs.ts` - BroadcastChannel tab sync
- New: `src/components/dashboard/ConflictResolution.tsx` - Resolution UI

---

## 2. Key Management Recovery

### Context
The current two-factor security model (mnemonic + password) provides strong protection but creates a single point of failure. If a user loses their mnemonic phrase, all encrypted data is permanently inaccessible.

### Requirements

**Functional**:
- Provide recovery mechanism without compromising security
- Support multiple recovery methods
- Allow users to opt-out of recovery features

**Non-functional**:
- Recovery must not reduce security below current baseline
- Recovery process must be resistant to social engineering

### Design Decisions

#### Primary Method: Shamir's Secret Sharing with Key Reconstruction
- Split the **actual encryption key** into N shares (not just voting rights)
- Guardians hold encrypted shares that reconstruct the original key
- This allows recovery of existing encrypted data (not just identity transfer)

#### Share Configuration
- **Minimum guardians**: 3
- **Maximum guardians**: 5
- **Default threshold**: Majority (e.g., 3-of-5, 2-of-3)
- Users cannot configure fewer than 3 guardians (security floor)

#### Share Expiry: Optional with Auto-Prompt
- Users choose whether shares expire during setup
- If expiry enabled: grace period with escalating reminders
  - 30 days before: Dashboard notification
  - 7 days before: Email reminder (if configured)
  - 1 day before: Prominent warning banner
- Auto-prompt regeneration workflow when expired

#### Guardian Share Storage: IPFS + On-Chain Pointers
- Encrypted shares stored on IPFS (cost-effective, accessible)
- Smart contract stores CID pointers for each guardian
- Guardians need wallet signature to retrieve their share
- Verification hash on-chain ensures share integrity

#### Recovery Time-Lock
- **User-configurable** duration
- **Minimum floor: 24 hours** (non-negotiable security baseline)
- **Default: 72 hours** (recommended)
- Recovery can be cancelled by original owner during time-lock

### Implementation Guidance

```typescript
// Recovery configuration
interface RecoveryConfig {
  enabled: boolean;
  method: 'shamir' | 'social' | 'both';
  shamir?: {
    totalShares: number;      // 3-5
    threshold: number;        // Majority
    expiresAt?: number;       // Optional Unix timestamp
    shares: ShareInfo[];
  };
  social?: {
    guardians: Guardian[];
    timeLockHours: number;    // Min 24, default 72
  };
}

interface ShareInfo {
  index: number;
  guardianDid: string;
  ipfsCid: string;
  verificationHash: string;
  distributedAt: number;
  expiresAt?: number;
}

interface Guardian {
  address: string;           // Ethereum address
  did?: string;              // Optional DID for non-wallet guardians
  label: string;             // Human-readable name
  addedAt: number;
  shareCid?: string;         // IPFS CID of their encrypted share
}

// Key derivation for shares (uses encryption key, not mnemonic directly)
async function createRecoveryShares(
  encryptionKey: CryptoKey,
  config: { total: number; threshold: number }
): Promise<{ shares: Uint8Array[]; verificationHash: string }> {
  // Export key for splitting
  const keyBytes = await crypto.subtle.exportKey('raw', encryptionKey);

  // Create Shamir shares
  const shares = await shamirSplit(
    new Uint8Array(keyBytes),
    config.total,
    config.threshold
  );

  // Create verification hash
  const verificationHash = await sha256(new Uint8Array(keyBytes));

  return { shares, verificationHash };
}

// Encrypt share for specific guardian
async function encryptShareForGuardian(
  share: Uint8Array,
  guardianPublicKey: string
): Promise<string> {
  // Use guardian's public key to encrypt share
  // They can only decrypt with their private key
  const encrypted = await eciesEncrypt(guardianPublicKey, share);
  return base64Encode(encrypted);
}

// Store share on IPFS
async function storeShareOnIpfs(
  encryptedShare: string,
  guardianAddress: string,
  ipfsService: IpfsService
): Promise<string> {
  const payload = {
    version: 1,
    type: 'recovery-share',
    guardian: guardianAddress,
    encryptedShare,
    createdAt: Date.now()
  };

  const cid = await ipfsService.pin(payload);
  return cid;
}

// Recovery flow
async function initiateRecovery(
  userAddress: string,
  guardianShares: { guardian: string; decryptedShare: Uint8Array }[]
): Promise<{ encryptionKey: CryptoKey; timeLockEnd: number }> {
  // Verify we have threshold shares
  const config = await getRecoveryConfig(userAddress);
  if (guardianShares.length < config.shamir.threshold) {
    throw new Error(`Need ${config.shamir.threshold} shares, got ${guardianShares.length}`);
  }

  // Reconstruct key
  const keyBytes = await shamirCombine(
    guardianShares.map(s => s.decryptedShare)
  );

  // Verify against stored hash
  const hash = await sha256(keyBytes);
  if (hash !== config.shamir.verificationHash) {
    throw new Error('Share verification failed - key mismatch');
  }

  // Import as CryptoKey
  const encryptionKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Time-lock: recovery completes after configured delay
  const timeLockEnd = Date.now() + (config.social.timeLockHours * 60 * 60 * 1000);

  return { encryptionKey, timeLockEnd };
}

// Expiry reminder system
class ShareExpiryMonitor {
  private checkInterval: number;

  constructor(private vault: VaultManager) {
    this.checkInterval = window.setInterval(() => this.checkExpiry(), 86400000); // Daily
  }

  private async checkExpiry() {
    const config = await this.vault.getRecoveryConfig();
    if (!config?.shamir?.expiresAt) return;

    const daysUntilExpiry = (config.shamir.expiresAt - Date.now()) / 86400000;

    if (daysUntilExpiry <= 0) {
      this.showExpiredWarning();
    } else if (daysUntilExpiry <= 1) {
      this.showUrgentWarning();
    } else if (daysUntilExpiry <= 7) {
      this.showEmailReminder();
    } else if (daysUntilExpiry <= 30) {
      this.showDashboardNotification();
    }
  }
}
```

### Smart Contract Updates

```solidity
// Add to ProfileRegistryV2.sol
struct RecoveryConfig {
    uint256 timeLockHours;
    uint256 threshold;
    string[] shareCids;
    bytes32 verificationHash;
}

struct RecoveryRequest {
    address initiator;
    uint256 initiatedAt;
    uint256 sharesProvided;
    bool cancelled;
}

mapping(address => RecoveryConfig) public recoveryConfigs;
mapping(address => address[]) public guardians;
mapping(address => RecoveryRequest) public pendingRecoveries;

event RecoveryConfigured(address indexed user, uint256 guardianCount, uint256 threshold);
event RecoveryInitiated(address indexed user, address indexed initiator, uint256 completesAt);
event RecoveryCancelled(address indexed user);
event RecoveryCompleted(address indexed user, address indexed newOwner);

function configureRecovery(
    address[] calldata _guardians,
    uint256 _threshold,
    uint256 _timeLockHours,
    string[] calldata _shareCids,
    bytes32 _verificationHash
) external {
    require(_guardians.length >= 3 && _guardians.length <= 5, "3-5 guardians required");
    require(_threshold <= _guardians.length, "Invalid threshold");
    require(_timeLockHours >= 24, "Minimum 24 hour timelock");

    guardians[msg.sender] = _guardians;
    recoveryConfigs[msg.sender] = RecoveryConfig({
        timeLockHours: _timeLockHours,
        threshold: _threshold,
        shareCids: _shareCids,
        verificationHash: _verificationHash
    });

    emit RecoveryConfigured(msg.sender, _guardians.length, _threshold);
}

function initiateRecovery(address user) external {
    require(isGuardian(user, msg.sender), "Not a guardian");
    require(pendingRecoveries[user].initiatedAt == 0, "Recovery already pending");

    pendingRecoveries[user] = RecoveryRequest({
        initiator: msg.sender,
        initiatedAt: block.timestamp,
        sharesProvided: 1,
        cancelled: false
    });

    uint256 completesAt = block.timestamp + (recoveryConfigs[user].timeLockHours * 1 hours);
    emit RecoveryInitiated(user, msg.sender, completesAt);
}

function cancelRecovery() external {
    require(pendingRecoveries[msg.sender].initiatedAt > 0, "No pending recovery");
    pendingRecoveries[msg.sender].cancelled = true;
    emit RecoveryCancelled(msg.sender);
}
```

### Files to Modify
- `src/lib/vault/identity.ts` - Add share generation and reconstruction
- `src/lib/vault/manager.ts` - Add recovery flow
- `contracts/ProfileRegistry.sol` - Add guardian and recovery functions
- New: `src/lib/recovery/shamir.ts` - Shamir's Secret Sharing implementation
- New: `src/lib/recovery/monitor.ts` - Expiry monitoring
- New: `src/components/RecoverySetup.tsx` - Recovery configuration UI
- New: `src/components/RecoveryFlow.tsx` - Recovery initiation UI

---

## 3. MCP Server Authentication

### Context
The MCP server exposes sensitive user context via SSE transport. While `AccessGrant` tokens are implemented for permission management, the SSE endpoints themselves lack authentication middleware. Anyone with the server URL could potentially connect.

### Requirements

**Functional**:
- Authenticate all MCP server connections
- Validate AccessGrant tokens on each request
- Support token refresh without reconnection
- Log all authentication attempts

**Non-functional**:
- Authentication overhead < 10ms per request
- Support 100+ concurrent authenticated sessions

### Design Decisions

#### STDIO Transport: Trust Local
- Local STDIO connections (Claude Desktop) do **not** require authentication
- Rationale: Accessing STDIO requires local process execution, which implies device access
- This simplifies local development and reduces friction

#### SSE Transport: JWT + AccessGrant
- **JWT for session authentication**: Proves identity
- **AccessGrant for authorization**: Proves permission for specific operations
- Combine both for defense in depth

#### JWT Key Derivation: Separate Path
- JWT signing key derived from mnemonic using **separate derivation path**
- Path: `m/44'/identity'/1'` (distinct from main encryption key at `m/44'/identity'/0'`)
- Limits blast radius if one key is somehow compromised
- Use Ed25519 for JWT signatures (same curve, new key)

#### Access Revocation: Graceful Expiry
- When user revokes an AI client's access:
  - Existing SSE connections **continue** until natural disconnect
  - New connections with revoked grants are **blocked immediately**
- Rationale: Prevents data loss from mid-operation disconnects
- Sessions have natural timeout (configurable, default 1 hour)

#### Audit Logging: Full Scope
- Log **all operations** (both reads and writes)
- Captured data:
  - Timestamp
  - Session ID
  - Tool/resource name
  - Parameters (sanitized)
  - Success/failure
  - Client identifier (from JWT claims)
- Logs **synced with vault** (encrypted, survives device loss)
- **Self-contained viewing** (no external SIEM export)

### Implementation Guidance

```typescript
// JWT key derivation (separate from encryption key)
async function deriveJwtSigningKey(mnemonic: string): Promise<{
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}> {
  // Use different derivation path than encryption key
  const seed = await mnemonicToSeed(mnemonic);
  const jwtPath = "m/44'/identity'/1'";  // Different from encryption path
  const derived = derivePath(jwtPath, seed);

  return ed25519.generateKeyPairFromSeed(derived.key);
}

// JWT token structure
interface IdentityJwt {
  // Header
  alg: 'EdDSA';
  typ: 'JWT';

  // Payload
  sub: string;        // DID
  iat: number;        // Issued at
  exp: number;        // Expiry (1 hour default)
  jti: string;        // Unique token ID
  client: string;     // Client identifier (e.g., "claude-desktop")
  scope: string[];    // Allowed operations
}

// Authentication middleware
class McpAuthMiddleware {
  private sessions: Map<string, AuthenticatedSession> = new Map();
  private revokedGrants: Set<string> = new Set();
  private auditLog: AuditLogger;

  constructor(
    private jwtPublicKey: Uint8Array,
    private transport: 'stdio' | 'sse'
  ) {
    this.auditLog = new AuditLogger();
  }

  async authenticate(request: McpRequest): Promise<AuthResult> {
    // STDIO is trusted
    if (this.transport === 'stdio') {
      return {
        authenticated: true,
        session: this.createLocalSession()
      };
    }

    // SSE requires JWT
    const token = request.headers?.authorization?.replace('Bearer ', '');
    if (!token) {
      this.auditLog.log({
        type: 'auth_failure',
        reason: 'missing_token',
        ip: request.ip
      });
      return { authenticated: false, error: 'Missing authorization token' };
    }

    try {
      const payload = await this.verifyJwt(token);

      // Check expiry
      if (payload.exp < Date.now() / 1000) {
        throw new Error('Token expired');
      }

      const session: AuthenticatedSession = {
        sessionId: crypto.randomUUID(),
        did: payload.sub,
        client: payload.client,
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        scope: payload.scope
      };

      this.sessions.set(session.sessionId, session);

      this.auditLog.log({
        type: 'auth_success',
        sessionId: session.sessionId,
        did: payload.sub,
        client: payload.client
      });

      return { authenticated: true, session };
    } catch (error) {
      this.auditLog.log({
        type: 'auth_failure',
        reason: error.message,
        ip: request.ip
      });
      return { authenticated: false, error: error.message };
    }
  }

  async authorizeToolCall(
    sessionId: string,
    toolName: string,
    params: unknown,
    accessGrant?: AccessGrant
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Update activity
    session.lastActivity = Date.now();

    // Check if grant is revoked (for graceful expiry)
    if (accessGrant && this.revokedGrants.has(accessGrant.id)) {
      this.auditLog.log({
        type: 'authorization_failure',
        sessionId,
        tool: toolName,
        reason: 'revoked_grant'
      });
      return false;
    }

    // Get required permission for tool
    const requiredPermission = this.getRequiredPermission(toolName);

    if (!requiredPermission) {
      // Public tool - log and allow
      this.auditLog.log({
        type: 'tool_call',
        sessionId,
        tool: toolName,
        params: this.sanitizeParams(params),
        result: 'allowed'
      });
      return true;
    }

    // Verify access grant
    if (!accessGrant) {
      this.auditLog.log({
        type: 'authorization_failure',
        sessionId,
        tool: toolName,
        reason: 'missing_grant'
      });
      return false;
    }

    const isValid = await this.verifyAccessGrant(accessGrant, requiredPermission);

    this.auditLog.log({
      type: 'tool_call',
      sessionId,
      tool: toolName,
      params: this.sanitizeParams(params),
      grantId: accessGrant.id,
      result: isValid ? 'allowed' : 'denied'
    });

    return isValid;
  }

  revokeGrant(grantId: string) {
    // Mark as revoked - existing sessions continue (graceful expiry)
    this.revokedGrants.add(grantId);

    this.auditLog.log({
      type: 'grant_revoked',
      grantId,
      existingSessions: this.getSessionsUsingGrant(grantId).length
    });
  }

  private getRequiredPermission(toolName: string): Permission | null {
    const permissionMap: Record<string, Permission> = {
      'search_memory': 'read:memories',
      'get_context_for_task': 'read:memories',
      'get_conversation_history': 'read:conversations',
      'add_memory': 'write:memories',
      'archive_conversation': 'write:conversations',
      'grant_access': 'admin:grants',
      'sync_vault': 'admin:sync',
      'toggle_auto_archive': 'admin:settings',
      'toggle_auto_sync': 'admin:settings'
    };
    return permissionMap[toolName] || null;
  }

  private sanitizeParams(params: unknown): unknown {
    // Remove sensitive data from logs
    if (typeof params !== 'object' || !params) return params;

    const sanitized = { ...params as Record<string, unknown> };
    const sensitiveKeys = ['password', 'mnemonic', 'privateKey', 'secret'];

    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

// Audit logger with sync support
class AuditLogger {
  private logs: AuditEntry[] = [];
  private readonly MAX_LOGS = 10000;

  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
    const fullEntry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...entry
    };

    this.logs.push(fullEntry);

    // Rotate if needed
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS);
    }
  }

  getLogsForSync(): AuditEntry[] {
    return [...this.logs];
  }

  async importLogs(entries: AuditEntry[]) {
    // Merge, dedupe, sort by timestamp
    const merged = [...this.logs, ...entries];
    const deduped = new Map(merged.map(e => [e.id, e]));
    this.logs = Array.from(deduped.values()).sort((a, b) => a.timestamp - b.timestamp);
  }
}

interface AuditEntry {
  id: string;
  timestamp: number;
  type: 'auth_success' | 'auth_failure' | 'tool_call' | 'authorization_failure' | 'grant_revoked';
  sessionId?: string;
  did?: string;
  client?: string;
  tool?: string;
  params?: unknown;
  grantId?: string;
  result?: 'allowed' | 'denied';
  reason?: string;
  ip?: string;
}
```

### Files to Modify
- `src/lib/mcp/server.ts` - Add authentication middleware
- `src/lib/vault/identity.ts` - Add JWT key derivation
- New: `src/lib/mcp/auth.ts` - Authentication and authorization logic
- New: `src/lib/mcp/audit.ts` - Audit logging
- `src/lib/vault/manager.ts` - Include audit logs in sync payload
- New: `src/components/dashboard/AuditLog.tsx` - Audit log viewer UI

---

## 4. Smart Contract Upgradability

### Context
The current `ProfileRegistry.sol` contract is simple and non-upgradeable. Once deployed to mainnet, any bugs or feature additions would require deploying a new contract and migrating all user data.

### Requirements

**Functional**:
- Support contract logic upgrades without data migration
- Maintain backward compatibility for existing profiles
- Include admin controls for upgrade authorization
- Support emergency pause functionality

**Non-functional**:
- Upgrade process must be atomic
- No user action required for upgrades
- Gas costs for users unchanged after upgrade

### Design Decisions

#### Upgrade Pattern: UUPS
- Use UUPS (Universal Upgradeable Proxy Standard) for gas efficiency
- Logic contract contains upgrade authorization
- ERC-1967 compliant proxy

#### Governance: Progressive Decentralization with Programmatic Enforcement
- **Initial state**: Single admin key for agility during early development
- **Trigger**: 500 registered profiles
- **Enforcement**: Programmatic (contract auto-requires multisig after threshold)
- After threshold:
  - Single-admin upgrade attempts **fail**
  - Contract checks `totalUsers >= 500` before allowing single-sig admin actions
  - Forces migration to multisig for continued operation

#### Multisig Configuration
- 3-of-5 multisig for admin actions after threshold
- Signers should include:
  - 2 core team members
  - 2 community representatives
  - 1 security advisor
- Timelock of 48 hours for upgrade execution (after multisig approval)

### Implementation Guidance

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

contract ProfileRegistryV2 is
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable
{
    // State variables
    mapping(address => string) public profiles;
    mapping(address => uint256) public lastUpdated;

    // Governance
    uint256 public constant DECENTRALIZATION_THRESHOLD = 500;
    uint256 public totalUsers;
    address public multisig;
    bool public multisigRequired;

    // Recovery (from spec #2)
    mapping(address => address[]) public guardians;
    mapping(address => RecoveryConfig) public recoveryConfigs;
    mapping(address => RecoveryRequest) public pendingRecoveries;

    // Events
    event ProfileUpdated(address indexed user, string cid, uint256 timestamp);
    event UserRegistered(address indexed user, uint256 totalUsers);
    event MultisigActivated(uint256 userCount);
    event GuardianAdded(address indexed user, address indexed guardian);
    event RecoveryInitiated(address indexed user, address indexed initiator, uint256 completesAt);
    event RecoveryCancelled(address indexed user);

    // Structs
    struct RecoveryConfig {
        uint256 timeLockHours;
        uint256 threshold;
        string[] shareCids;
        bytes32 verificationHash;
    }

    struct RecoveryRequest {
        address initiator;
        uint256 initiatedAt;
        uint256 sharesProvided;
        bool cancelled;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _multisig) public initializer {
        __Ownable_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        multisig = _multisig;
        multisigRequired = false;
    }

    // Profile management
    function updateProfile(string calldata cid) external whenNotPaused {
        bool isNewUser = bytes(profiles[msg.sender]).length == 0;

        profiles[msg.sender] = cid;
        lastUpdated[msg.sender] = block.timestamp;

        if (isNewUser) {
            totalUsers++;
            emit UserRegistered(msg.sender, totalUsers);

            // Check if we hit decentralization threshold
            if (totalUsers >= DECENTRALIZATION_THRESHOLD && !multisigRequired) {
                multisigRequired = true;
                emit MultisigActivated(totalUsers);
            }
        }

        emit ProfileUpdated(msg.sender, cid, block.timestamp);
    }

    function getProfile(address user) external view returns (string memory) {
        return profiles[user];
    }

    // Guardian management
    function configureRecovery(
        address[] calldata _guardians,
        uint256 _threshold,
        uint256 _timeLockHours,
        string[] calldata _shareCids,
        bytes32 _verificationHash
    ) external {
        require(_guardians.length >= 3 && _guardians.length <= 5, "3-5 guardians required");
        require(_threshold <= _guardians.length && _threshold >= 2, "Invalid threshold");
        require(_timeLockHours >= 24, "Minimum 24 hour timelock");

        guardians[msg.sender] = _guardians;
        recoveryConfigs[msg.sender] = RecoveryConfig({
            timeLockHours: _timeLockHours,
            threshold: _threshold,
            shareCids: _shareCids,
            verificationHash: _verificationHash
        });

        for (uint i = 0; i < _guardians.length; i++) {
            emit GuardianAdded(msg.sender, _guardians[i]);
        }
    }

    function initiateRecovery(address user) external {
        require(_isGuardian(user, msg.sender), "Not a guardian");
        require(pendingRecoveries[user].initiatedAt == 0 || pendingRecoveries[user].cancelled, "Recovery pending");

        pendingRecoveries[user] = RecoveryRequest({
            initiator: msg.sender,
            initiatedAt: block.timestamp,
            sharesProvided: 1,
            cancelled: false
        });

        uint256 completesAt = block.timestamp + (recoveryConfigs[user].timeLockHours * 1 hours);
        emit RecoveryInitiated(user, msg.sender, completesAt);
    }

    function cancelRecovery() external {
        require(pendingRecoveries[msg.sender].initiatedAt > 0, "No pending recovery");
        require(!pendingRecoveries[msg.sender].cancelled, "Already cancelled");
        pendingRecoveries[msg.sender].cancelled = true;
        emit RecoveryCancelled(msg.sender);
    }

    function _isGuardian(address user, address guardian) internal view returns (bool) {
        address[] memory userGuardians = guardians[user];
        for (uint i = 0; i < userGuardians.length; i++) {
            if (userGuardians[i] == guardian) return true;
        }
        return false;
    }

    // Admin functions with programmatic governance enforcement
    modifier onlyGovernance() {
        if (multisigRequired) {
            require(msg.sender == multisig, "Multisig required after threshold");
        } else {
            require(msg.sender == owner(), "Only owner");
        }
        _;
    }

    function pause() external onlyGovernance {
        _pause();
    }

    function unpause() external onlyGovernance {
        _unpause();
    }

    function setMultisig(address _newMultisig) external onlyGovernance {
        require(_newMultisig != address(0), "Invalid multisig");
        multisig = _newMultisig;
    }

    // UUPS upgrade authorization - enforces governance
    function _authorizeUpgrade(address newImplementation) internal override onlyGovernance {
        // Additional checks could be added here
    }

    // View functions for governance status
    function isDecentralized() external view returns (bool) {
        return multisigRequired;
    }

    function usersUntilDecentralization() external view returns (uint256) {
        if (totalUsers >= DECENTRALIZATION_THRESHOLD) return 0;
        return DECENTRALIZATION_THRESHOLD - totalUsers;
    }
}
```

### Deployment Scripts

```typescript
// scripts/deploy-upgradeable.ts
import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Deploy multisig first (or use existing)
  const multisigAddress = process.env.MULTISIG_ADDRESS || deployer.address;

  // Deploy upgradeable proxy
  const ProfileRegistry = await ethers.getContractFactory("ProfileRegistryV2");
  const proxy = await upgrades.deployProxy(
    ProfileRegistry,
    [multisigAddress],
    { kind: 'uups' }
  );

  await proxy.waitForDeployment();
  const address = await proxy.getAddress();

  console.log("ProfileRegistry proxy deployed to:", address);
  console.log("Multisig set to:", multisigAddress);
  console.log("Decentralization threshold:", await proxy.DECENTRALIZATION_THRESHOLD());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

// scripts/upgrade.ts
import { ethers, upgrades } from "hardhat";

async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS!;

  // Check governance status
  const current = await ethers.getContractAt("ProfileRegistryV2", proxyAddress);
  const isDecentralized = await current.isDecentralized();

  if (isDecentralized) {
    console.log("⚠️  Contract is decentralized - upgrade must come from multisig");
    console.log("Multisig address:", await current.multisig());
    // In production, this would create a multisig proposal
    return;
  }

  // Upgrade
  const ProfileRegistryV3 = await ethers.getContractFactory("ProfileRegistryV3");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, ProfileRegistryV3);

  console.log("Upgraded to V3 at:", await upgraded.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

### Files to Modify
- `contracts/ProfileRegistry.sol` - Upgrade to UUPS pattern with governance
- New: `scripts/deploy-upgradeable.ts` - Deployment script
- New: `scripts/upgrade.ts` - Upgrade script
- `hardhat.config.ts` - Add OpenZeppelin upgrades plugin
- `package.json` - Add `@openzeppelin/hardhat-upgrades` dependency

---

## 5. Offline-First Sync Queue

### Context
Current sync is manual and requires connectivity. For true offline-first operation, the system should queue mutations while offline and replay them upon reconnection, handling partial failures gracefully.

### Requirements

**Functional**:
- Queue all write operations when offline
- Automatically sync when connectivity restored
- Handle partial sync failures with retry
- Provide sync status visibility to user

**Non-functional**:
- Queue must persist across app restarts
- Sync retry with exponential backoff
- Maximum queue size: 1000 operations

### Design Decisions

#### Queue Overflow Behavior: Block New Writes
- When queue reaches 1000 operations, **block new mutations**
- Rationale: Data integrity over UX - prevents silent data loss
- User must sync (come online) or explicitly clear queue to continue
- **Persistent banner** UI indicates blocked state

#### IPFS Redundancy: Multiple Pinning Services
- Default services: **Pinata, Infura, web3.storage**
- Success criteria: **2 of 3 services must pin** for sync to succeed
- Parallel pinning for speed
- Service health tracked - unhealthy services skipped

#### Dead Letter Queue: Auto-Purge 30 Days
- Failed operations (after 3 retries) move to dead letter queue
- **Auto-purge after 30 days** with warning
- Users notified of dead letter items
- Manual review/retry available before purge

#### Retry Strategy: Exponential Backoff
- Initial delay: 1 second
- Multiplier: 2x
- Max delay: 5 minutes
- Max retries: 3 before dead letter

### Implementation Guidance

```typescript
// Sync queue with full implementation
interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'memory' | 'conversation' | 'profile' | 'preference';
  entityId: string;
  payload: unknown;
  timestamp: number;
  retryCount: number;
  nextRetryAt: number;
  status: 'pending' | 'processing' | 'failed' | 'dead';
}

interface DeadLetterEntry extends QueuedOperation {
  failedAt: number;
  lastError: string;
  purgeAt: number;  // 30 days from failedAt
}

interface PinningResult {
  service: string;
  success: boolean;
  cid?: string;
  error?: string;
}

class SyncQueue {
  private queue: QueuedOperation[] = [];
  private deadLetter: DeadLetterEntry[] = [];
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly MAX_RETRIES = 3;
  private readonly DEAD_LETTER_TTL_DAYS = 30;

  private pinningServices: PinningService[] = [
    new PinataService(),
    new InfuraService(),
    new Web3StorageService()
  ];

  constructor(private storage: IndexedDBStorage) {
    window.addEventListener('online', () => this.onConnectivityChange(true));
    window.addEventListener('offline', () => this.onConnectivityChange(false));
    this.loadFromStorage();
    this.startDeadLetterPurger();
  }

  async enqueue(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount' | 'nextRetryAt' | 'status'>): Promise<EnqueueResult> {
    // Check queue limit
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      return {
        success: false,
        blocked: true,
        message: 'Sync queue full. Please connect to internet to sync pending changes.'
      };
    }

    const op: QueuedOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
      nextRetryAt: Date.now(),
      status: 'pending'
    };

    this.queue.push(op);
    await this.persistQueue();

    if (this.isOnline) {
      this.processQueue();
    }

    return { success: true, blocked: false, operationId: op.id };
  }

  private async processQueue(): Promise<void> {
    if (this.isSyncing || !this.isOnline) return;
    this.isSyncing = true;

    const pendingOps = this.queue
      .filter(o => o.status === 'pending' && o.nextRetryAt <= Date.now())
      .sort((a, b) => a.timestamp - b.timestamp);

    for (const op of pendingOps) {
      try {
        op.status = 'processing';
        await this.executeOperation(op);

        // Success - remove from queue
        this.queue = this.queue.filter(o => o.id !== op.id);
      } catch (error) {
        op.status = 'failed';
        op.retryCount++;

        if (op.retryCount >= this.MAX_RETRIES) {
          // Move to dead letter
          this.moveToDeadLetter(op, error.message);
        } else {
          // Schedule retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, op.retryCount), 5 * 60 * 1000);
          op.nextRetryAt = Date.now() + delay;
          op.status = 'pending';
        }
      }
    }

    await this.persistQueue();
    this.isSyncing = false;

    // Schedule next processing if there are pending retries
    const nextRetry = this.queue
      .filter(o => o.status === 'pending')
      .map(o => o.nextRetryAt)
      .sort((a, b) => a - b)[0];

    if (nextRetry && this.isOnline) {
      setTimeout(() => this.processQueue(), nextRetry - Date.now());
    }
  }

  private async executeOperation(op: QueuedOperation): Promise<void> {
    // Build current state
    const currentProfile = await this.buildCurrentProfile();

    // Apply operation to profile
    this.applyOperation(currentProfile, op);

    // Encrypt
    const encrypted = await this.encryptProfile(currentProfile);

    // Pin to multiple services (need 2 of 3)
    const pinResults = await this.pinToServices(encrypted);
    const successCount = pinResults.filter(r => r.success).length;

    if (successCount < 2) {
      const errors = pinResults.filter(r => !r.success).map(r => `${r.service}: ${r.error}`);
      throw new Error(`Pinning failed (${successCount}/3 services): ${errors.join(', ')}`);
    }

    // Get CID from successful pin
    const cid = pinResults.find(r => r.success)!.cid!;

    // Update registry
    await this.updateRegistry(cid);
  }

  private async pinToServices(data: EncryptedProfile): Promise<PinningResult[]> {
    // Pin to all services in parallel
    const results = await Promise.all(
      this.pinningServices.map(async (service) => {
        try {
          if (!service.isHealthy()) {
            return { service: service.name, success: false, error: 'Service unhealthy' };
          }
          const cid = await service.pin(data);
          return { service: service.name, success: true, cid };
        } catch (error) {
          service.markUnhealthy();
          return { service: service.name, success: false, error: error.message };
        }
      })
    );

    return results;
  }

  private moveToDeadLetter(op: QueuedOperation, error: string) {
    const deadEntry: DeadLetterEntry = {
      ...op,
      status: 'dead',
      failedAt: Date.now(),
      lastError: error,
      purgeAt: Date.now() + (this.DEAD_LETTER_TTL_DAYS * 24 * 60 * 60 * 1000)
    };

    this.deadLetter.push(deadEntry);
    this.queue = this.queue.filter(o => o.id !== op.id);
  }

  private startDeadLetterPurger() {
    // Check daily for expired dead letter entries
    setInterval(() => {
      const now = Date.now();
      const expiring = this.deadLetter.filter(d => d.purgeAt <= now + 7 * 24 * 60 * 60 * 1000);

      if (expiring.length > 0) {
        // Notify user of items about to be purged
        this.notifyDeadLetterExpiring(expiring);
      }

      // Actually purge expired items
      this.deadLetter = this.deadLetter.filter(d => d.purgeAt > now);
      this.persistDeadLetter();
    }, 24 * 60 * 60 * 1000);
  }

  // Manual retry from dead letter
  async retryDeadLetter(entryId: string): Promise<boolean> {
    const entry = this.deadLetter.find(d => d.id === entryId);
    if (!entry) return false;

    // Move back to queue
    const op: QueuedOperation = {
      id: entry.id,
      type: entry.type,
      entity: entry.entity,
      entityId: entry.entityId,
      payload: entry.payload,
      timestamp: entry.timestamp,
      retryCount: 0,  // Reset retry count
      nextRetryAt: Date.now(),
      status: 'pending'
    };

    this.queue.push(op);
    this.deadLetter = this.deadLetter.filter(d => d.id !== entryId);

    await this.persistQueue();
    await this.persistDeadLetter();

    if (this.isOnline) {
      this.processQueue();
    }

    return true;
  }

  getStatus(): SyncQueueStatus {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pending: this.queue.filter(o => o.status === 'pending').length,
      processing: this.queue.filter(o => o.status === 'processing').length,
      failed: this.queue.filter(o => o.status === 'failed').length,
      deadLetter: this.deadLetter.length,
      isBlocked: this.queue.length >= this.MAX_QUEUE_SIZE,
      queueCapacity: {
        used: this.queue.length,
        max: this.MAX_QUEUE_SIZE
      }
    };
  }
}

// Pinning service interface
abstract class PinningService {
  abstract name: string;
  private healthy = true;
  private lastHealthCheck = 0;
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute

  async isHealthy(): Promise<boolean> {
    if (Date.now() - this.lastHealthCheck > this.HEALTH_CHECK_INTERVAL) {
      this.healthy = await this.checkHealth();
      this.lastHealthCheck = Date.now();
    }
    return this.healthy;
  }

  markUnhealthy() {
    this.healthy = false;
  }

  abstract pin(data: EncryptedProfile): Promise<string>;
  abstract checkHealth(): Promise<boolean>;
}

class PinataService extends PinningService {
  name = 'Pinata';

  async pin(data: EncryptedProfile): Promise<string> {
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PINATA_JWT}`
      },
      body: JSON.stringify({ pinataContent: data })
    });

    if (!response.ok) {
      throw new Error(`Pinata error: ${response.status}`);
    }

    const result = await response.json();
    return result.IpfsHash;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch('https://api.pinata.cloud/data/testAuthentication', {
        headers: { 'Authorization': `Bearer ${process.env.PINATA_JWT}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Similar implementations for InfuraService and Web3StorageService...
```

### UI Components

```typescript
// SyncStatusBanner.tsx - Persistent banner for blocked state
interface SyncStatusBannerProps {
  status: SyncQueueStatus;
  onForcSync: () => void;
  onClearQueue: () => void;
}

function SyncStatusBanner({ status, onForceSync, onClearQueue }: SyncStatusBannerProps) {
  if (!status.isBlocked) return null;

  return (
    <div className="bg-amber-500 text-black px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertTriangle size={20} />
        <span>
          Sync queue full ({status.queueCapacity.used}/{status.queueCapacity.max}).
          New changes blocked until synced.
        </span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onForceSync}
          disabled={!status.isOnline}
          className="bg-black text-white px-3 py-1 rounded text-sm"
        >
          {status.isOnline ? 'Sync Now' : 'Offline'}
        </button>
        <button
          onClick={onClearQueue}
          className="bg-red-700 text-white px-3 py-1 rounded text-sm"
        >
          Clear Queue
        </button>
      </div>
    </div>
  );
}

// SyncStatus.tsx - Status indicator for normal operation
function SyncStatus({ status }: { status: SyncQueueStatus }) {
  const getStatusIcon = () => {
    if (!status.isOnline) return <WifiOff className="text-gray-500" />;
    if (status.isSyncing) return <RefreshCw className="text-blue-500 animate-spin" />;
    if (status.pending > 0) return <Clock className="text-amber-500" />;
    return <CheckCircle className="text-green-500" />;
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      {getStatusIcon()}
      <span>
        {status.isSyncing && 'Syncing...'}
        {!status.isOnline && 'Offline'}
        {status.isOnline && !status.isSyncing && status.pending > 0 && `${status.pending} pending`}
        {status.isOnline && !status.isSyncing && status.pending === 0 && 'Synced'}
      </span>
      {status.deadLetter > 0 && (
        <span className="text-red-500">({status.deadLetter} failed)</span>
      )}
    </div>
  );
}
```

### Files to Modify
- New: `src/lib/sync/queue.ts` - Sync queue implementation
- New: `src/lib/sync/pinning.ts` - Multi-service pinning
- `src/lib/vault/manager.ts` - Integrate queue with write operations
- `src/lib/storage/indexeddb.ts` - Add sync queue and dead letter stores
- New: `src/components/dashboard/SyncStatus.tsx` - Status indicator
- New: `src/components/dashboard/SyncStatusBanner.tsx` - Blocked state banner
- New: `src/components/dashboard/DeadLetterQueue.tsx` - Failed operations UI

---

## Priority Matrix

| Specification | Impact | Effort | Priority |
|--------------|--------|--------|----------|
| MCP Server Authentication | High | Medium | **P0** |
| Sync Conflict Resolution | High | High | **P1** |
| Offline-First Sync Queue | Medium | Medium | **P1** |
| Key Management Recovery | High | High | **P2** |
| Smart Contract Upgradability | Medium | Medium | **P2** |

---

## Implementation Phases

### Phase 1: Security Foundation (P0)
1. Implement MCP authentication middleware
2. Add JWT key derivation with separate path
3. Implement audit logging
4. Deploy and test

### Phase 2: Reliability (P1)
1. Build sync queue with multi-pinning
2. Implement smart merge conflict resolution
3. Add BroadcastChannel tab sync
4. Build conflict resolution UI

### Phase 3: Resilience (P2)
1. Implement Shamir's Secret Sharing
2. Add guardian recovery to smart contract
3. Deploy upgradeable contract
4. Build recovery setup UI

---

## Appendix: Configuration Defaults

```typescript
const DEFAULT_CONFIG = {
  // Sync
  sync: {
    maxQueueSize: 1000,
    retryAttempts: 3,
    retryBackoffBase: 1000,
    retryBackoffMax: 300000,
    requiredPinServices: 2,
    totalPinServices: 3,
    pinningServices: ['pinata', 'infura', 'web3storage']
  },

  // Recovery
  recovery: {
    minGuardians: 3,
    maxGuardians: 5,
    minTimeLockHours: 24,
    defaultTimeLockHours: 72,
    shareExpiryDefault: null  // Optional
  },

  // Governance
  governance: {
    decentralizationThreshold: 500,
    multisigSize: 5,
    multisigThreshold: 3,
    upgradeTimelockHours: 48
  },

  // Audit
  audit: {
    maxLogEntries: 10000,
    logReadOperations: true,
    logWriteOperations: true,
    syncWithVault: true
  },

  // Dead Letter
  deadLetter: {
    ttlDays: 30,
    warningDays: 7
  },

  // Tab Sync
  tabSync: {
    heartbeatIntervalMs: 10000,
    inactiveTimeoutMs: 30000
  }
};
```

---

*This specification is approved and ready for implementation.*
