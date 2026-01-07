# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Identity Report is a local-first, privacy-preserving identity management system that enables users to own, control, and port their AI context across different providers. It combines cryptographic identity (DID), encrypted storage (AES-256-GCM), decentralized backup (IPFS), and blockchain-based discovery (Polygon Amoy).

## Common Commands

```bash
# Development
npm run dev              # Start Next.js dev server on :3000

# Build
npm run build            # Build Next.js app (runs prebuild automatically)
npm run build:mcp        # Bundle MCP server with esbuild to dist/server.js

# Production
npm run start            # Start Next.js production server
npm run start:mcp        # Start MCP server on :3001 (SSE transport)

# Linting
npm run lint             # Run ESLint
```

### Docker

```bash
docker build -t identity-report .
docker run -p 3000:3000 -p 3001:3001 identity-report
```

## Architecture

### Core Data Flow

```
AI Exports (OpenAI/Claude/Gemini) → Importers → VaultManager → Smart Merge
    → Tab Sync (BroadcastChannel) → Sync Queue → IPFS Pinning
    → Registry (Polygon) ← MCP Server (SSE/STDIO) ← AI Clients
```

### Key Modules

| Module | Location | Purpose |
|--------|----------|---------|
| **Identity** | `src/lib/vault/identity.ts` | BIP39 mnemonic, Ed25519 keys, DID generation, PBKDF2 key derivation |
| **Vault Manager** | `src/lib/vault/manager.ts` | Central orchestrator: encryption, sync, access grants |
| **MCP Server** | `src/lib/mcp/server.ts` | Transport-agnostic MCP protocol (SSE for cloud, STDIO for local) |
| **Transports** | `src/lib/mcp/transports/` | Factory pattern: `SseTransport`, `StdioTransport` |
| **Auth** | `src/lib/mcp/auth.ts` | JWT verification, scope-based permissions |
| **Audit** | `src/lib/mcp/audit.ts` | Logging with sensitive data scrubbing |
| **Sync** | `src/lib/sync/` | Three-way merge, multi-tab coordination, offline queue |
| **Recovery** | `src/lib/recovery/` | Shamir's Secret Sharing, guardian management |
| **Importers** | `src/lib/importers/` | Streaming parsers for OpenAI, Claude, Gemini exports |
| **Registry** | `src/lib/services/registry.ts` | Polygon contract interaction via viem |

### MCP Resources & Tools

**Resources**: `profile://identity`, `profile://memories`, `profile://projects`, `profile://conversations`, `profile://conversation/{id}`

**Tools**: `search_memory`, `add_memory`, `get_conversation_history`, `get_context_for_task`, `archive_conversation`, `grant_access`, `sync_vault`

### Sync System

- **Tab Sync**: `BroadcastChannel` API for multi-tab coordination. Most recent active tab has write authority (heartbeat-based).
- **Conflict Resolution**: Three-way merge (base, local, remote). Auto-merges non-conflicting field changes; surfaces true conflicts to UI.
- **Offline Queue**: Blocks new writes if queue exceeds limit. Dequeues when connection restored.
- **Pinning**: Multi-service redundancy (requires 2 of 3: Pinata, Estuary, NFT.storage).

### Identity & Cryptography

```
Mnemonic (BIP39) → SHA-256 → Ed25519 Private Key → Public Key → did:key:z...
Mnemonic + Password → PBKDF2 (100k iterations) → AES-256-GCM Key
```

Two-factor protection: mnemonic (something you have) + password (something you know).

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `PINATA_JWT` | IPFS pinning authentication |
| `MCP_TRANSPORT` | `sse` or `stdio` |
| `MCP_PORT` | MCP server port (default 3001) |
| `NEXT_PUBLIC_RPC_URL` | Polygon Amoy RPC endpoint |
| `NEXT_PUBLIC_REGISTRY_ADDRESS` | Deployed ProfileRegistry contract |

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19
- **Styling**: Tailwind CSS 4
- **Web3**: viem 2.41 (Polygon interaction)
- **Crypto**: @noble/ed25519, @noble/hashes, bip39
- **Build**: esbuild (MCP bundling)
- **Visualization**: react-force-graph-3d, three.js

## Project Structure

```
src/
├── app/                    # Next.js routes (/, /import, /memory, /profile, /chat, /connect, /onboarding)
├── components/dashboard/   # Dashboard UI (IdentityCard, SyncStatus, ConflictResolution, RecoverySetup)
├── lib/
│   ├── vault/             # identity.ts, manager.ts, crypto.ts
│   ├── mcp/               # server.ts, auth.ts, audit.ts, transports/
│   ├── sync/              # merge.ts, tabs.ts, queue.ts, pinning.ts
│   ├── recovery/          # shamir.ts, guardian.ts, monitor.ts
│   ├── importers/         # openai.ts, claude.ts, gemini.ts, base.ts
│   ├── services/          # ipfs.ts, registry.ts, summarizer.ts
│   └── storage/           # indexeddb.ts
contracts/                  # ProfileRegistry.sol, ProfileRegistryV2.sol (UUPS upgradeable)
scripts/                    # deploy-upgradeable.ts, upgrade-registry.ts
dist/                       # Bundled MCP server output
```

## Deployment

Railway multi-service: UI on port 3000 (`npm start`), MCP on port 3001 (`npm start:mcp`).

**Live URLs**:
- Dashboard: `https://identity-report.up.railway.app`
- MCP SSE: `https://identity-report-mcp.up.railway.app/sse`

### Claude Desktop Config

```json
{
  "mcpServers": {
    "identity-report": {
      "command": "npx",
      "args": ["@modelcontextprotocol/client-sse", "https://identity-report-mcp.up.railway.app/sse"]
    }
  }
}
```
