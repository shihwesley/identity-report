# Code Simplification Log

**Date:** 2026-01-10
**Tool:** TLDR-aware code simplifier

---

## Summary

Surveyed 108 TypeScript files using AST summaries, identified simplification opportunities, and applied targeted improvements.

---

## Changes Made

### 1. merge.ts - Generic Update Helper

**File:** `src/lib/sync/merge.ts`
**Lines changed:** 751-789 → 751-756
**Savings:** ~35 lines

**Before:** 5 nearly identical functions
```typescript
function updateMemoryInProfile(profile, id, memory) { ... }
function updateConversationInProfile(profile, id, conversation) { ... }
function updateInsightInProfile(profile, id, insight) { ... }
function updatePreferenceInProfile(profile, id, preference) { ... }
function updateProjectInProfile(profile, id, project) { ... }
```

**After:** 1 generic helper
```typescript
function updateInArray<T extends { id: string }>(arr: T[], id: string, item: T): boolean {
    const idx = arr.findIndex(x => x.id === id);
    if (idx >= 0) { arr[idx] = item; return true; }
    return false;
}
```

---

### 2. Unused Imports Cleanup

| File | Removed |
|------|---------|
| `src/app/connect/page.tsx` | `Zap`, `Search`, `AlertCircle` |
| `src/app/import/page.tsx` | `ShieldCheck`, `Search` |
| `scripts/import-user-data.ts` | `path`, `Conversation`, `MemoryFragment` |

---

### 3. Type Safety Improvements

**connect/page.tsx**
- Added `McpResponse` interface for MCP server responses
- Changed `response: any` → `response: McpResponse | null`
- Changed `data: any` → `data: unknown`

**chat/page.tsx**
- Changed `as any` → `as typeof activeModel` for model selection

---

### 4. React/JSX Fixes

**onboarding/page.tsx**
- Removed unused `e` parameters from catch blocks
- Escaped apostrophes: `I've` → `I&apos;ve`, `You'll` → `You&apos;ll`

---

## Not Changed (By Design)

### Duplicate PinataService Classes

Two `PinataService` classes exist but serve different purposes:

| File | Purpose | Endpoint |
|------|---------|----------|
| `src/lib/services/ipfs.ts` | Blob/file uploads | `pinFileToIPFS` |
| `src/lib/sync/pinning.ts` | JSON pinning with redundancy | `pinJSONToIPFS` |

These implement different interfaces (`StorageProvider` vs `PinningService`) and are used in different contexts. Consolidation would add complexity.

---

## Remaining Lint Warnings

These require deeper architectural changes:

- `<img>` → `<Image>` migrations (Next.js optimization)
- Web3/wallet `any` types (need viem/ethers type definitions)
- Unused component props (may be intentional for future use)
