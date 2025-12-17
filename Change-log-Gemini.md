# Change Log - Gemini Refactoring

## Date: December 11, 2025

This document details the changes made to the Profile Vault codebase to optimize performance, enhance security, and improve code quality.

### 1. Large File Import Optimization

**Goal:** Prevent memory crashes when importing massive OpenAI exports (e.g., 500MB+ `conversations.json`).

* **Streaming Library:** Added `@streamparser/json-whatwg` for memory-efficient, SAX-style JSON parsing.
* **Base Importer:** Added `parseStream(stream: ReadableStream)` method to the `BaseImporter` class with a safe fallback for non-streaming importers.
* **OpenAI Importer:** Implemented `parseStream` in `OpenAIImporter` to process conversations one-by-one as they stream in from the file system, significantly reducing RAM usage.
* **Folder Import:** Updated `importOpenAIFolder` to pass the file stream to the importer instead of reading the entire text into memory.

### 2. Security Enhancements (SSE Transport)

**Goal:** Prevent sensitive data leaks in multi-client environments.

* **Targeted Routing:** Refactored `SseTransport` to map incoming `request.id` to the specific client `sessionId`.
* **Privacy:** Responses are now sent *only* to the client that made the request, rather than broadcasting to all connected clients.
* **Cleanup:** Implemented cleanup logic to remove session mappings when clients disconnect.

### 3. Code Quality Refactoring

**Goal:** Reduce complexity and improve maintainability of the import logic.

* **Helper Methods:** Decomposed the monolithic `OpenAIImporter.parseConversation` method into focused helper methods:
  * `traverseConversationTree(raw)`: Handles the BFS traversal of the conversation node tree.
  * `createVoiceSession(raw)`: Encapsulates voice session creation logic.
* **Complexity Reduction:** Significantly reduced the cyclomatic complexity of the main parsing logic.

### 4. Type Safety (MCP Protocol)

**Goal:** Improve robustness and developer experience with strict typing.

* **Handler Signatures:** Updated all request handlers in `ProfileMcpServer` to accept specific, strongly-typed request objects, eliminating unsafe `any` casts and ensuring correct parameter usage.

### 5. Miscellaneous

* **Configuration:** Updated `tsconfig.json` and imports to ensure clean builds.
* **Documentation:** Updated `task.md` and `walkthrough.md` to reflect progress and verification steps.

### 6. Decentralized Storage (IPFS & Blockchain)

**Goal:** Enable users to store their encrypted profile vault in a decentralized, sovereign manner using IPFS and Public Blockchains.

* **Blockchain Registry (`src/lib/services/registry.ts`):**
  * Implemented `MockRegistryService` to simulate Smart Contract interactions (mapping `DID` -> `CID`) without incurring gas fees during development.
  * Prepared interfaces for future `viem` implementation on Polygon.
* **Vault Manager (`src/lib/vault/manager.ts`):**
  * Added `syncToCloud(config)`: Orchestrates the flow of Export Encrypted Vault -> Upload to IPFS -> Update Registry.
  * Added `restoreFromCloud(did)`: Resolves the IPFS CID from the Registry using the user's DID, downloads the vault, and imports it.
* **Dependencies:** Added `viem` for robust blockchain interaction types and future connectivity.

### 7. Active Archival & Sync Tools

**Goal:** Allow AI models to actively save conversation history and sync to the cloud.

* **`archive_conversation` Tool:** Saves the current chat to the local Profile Vault.
* **`toggle_auto_archive` Tool:** Sets a preference for automatic archiving.
* **`sync_vault` Tool:** Triggers the *local-to-IPFS* synchronization process (requires `PINATA_JWT`).
  * This enables the AI to "Push to Cloud" immediately after archiving, ensuring the IPFS vault is always up to date.
* **`toggle_auto_sync` Tool:**
  * Enables/Disables the `Auto-Sync` preference.
  * **Automation:** When enabled, calling `archive_conversation` will *automatically* trigger a background cloud sync, creating a seamless "Save & Push" workflow.

### 8. Dashboard Timeline View

**Goal:** Provide a visual, time-based way to navigate conversation history.

* **TimelineView Component:** Replaced the static list with a scrollable timeline.
* **Zoom Levels:** Group events by Day, Week, or Month.
* **Filters:** Added checkboxes to toggle Chats / Memories visibility.
* **Scrubber UI:** Added a bottom timeline bar for visual navigation.
* **Event Cards:** Unified display for Conversation and Memories with distinct styling.

### 9. 3D "Mind Graph" View

**Goal:** Provide a relational view of the user's data (GraphRAG style).

* **Technology:** Integrated `react-force-graph-3d`.
* **Nodes:** User (White), Conversations (Purple), Memories (Green), Tags (Zinc).
  * **Filters:** Added checkboxes to toggle Conversations / Memories visibility (as requested).
  * **Default View:** Set to Mind Graph for immersive initial experience.
  * **Interactivity:**
  * 3D Rotate/Zoom.
  * Click nodes (logs to console for now).
  * Visual "particles" moving along links to show connection flow.

### 10. Dashboard Modernization & Simplification

**Goal:** Streamline the dashboard for a cleaner, modern look by removing complex visualizations and focusing on project context.

* **View Cleanup:** Removed the "Timeline" and "Mind Graph" views from the main dashboard to reduce visual clutter.
* **Context Selector:** Integrated the `ContextSelector` as the primary functional component, allowing users to switch between active Project Workspaces.
* **Code Simplification:** Removed unused imports (`react-force-graph-3d`, etc.) and internal state related to view switching.

### 11. Decentralized Storage (IPFS) Finalization

**Goal:** Enable active syncing of the Profile Vault to the decentralized web.

* **Pinata Integration:** Configured `PinataService` with valid JWT credentials.
* **Verification:** Verified successful upload to IPFS network via automated script.
* **Environment:** Created `.env.local` to securely store API secrets.

### 12. Architecture Upgrade: Registry & Access Control

**Goal:** Move towards a truly decentralized and secure architecture.

* **Smart Contract Registry:** Implemented `ProfileRegistry.sol` and `PolygonRegistryService` to replace the mock registry. This enables decentralized profile discovery.
* **Granular Access Control:** Implemented cryptographic signing for `AccessGrant` objects.
* **New Tool:** Added `grant_access` MCP tool, allowing the AI to generate signed permission tokens for specific agents.

### 13. Frontend Wallet Integration

**Goal:** Provide a user interface for connecting a crypto wallet and updating the on-chain registry.

* **Connect Wallet:** Added a `ConnectWallet` component that allows users to link their MetaMask (or EVM) wallet.
* **Publish to Chain:** Added a "Publish to Chain" button in the dashboard. This triggers a transaction to the `ProfileRegistry` smart contract, linking the user's wallet address to their IPFS Vault CID.
* **Deployment Guide:** Created `deployment_guide.md` to assist users in manually deploying the registry contract via Remix.

### 14. Project Rebranding: Identity Report

**Goal:** Pivot the project branding from "Profile Vault" to "Identity Report" and establish a definitive, high-quality aesthetic.

* **Rebranding:** Renamed the project across all files, including `package.json`, `layout.tsx`, and the Sidebar component.
* **Minimalist UI Overhaul:** Adopted the Context7 "Stone & Dodger Blue" light theme. Cleaned up all glassmorphism and dark mode artifacts for a premium, solid look.
* **Documentation Overhaul:** Rewrote the `README.md` to include high-quality badges, a newly generated cover image, and deep architectural details (IPFS flow, Polygon Registry).
* **Cover Graphic:** Generated a 1500x500 hero graphic for the project using AI to match the minimalist branding.

### 15. Git Cleanup & Repository Finalization

**Goal:** Prepare the project for a secure and clean public release.

* **History Scrubbing:** Removed accidentally leaked OpenAI API keys and large local data files (`realProfile.json`) from the codebase.
* **Repository Re-initialization:** Re-initialized the Git repository to purge history of sensitive data and unwanted large commits.
* **Optimized .gitignore:** Updated `.gitignore` to strictly exclude large datasets, logs, and sensitive `.env` patterns.
* **GitHub Push:** Successfully created and pushed the clean repository to the [shihwesley/identity-report](https://github.com/shihwesley/identity-report) repository.

### 16. DevOps & Railway Cloud Hosting

**Goal:** Automate the build process and provide a professional cloud hosting pathway.

* **Dockerization**: Created a multi-stage `Dockerfile` to serve both the Next.js UI and the MCP SSE server in a production-ready alpine container.
* **GitHub Actions**: 
    - **CI**: Runs linting and build checks on pull requests.
    - **CD**: Builds and pushes production Docker images to **GitHub Container Registry (GHCR)** on every push to `main`.
* **Railway Optimization**: Documented a **Multi-Service** deployment strategy on [Railway.app](https://railway.app/) for independent scaling of the UI and MCP components.
* **Standlone MCP Build**: Configured `esbuild` for the MCP server to ensure reliable, zero-dependency production builds.
