/**
 * Sync Types
 *
 * Type definitions for sync conflict detection and resolution.
 */

import {
    PortableProfile,
    MemoryFragment,
    Conversation,
    Message,
    UserInsight,
    SystemPreference,
    ProjectContext,
    AccessGrant
} from '@/lib/types';

// ============================================================
// Sync Metadata
// ============================================================

/**
 * Metadata for tracking sync state of entities.
 */
export interface SyncMetadata {
    version: number;
    lastModified: number;
    deviceId: string;
    vectorClock: Record<string, number>;
}

/**
 * Enhanced profile with sync metadata.
 */
export interface SyncableProfile extends PortableProfile {
    syncMetadata?: SyncMetadata;
    lastSyncedAt?: number;
}

// ============================================================
// Conflict Types
// ============================================================

export type ConflictEntityType =
    | 'memory'
    | 'conversation'
    | 'insight'
    | 'preference'
    | 'project'
    | 'grant'
    | 'identity';

export interface Conflict<T = unknown> {
    id: string;
    type: ConflictEntityType;
    entityId: string;
    localVersion: T;
    remoteVersion: T;
    autoMergeable: boolean;
    conflictingFields: string[];
    localModifiedAt: number;
    remoteModifiedAt: number;
    suggestedResolution?: 'local' | 'remote' | 'merge';
}

export interface MemoryConflict extends Conflict<MemoryFragment> {
    type: 'memory';
}

export interface ConversationConflict extends Conflict<Conversation> {
    type: 'conversation';
    messageConflicts?: MessageBlockConflict[];
}

export interface MessageBlockConflict {
    localMessages: Message[];
    remoteMessages: Message[];
    baseMessageId?: string;  // Last common message before divergence
}

export interface InsightConflict extends Conflict<UserInsight> {
    type: 'insight';
}

export interface PreferenceConflict extends Conflict<SystemPreference> {
    type: 'preference';
}

// ============================================================
// Resolution Types
// ============================================================

export type ResolutionChoice = 'local' | 'remote' | 'custom';

export interface Resolution {
    conflictId: string;
    choice: ResolutionChoice;
    customValue?: unknown;
    resolvedAt: number;
    resolvedBy: 'user' | 'auto';
}

export interface MergeResult {
    merged: PortableProfile;
    conflicts: Conflict[];
    autoResolved: number;
    stats: MergeStats;
}

export interface MergeStats {
    memoriesAdded: number;
    memoriesMerged: number;
    conversationsAdded: number;
    conversationsMerged: number;
    insightsAdded: number;
    insightsMerged: number;
    conflictsDetected: number;
    autoMerged: number;
}

// ============================================================
// Sync State
// ============================================================

export type SyncStatus =
    | 'idle'
    | 'syncing'
    | 'conflict'
    | 'error'
    | 'offline';

export interface SyncState {
    status: SyncStatus;
    lastSyncedAt: number | null;
    pendingConflicts: Conflict[];
    pendingResolutions: Resolution[];
    deviceId: string;
    error?: string;
}

// ============================================================
// Tab Sync Types
// ============================================================

export type TabMessageType =
    | 'heartbeat'
    | 'change'
    | 'conflict'
    | 'resolution'
    | 'lock_request'
    | 'lock_acquired'
    | 'lock_released';

export interface TabMessage {
    type: TabMessageType;
    tabId: string;
    timestamp: number;
    payload?: unknown;
}

export interface HeartbeatMessage extends TabMessage {
    type: 'heartbeat';
    hasWriteAuthority: boolean;
}

export interface ChangeMessage extends TabMessage {
    type: 'change';
    payload: {
        entityType: ConflictEntityType;
        entityId: string;
        operation: 'create' | 'update' | 'delete';
        data: unknown;
    };
}

export interface ConflictMessage extends TabMessage {
    type: 'conflict';
    payload: Conflict;
}

export interface TabState {
    tabId: string;
    lastHeartbeat: number;
    hasWriteAuthority: boolean;
    isActive: boolean;
}

// ============================================================
// Diff Types
// ============================================================

export interface FieldDiff {
    field: string;
    localValue: unknown;
    remoteValue: unknown;
    baseValue?: unknown;
}

export interface EntityDiff {
    entityId: string;
    entityType: ConflictEntityType;
    diffs: FieldDiff[];
    isNewLocal: boolean;
    isNewRemote: boolean;
    isDeleted: boolean;
}
