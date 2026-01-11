/**
 * Smart Merge Logic
 *
 * Implements intelligent conflict detection and auto-merging for profile sync.
 * Auto-merges non-conflicting fields, surfaces true conflicts for user resolution.
 */

import {
    PortableProfile,
    MemoryFragment,
    Conversation,
    Message,
    UserInsight,
    SystemPreference,
    ProjectContext,
    AccessGrant,
    UserIdentity
} from '@/lib/types';

import {
    Conflict,
    ConflictEntityType,
    MergeResult,
    MergeStats,
    MemoryConflict,
    ConversationConflict,
    MessageBlockConflict,
    InsightConflict,
    FieldDiff,
    SyncMetadata
} from './types';

// ============================================================
// Main Merge Function
// ============================================================

/**
 * Smart merge two profiles, auto-merging non-conflicting changes
 * and returning conflicts that need user resolution.
 */
export async function smartMerge(
    local: PortableProfile,
    remote: PortableProfile,
    base?: PortableProfile
): Promise<MergeResult> {
    const conflicts: Conflict[] = [];
    const merged = structuredClone(local);
    const stats: MergeStats = {
        memoriesAdded: 0,
        memoriesMerged: 0,
        conversationsAdded: 0,
        conversationsMerged: 0,
        insightsAdded: 0,
        insightsMerged: 0,
        conflictsDetected: 0,
        autoMerged: 0
    };

    // Merge identity (simple field-level merge)
    const identityConflicts = mergeIdentity(merged, local.identity, remote.identity, base?.identity);
    if (identityConflicts.length > 0) {
        conflicts.push(...identityConflicts);
        stats.conflictsDetected += identityConflicts.length;
    }

    // Merge memories (short-term + long-term)
    const memoryResult = mergeMemories(
        merged,
        [...local.shortTermMemory, ...local.longTermMemory],
        [...remote.shortTermMemory, ...remote.longTermMemory],
        base ? [...base.shortTermMemory, ...base.longTermMemory] : undefined
    );
    conflicts.push(...memoryResult.conflicts);
    stats.memoriesAdded += memoryResult.added;
    stats.memoriesMerged += memoryResult.merged;
    stats.conflictsDetected += memoryResult.conflicts.length;
    stats.autoMerged += memoryResult.autoMerged;

    // Merge conversations (with block-based message merging)
    const conversationResult = mergeConversations(
        merged,
        local.conversations,
        remote.conversations,
        base?.conversations
    );
    conflicts.push(...conversationResult.conflicts);
    stats.conversationsAdded += conversationResult.added;
    stats.conversationsMerged += conversationResult.merged;
    stats.conflictsDetected += conversationResult.conflicts.length;
    stats.autoMerged += conversationResult.autoMerged;

    // Merge insights
    const insightResult = mergeInsights(
        merged,
        local.insights,
        remote.insights,
        base?.insights
    );
    conflicts.push(...insightResult.conflicts);
    stats.insightsAdded += insightResult.added;
    stats.insightsMerged += insightResult.merged;
    stats.conflictsDetected += insightResult.conflicts.length;
    stats.autoMerged += insightResult.autoMerged;

    // Merge preferences
    const prefResult = mergePreferences(merged, local.preferences, remote.preferences);
    conflicts.push(...prefResult.conflicts);
    stats.autoMerged += prefResult.autoMerged;

    // Merge projects
    const projectResult = mergeProjects(merged, local.projects, remote.projects);
    conflicts.push(...projectResult.conflicts);
    stats.autoMerged += projectResult.autoMerged;

    // Merge active grants (union, don't conflict)
    mergeGrants(merged, local.activeGrants, remote.activeGrants);

    return {
        merged,
        conflicts,
        autoResolved: stats.autoMerged,
        stats
    };
}

// ============================================================
// Identity Merge
// ============================================================

function mergeIdentity(
    merged: PortableProfile,
    local: UserIdentity,
    remote: UserIdentity,
    base?: UserIdentity
): Conflict[] {
    const conflicts: Conflict[] = [];
    const conflictingFields: string[] = [];

    const fields: (keyof UserIdentity)[] = ['displayName', 'fullName', 'email', 'location', 'role', 'avatarUrl'];

    for (const field of fields) {
        const localVal = local[field];
        const remoteVal = remote[field];
        const baseVal = base?.[field];

        if (localVal === remoteVal) {
            // No conflict
            continue;
        }

        if (base) {
            // Three-way merge
            if (localVal === baseVal) {
                // Only remote changed - take remote
                (merged.identity as any)[field] = remoteVal;
            } else if (remoteVal === baseVal) {
                // Only local changed - keep local
                continue;
            } else {
                // Both changed differently - conflict
                conflictingFields.push(field);
            }
        } else {
            // Two-way merge - if different, it's a conflict
            if (localVal !== remoteVal && localVal && remoteVal) {
                conflictingFields.push(field);
            } else if (!localVal && remoteVal) {
                // Local empty, remote has value - take remote
                (merged.identity as any)[field] = remoteVal;
            }
        }
    }

    if (conflictingFields.length > 0) {
        conflicts.push({
            id: `identity-conflict-${Date.now()}`,
            type: 'identity',
            entityId: 'identity',
            localVersion: local,
            remoteVersion: remote,
            autoMergeable: false,
            conflictingFields,
            localModifiedAt: Date.now(),
            remoteModifiedAt: Date.now(),
            suggestedResolution: 'local'
        });
    }

    return conflicts;
}

// ============================================================
// Memory Merge
// ============================================================

interface EntityMergeResult<T> {
    conflicts: Conflict[];
    added: number;
    merged: number;
    autoMerged: number;
}

function mergeMemories(
    merged: PortableProfile,
    localMemories: MemoryFragment[],
    remoteMemories: MemoryFragment[],
    baseMemories?: MemoryFragment[]
): EntityMergeResult<MemoryFragment> {
    const conflicts: Conflict[] = [];
    let added = 0;
    let mergedCount = 0;
    let autoMerged = 0;

    const localMap = new Map(localMemories.map(m => [m.id, m]));
    const baseMap = baseMemories ? new Map(baseMemories.map(m => [m.id, m])) : null;
    const allMemories = new Map(localMemories.map(m => [m.id, m]));

    for (const remoteMemory of remoteMemories) {
        const localMemory = localMap.get(remoteMemory.id);
        const baseMemory = baseMap?.get(remoteMemory.id);

        if (!localMemory) {
            // New remote memory - add it
            allMemories.set(remoteMemory.id, remoteMemory);
            added++;
            continue;
        }

        // Check for conflicts
        const conflictFields = detectMemoryConflicts(localMemory, remoteMemory, baseMemory);

        if (conflictFields.length === 0) {
            // No conflict - auto-merge by taking newer or combining
            const mergedMemory = autoMergeMemory(localMemory, remoteMemory, baseMemory);
            allMemories.set(remoteMemory.id, mergedMemory);
            autoMerged++;
            mergedCount++;
        } else {
            // True conflict - needs user resolution
            conflicts.push({
                id: `memory-${remoteMemory.id}-${Date.now()}`,
                type: 'memory',
                entityId: remoteMemory.id,
                localVersion: localMemory,
                remoteVersion: remoteMemory,
                autoMergeable: false,
                conflictingFields: conflictFields,
                localModifiedAt: new Date(localMemory.timestamp).getTime(),
                remoteModifiedAt: new Date(remoteMemory.timestamp).getTime(),
                suggestedResolution: suggestResolution(localMemory, remoteMemory)
            } as MemoryConflict);
        }
    }

    // Distribute back to short-term and long-term
    const allMemoriesArray = Array.from(allMemories.values())
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    merged.shortTermMemory = allMemoriesArray.slice(0, 50);
    merged.longTermMemory = allMemoriesArray.slice(50);

    return { conflicts, added, merged: mergedCount, autoMerged };
}

function detectMemoryConflicts(
    local: MemoryFragment,
    remote: MemoryFragment,
    base?: MemoryFragment
): string[] {
    const conflictFields: string[] = [];

    // Content is the main field that can conflict
    if (local.content !== remote.content) {
        if (base) {
            if (local.content !== base.content && remote.content !== base.content) {
                // Both changed content
                conflictFields.push('content');
            }
        } else {
            conflictFields.push('content');
        }
    }

    // Tags can be merged (union)
    // Type conflicts are rare but possible
    if (local.type !== remote.type) {
        if (!base || (local.type !== base.type && remote.type !== base.type)) {
            conflictFields.push('type');
        }
    }

    // Confidence - take higher or average, not a conflict
    // Source info - generally doesn't conflict

    return conflictFields;
}

function autoMergeMemory(
    local: MemoryFragment,
    remote: MemoryFragment,
    base?: MemoryFragment
): MemoryFragment {
    // Start with local as base
    const merged = { ...local };

    // Merge tags (union)
    const allTags = new Set([...local.tags, ...remote.tags]);
    merged.tags = Array.from(allTags);

    // Take higher confidence
    merged.confidence = Math.max(local.confidence, remote.confidence);

    // If only remote changed content, take it
    if (base && local.content === base.content && remote.content !== base.content) {
        merged.content = remote.content;
    }

    // Update timestamp to most recent
    const localTime = new Date(local.timestamp).getTime();
    const remoteTime = new Date(remote.timestamp).getTime();
    if (remoteTime > localTime) {
        merged.timestamp = remote.timestamp;
    }

    return merged;
}

function suggestResolution(local: MemoryFragment, remote: MemoryFragment): 'local' | 'remote' {
    const localTime = new Date(local.timestamp).getTime();
    const remoteTime = new Date(remote.timestamp).getTime();
    return remoteTime > localTime ? 'remote' : 'local';
}

// ============================================================
// Conversation Merge (Block-Based)
// ============================================================

function mergeConversations(
    merged: PortableProfile,
    localConversations: Conversation[],
    remoteConversations: Conversation[],
    baseConversations?: Conversation[]
): EntityMergeResult<Conversation> {
    const conflicts: Conflict[] = [];
    let added = 0;
    let mergedCount = 0;
    let autoMerged = 0;

    const localMap = new Map(localConversations.map(c => [c.id, c]));
    const baseMap = baseConversations ? new Map(baseConversations.map(c => [c.id, c])) : null;
    const allConversations = new Map(localConversations.map(c => [c.id, c]));

    for (const remoteConv of remoteConversations) {
        const localConv = localMap.get(remoteConv.id);
        const baseConv = baseMap?.get(remoteConv.id);

        if (!localConv) {
            // New remote conversation - add it
            allConversations.set(remoteConv.id, remoteConv);
            added++;
            continue;
        }

        // Check if messages diverged
        const messageResult = mergeConversationMessages(localConv, remoteConv, baseConv);

        if (messageResult.hasConflict) {
            conflicts.push({
                id: `conversation-${remoteConv.id}-${Date.now()}`,
                type: 'conversation',
                entityId: remoteConv.id,
                localVersion: localConv,
                remoteVersion: remoteConv,
                autoMergeable: false,
                conflictingFields: ['messages'],
                localModifiedAt: localConv.metadata.updatedAt,
                remoteModifiedAt: remoteConv.metadata.updatedAt,
                messageConflicts: messageResult.messageConflicts,
                suggestedResolution: 'merge'
            } as ConversationConflict);
        } else {
            // Auto-merged successfully
            const mergedConv = {
                ...localConv,
                messages: messageResult.mergedMessages,
                metadata: {
                    ...localConv.metadata,
                    updatedAt: Math.max(localConv.metadata.updatedAt, remoteConv.metadata.updatedAt),
                    messageCount: messageResult.mergedMessages.length
                },
                tags: Array.from(new Set([...localConv.tags, ...remoteConv.tags]))
            };
            allConversations.set(remoteConv.id, mergedConv);
            autoMerged++;
            mergedCount++;
        }
    }

    merged.conversations = Array.from(allConversations.values());

    return { conflicts, added, merged: mergedCount, autoMerged };
}

/**
 * Merge conversation messages using block-based approach.
 * Messages are appended as blocks, not interleaved by timestamp.
 */
function mergeConversationMessages(
    local: Conversation,
    remote: Conversation,
    base?: Conversation
): {
    hasConflict: boolean;
    mergedMessages: Message[];
    messageConflicts?: MessageBlockConflict[];
} {
    const baseMessageIds = base
        ? new Set(base.messages.map(m => m.id))
        : findCommonMessages(local.messages, remote.messages);

    // Find messages added after the common base
    const localNewMessages = local.messages.filter(m => !baseMessageIds.has(m.id));
    const remoteNewMessages = remote.messages.filter(m => !baseMessageIds.has(m.id));

    // If both added messages, we need to merge as blocks
    if (localNewMessages.length > 0 && remoteNewMessages.length > 0) {
        // Check if any messages are the same (already synced)
        const localNewIds = new Set(localNewMessages.map(m => m.id));
        const trulyNewRemote = remoteNewMessages.filter(m => !localNewIds.has(m.id));

        if (trulyNewRemote.length === 0) {
            // All remote messages already in local
            return {
                hasConflict: false,
                mergedMessages: local.messages
            };
        }

        // Append remote messages as a block after local messages
        const baseMessages = local.messages.filter(m => baseMessageIds.has(m.id));
        const mergedMessages: Message[] = [
            ...baseMessages,
            ...localNewMessages.map(m => ({ ...m, _syncBlock: 'local' as const })),
            ...trulyNewRemote.map(m => ({ ...m, _syncBlock: 'remote' as const }))
        ];

        // This is a successful block merge, not a conflict
        return {
            hasConflict: false,
            mergedMessages
        };
    }

    // Only one side added messages - straightforward merge
    if (remoteNewMessages.length > 0 && localNewMessages.length === 0) {
        return {
            hasConflict: false,
            mergedMessages: [...local.messages, ...remoteNewMessages]
        };
    }

    // No new messages on either side, or only local has new
    return {
        hasConflict: false,
        mergedMessages: local.messages
    };
}

function findCommonMessages(local: Message[], remote: Message[]): Set<string> {
    const localIds = new Set(local.map(m => m.id));
    const remoteIds = new Set(remote.map(m => m.id));

    const common = new Set<string>();
    for (const id of localIds) {
        if (remoteIds.has(id)) {
            common.add(id);
        }
    }
    return common;
}

// ============================================================
// Insight Merge
// ============================================================

function mergeInsights(
    merged: PortableProfile,
    localInsights: UserInsight[],
    remoteInsights: UserInsight[],
    baseInsights?: UserInsight[]
): EntityMergeResult<UserInsight> {
    const conflicts: Conflict[] = [];
    let added = 0;
    let mergedCount = 0;
    let autoMerged = 0;

    const localMap = new Map(localInsights.map(i => [i.id, i]));
    const allInsights = new Map(localInsights.map(i => [i.id, i]));

    for (const remoteInsight of remoteInsights) {
        const localInsight = localMap.get(remoteInsight.id);

        if (!localInsight) {
            allInsights.set(remoteInsight.id, remoteInsight);
            added++;
            continue;
        }

        // Check for content conflicts
        if (localInsight.content !== remoteInsight.content) {
            // Both have different content - check timestamps
            if (localInsight.updatedAt !== remoteInsight.updatedAt) {
                // Take the newer one
                if (remoteInsight.updatedAt > localInsight.updatedAt) {
                    allInsights.set(remoteInsight.id, remoteInsight);
                }
                autoMerged++;
                mergedCount++;
            } else {
                // Same timestamp, different content - true conflict
                conflicts.push({
                    id: `insight-${remoteInsight.id}-${Date.now()}`,
                    type: 'insight',
                    entityId: remoteInsight.id,
                    localVersion: localInsight,
                    remoteVersion: remoteInsight,
                    autoMergeable: false,
                    conflictingFields: ['content'],
                    localModifiedAt: localInsight.updatedAt,
                    remoteModifiedAt: remoteInsight.updatedAt,
                    suggestedResolution: 'remote'
                } as InsightConflict);
            }
        } else {
            // Same content - merge derived sources and confidence
            const mergedInsight = {
                ...localInsight,
                derivedFrom: Array.from(new Set([...localInsight.derivedFrom, ...remoteInsight.derivedFrom])),
                confidence: Math.max(localInsight.confidence, remoteInsight.confidence)
            };
            allInsights.set(remoteInsight.id, mergedInsight);
            autoMerged++;
        }
    }

    merged.insights = Array.from(allInsights.values());

    return { conflicts, added, merged: mergedCount, autoMerged };
}

// ============================================================
// Preference Merge
// ============================================================

function mergePreferences(
    merged: PortableProfile,
    localPrefs: SystemPreference[],
    remotePrefs: SystemPreference[]
): EntityMergeResult<SystemPreference> {
    const conflicts: Conflict[] = [];
    let autoMerged = 0;

    const localMap = new Map(localPrefs.map(p => [p.id, p]));
    const allPrefs = new Map(localPrefs.map(p => [p.id, p]));

    for (const remotePref of remotePrefs) {
        const localPref = localMap.get(remotePref.id);

        if (!localPref) {
            allPrefs.set(remotePref.id, remotePref);
            continue;
        }

        // Check if values differ
        if (localPref.value !== remotePref.value || localPref.isEnabled !== remotePref.isEnabled) {
            // Preferences are usually user-set, so this is a conflict
            conflicts.push({
                id: `preference-${remotePref.id}-${Date.now()}`,
                type: 'preference',
                entityId: remotePref.id,
                localVersion: localPref,
                remoteVersion: remotePref,
                autoMergeable: false,
                conflictingFields: ['value', 'isEnabled'].filter(f =>
                    (localPref as any)[f] !== (remotePref as any)[f]
                ),
                localModifiedAt: Date.now(),
                remoteModifiedAt: Date.now(),
                suggestedResolution: 'local'
            });
        } else {
            autoMerged++;
        }
    }

    merged.preferences = Array.from(allPrefs.values());

    return { conflicts, added: 0, merged: 0, autoMerged };
}

// ============================================================
// Project Merge
// ============================================================

function mergeProjects(
    merged: PortableProfile,
    localProjects: ProjectContext[],
    remoteProjects: ProjectContext[]
): EntityMergeResult<ProjectContext> {
    const conflicts: Conflict[] = [];
    let autoMerged = 0;

    const localMap = new Map(localProjects.map(p => [p.id, p]));
    const allProjects = new Map(localProjects.map(p => [p.id, p]));

    for (const remoteProject of remoteProjects) {
        const localProject = localMap.get(remoteProject.id);

        if (!localProject) {
            allProjects.set(remoteProject.id, remoteProject);
            continue;
        }

        // Auto-merge tech stack and related memories
        const mergedProject = {
            ...localProject,
            techStack: Array.from(new Set([...localProject.techStack, ...remoteProject.techStack])),
            relatedMemories: Array.from(new Set([...localProject.relatedMemories, ...remoteProject.relatedMemories]))
        };

        // Check for description/name conflicts
        if (localProject.name !== remoteProject.name || localProject.description !== remoteProject.description) {
            conflicts.push({
                id: `project-${remoteProject.id}-${Date.now()}`,
                type: 'project',
                entityId: remoteProject.id,
                localVersion: localProject,
                remoteVersion: remoteProject,
                autoMergeable: false,
                conflictingFields: ['name', 'description'].filter(f =>
                    (localProject as any)[f] !== (remoteProject as any)[f]
                ),
                localModifiedAt: Date.now(),
                remoteModifiedAt: Date.now(),
                suggestedResolution: 'local'
            });
        } else {
            allProjects.set(remoteProject.id, mergedProject);
            autoMerged++;
        }
    }

    merged.projects = Array.from(allProjects.values());

    return { conflicts, added: 0, merged: 0, autoMerged };
}

// ============================================================
// Grant Merge (Union - no conflicts)
// ============================================================

function mergeGrants(
    merged: PortableProfile,
    localGrants: AccessGrant[],
    remoteGrants: AccessGrant[]
): void {
    const allGrants = new Map(localGrants.map(g => [g.id, g]));

    for (const remoteGrant of remoteGrants) {
        if (!allGrants.has(remoteGrant.id)) {
            // Only add if not expired
            if (remoteGrant.expiresAt > Date.now()) {
                allGrants.set(remoteGrant.id, remoteGrant);
            }
        }
    }

    // Filter out expired grants
    merged.activeGrants = Array.from(allGrants.values())
        .filter(g => g.expiresAt > Date.now());
}

// ============================================================
// Conflict Resolution
// ============================================================

/**
 * Apply a resolution to a conflict.
 */
export function applyResolution<T>(
    conflict: Conflict<T>,
    resolution: 'local' | 'remote' | 'custom',
    customValue?: T
): T {
    switch (resolution) {
        case 'local':
            return conflict.localVersion;
        case 'remote':
            return conflict.remoteVersion;
        case 'custom':
            if (!customValue) {
                throw new Error('Custom resolution requires a custom value');
            }
            return customValue;
        default:
            throw new Error(`Unknown resolution: ${resolution}`);
    }
}

/**
 * Apply multiple resolutions to a merge result.
 */
export function applyResolutions(
    profile: PortableProfile,
    conflicts: Conflict[],
    resolutions: Map<string, { choice: 'local' | 'remote' | 'custom'; customValue?: unknown }>
): PortableProfile {
    const result = structuredClone(profile);

    for (const conflict of conflicts) {
        const resolution = resolutions.get(conflict.id);
        if (!resolution) continue;

        const resolved = applyResolution(conflict, resolution.choice, resolution.customValue);

        switch (conflict.type) {
            case 'memory':
                updateInArray(result.shortTermMemory, conflict.entityId, resolved as MemoryFragment) ||
                updateInArray(result.longTermMemory, conflict.entityId, resolved as MemoryFragment);
                break;
            case 'conversation':
                updateInArray(result.conversations, conflict.entityId, resolved as Conversation);
                break;
            case 'insight':
                updateInArray(result.insights, conflict.entityId, resolved as UserInsight);
                break;
            case 'preference':
                updateInArray(result.preferences, conflict.entityId, resolved as SystemPreference);
                break;
            case 'project':
                updateInArray(result.projects, conflict.entityId, resolved as ProjectContext);
                break;
            case 'identity':
                result.identity = resolved as UserIdentity;
                break;
        }
    }

    return result;
}

function updateInArray<T extends { id: string }>(arr: T[], id: string, item: T): boolean {
    const idx = arr.findIndex(x => x.id === id);
    if (idx >= 0) { arr[idx] = item; return true; }
    return false;
}
