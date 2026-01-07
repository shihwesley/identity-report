/**
 * Unit tests for the Smart Merge Logic
 * Tests three-way merge algorithm, conflict detection, and auto-merging
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { smartMerge, applyResolution, applyResolutions } from '@/lib/sync/merge';
import { SYNC_SCENARIOS, MOCK_PROFILES } from '@fixtures/test-vectors';
import type {
    PortableProfile,
    MemoryFragment,
    Conversation,
    Message,
    UserInsight,
    SystemPreference,
    ProjectContext,
    UserIdentity,
    AccessGrant
} from '@/lib/types';
import type { Conflict } from '@/lib/sync/types';

// ============================================================
// Test Fixtures
// ============================================================

const createBaseProfile = (): PortableProfile => ({
    identity: {
        displayName: 'Alice',
        fullName: 'Alice Smith',
        email: 'alice@example.com',
        location: 'New York',
        role: 'Engineer'
    },
    preferences: [
        { id: 'pref-1', key: 'theme', value: 'dark', category: 'output_style', isEnabled: true },
        { id: 'pref-2', key: 'language', value: 'en', category: 'communication', isEnabled: true }
    ],
    shortTermMemory: [
        {
            id: 'mem-1',
            timestamp: '2024-01-01T10:00:00Z',
            content: 'Working on identity system',
            tags: ['work', 'identity'],
            type: 'technical',
            sourceModel: 'gpt-4',
            sourceProvider: 'openai',
            confidence: 0.9,
            conversationId: 'conv-1'
        }
    ],
    longTermMemory: [
        {
            id: 'mem-long-1',
            timestamp: '2023-06-01T00:00:00Z',
            content: 'Expertise in cryptography',
            tags: ['expertise', 'crypto'],
            type: 'technical',
            sourceModel: 'claude-3',
            sourceProvider: 'anthropic',
            confidence: 0.95
        }
    ],
    projects: [
        {
            id: 'proj-1',
            name: 'IdentityReport',
            description: 'Privacy-preserving identity management',
            techStack: ['TypeScript', 'React'],
            relatedMemories: ['mem-1']
        }
    ],
    conversations: [
        {
            id: 'conv-1',
            title: 'Architecture Discussion',
            messages: [
                { id: 'msg-1', role: 'user', content: 'How should we structure the vault?', timestamp: 1704067200000 },
                { id: 'msg-2', role: 'assistant', content: 'I recommend a layered approach...', timestamp: 1704067260000 }
            ],
            metadata: {
                provider: 'anthropic',
                model: 'claude-3',
                createdAt: 1704067200000,
                updatedAt: 1704067260000,
                importedAt: 1704067300000,
                messageCount: 2,
                wordCount: 20
            },
            tags: ['architecture', 'design']
        }
    ],
    insights: [
        {
            id: 'insight-1',
            category: 'expertise',
            content: 'User prefers functional programming',
            confidence: 0.85,
            derivedFrom: ['conv-1'],
            createdAt: 1704067200000,
            updatedAt: 1704067200000
        }
    ],
    activeGrants: [
        {
            id: 'grant-1',
            grantee: 'claude',
            permissions: ['read_identity', 'read_memory'],
            expiresAt: Date.now() + 86400000, // 24 hours from now
            signature: 'test-signature'
        }
    ]
});

const cloneProfile = (profile: PortableProfile): PortableProfile =>
    structuredClone(profile);

// ============================================================
// Identity Merge Tests
// ============================================================

describe('smartMerge - Identity', () => {
    let base: PortableProfile;
    let local: PortableProfile;
    let remote: PortableProfile;

    beforeEach(() => {
        base = createBaseProfile();
        local = cloneProfile(base);
        remote = cloneProfile(base);
    });

    it('should merge non-conflicting identity field changes', async () => {
        local.identity.email = 'alice.new@example.com';
        remote.identity.location = 'San Francisco';

        const result = await smartMerge(local, remote, base);

        expect(result.conflicts).toHaveLength(0);
        expect(result.merged.identity.email).toBe('alice.new@example.com');
        expect(result.merged.identity.location).toBe('San Francisco');
        expect(result.merged.identity.displayName).toBe('Alice'); // Unchanged
    });

    it('should detect conflict when both sides change same field differently', async () => {
        local.identity.displayName = 'Alice Smith';
        remote.identity.displayName = 'Alice Jones';

        const result = await smartMerge(local, remote, base);

        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0].type).toBe('identity');
        expect(result.conflicts[0].conflictingFields).toContain('displayName');
        expect(result.conflicts[0].autoMergeable).toBe(false);
    });

    it('should take remote value when only remote changed (three-way)', async () => {
        // Local unchanged, remote changed
        remote.identity.fullName = 'Alice Jane Smith';

        const result = await smartMerge(local, remote, base);

        expect(result.conflicts).toHaveLength(0);
        expect(result.merged.identity.fullName).toBe('Alice Jane Smith');
    });

    it('should keep local value when only local changed (three-way)', async () => {
        // Remote unchanged, local changed
        local.identity.role = 'Senior Engineer';

        const result = await smartMerge(local, remote, base);

        expect(result.conflicts).toHaveLength(0);
        expect(result.merged.identity.role).toBe('Senior Engineer');
    });

    it('should not conflict when both sides make the same change', async () => {
        local.identity.email = 'same@example.com';
        remote.identity.email = 'same@example.com';

        const result = await smartMerge(local, remote, base);

        expect(result.conflicts).toHaveLength(0);
        expect(result.merged.identity.email).toBe('same@example.com');
    });

    it('should handle two-way merge (no base) with conflicts', async () => {
        local.identity.displayName = 'Local Name';
        remote.identity.displayName = 'Remote Name';

        const result = await smartMerge(local, remote); // No base

        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0].type).toBe('identity');
    });

    it('should take remote value in two-way merge when local is empty', async () => {
        local.identity.avatarUrl = undefined;
        remote.identity.avatarUrl = 'https://example.com/avatar.png';

        const result = await smartMerge(local, remote); // No base

        expect(result.conflicts).toHaveLength(0);
        expect(result.merged.identity.avatarUrl).toBe('https://example.com/avatar.png');
    });
});

// ============================================================
// Memory Merge Tests
// ============================================================

describe('smartMerge - Memories', () => {
    let base: PortableProfile;
    let local: PortableProfile;
    let remote: PortableProfile;

    beforeEach(() => {
        base = createBaseProfile();
        local = cloneProfile(base);
        remote = cloneProfile(base);
    });

    it('should add new remote memories', async () => {
        const newMemory: MemoryFragment = {
            id: 'mem-new',
            timestamp: '2024-01-02T10:00:00Z',
            content: 'New remote memory',
            tags: ['new'],
            type: 'technical',
            sourceModel: 'gpt-4',
            sourceProvider: 'openai',
            confidence: 0.8
        };
        remote.shortTermMemory.push(newMemory);

        const result = await smartMerge(local, remote, base);

        expect(result.stats.memoriesAdded).toBe(1);
        const allMemories = [...result.merged.shortTermMemory, ...result.merged.longTermMemory];
        expect(allMemories.find(m => m.id === 'mem-new')).toBeDefined();
    });

    it('should auto-merge tags (union) when no content conflict', async () => {
        local.shortTermMemory[0].tags = ['work', 'identity', 'local-tag'];
        remote.shortTermMemory[0].tags = ['work', 'identity', 'remote-tag'];

        const result = await smartMerge(local, remote, base);

        expect(result.conflicts).toHaveLength(0);
        const mergedMemory = result.merged.shortTermMemory.find(m => m.id === 'mem-1');
        expect(mergedMemory?.tags).toContain('local-tag');
        expect(mergedMemory?.tags).toContain('remote-tag');
    });

    it('should take higher confidence value', async () => {
        local.shortTermMemory[0].confidence = 0.7;
        remote.shortTermMemory[0].confidence = 0.95;

        const result = await smartMerge(local, remote, base);

        expect(result.conflicts).toHaveLength(0);
        const mergedMemory = result.merged.shortTermMemory.find(m => m.id === 'mem-1');
        expect(mergedMemory?.confidence).toBe(0.95);
    });

    it('should detect content conflict when both sides change content', async () => {
        local.shortTermMemory[0].content = 'Local updated content';
        remote.shortTermMemory[0].content = 'Remote updated content';

        const result = await smartMerge(local, remote, base);

        expect(result.conflicts.length).toBeGreaterThan(0);
        const memoryConflict = result.conflicts.find(c => c.type === 'memory');
        expect(memoryConflict?.conflictingFields).toContain('content');
    });

    it('should not conflict when only one side changes content', async () => {
        // Local unchanged, remote changes content
        remote.shortTermMemory[0].content = 'Updated by remote only';

        const result = await smartMerge(local, remote, base);

        const memoryConflicts = result.conflicts.filter(c => c.type === 'memory');
        expect(memoryConflicts).toHaveLength(0);
    });

    it('should suggest resolution based on timestamp', async () => {
        local.shortTermMemory[0].content = 'Local change';
        local.shortTermMemory[0].timestamp = '2024-01-01T10:00:00Z';
        remote.shortTermMemory[0].content = 'Remote change';
        remote.shortTermMemory[0].timestamp = '2024-01-02T10:00:00Z'; // Newer

        const result = await smartMerge(local, remote, base);

        const memoryConflict = result.conflicts.find(c => c.type === 'memory');
        expect(memoryConflict?.suggestedResolution).toBe('remote');
    });

    it('should detect type conflict', async () => {
        local.shortTermMemory[0].type = 'personal';
        remote.shortTermMemory[0].type = 'preference';

        const result = await smartMerge(local, remote, base);

        const memoryConflict = result.conflicts.find(c => c.type === 'memory');
        expect(memoryConflict?.conflictingFields).toContain('type');
    });

    it('should properly distribute memories between short-term and long-term', async () => {
        // Add many memories to exceed short-term limit (50)
        const manyMemories: MemoryFragment[] = [];
        for (let i = 0; i < 60; i++) {
            manyMemories.push({
                id: `mem-bulk-${i}`,
                timestamp: `2024-01-${String(i % 28 + 1).padStart(2, '0')}T10:00:00Z`,
                content: `Bulk memory ${i}`,
                tags: [],
                type: 'technical',
                sourceModel: 'gpt-4',
                sourceProvider: 'openai',
                confidence: 0.8
            });
        }
        remote.shortTermMemory = [...remote.shortTermMemory, ...manyMemories];

        const result = await smartMerge(local, remote, base);

        expect(result.merged.shortTermMemory.length).toBeLessThanOrEqual(50);
        expect(result.merged.longTermMemory.length).toBeGreaterThan(0);
    });
});

// ============================================================
// Conversation Merge Tests (Block-Based)
// ============================================================

describe('smartMerge - Conversations', () => {
    let base: PortableProfile;
    let local: PortableProfile;
    let remote: PortableProfile;

    beforeEach(() => {
        base = createBaseProfile();
        local = cloneProfile(base);
        remote = cloneProfile(base);
    });

    it('should add new remote conversations', async () => {
        const newConv: Conversation = {
            id: 'conv-new',
            title: 'New Conversation',
            messages: [
                { id: 'new-msg-1', role: 'user', content: 'Hello', timestamp: 1704067300000 }
            ],
            metadata: {
                provider: 'openai',
                model: 'gpt-4',
                createdAt: 1704067300000,
                updatedAt: 1704067300000,
                importedAt: 1704067300000,
                messageCount: 1,
                wordCount: 1
            },
            tags: ['new']
        };
        remote.conversations.push(newConv);

        const result = await smartMerge(local, remote, base);

        expect(result.stats.conversationsAdded).toBe(1);
        expect(result.merged.conversations.find(c => c.id === 'conv-new')).toBeDefined();
    });

    it('should merge conversation tags (union)', async () => {
        local.conversations[0].tags = ['architecture', 'design', 'local-tag'];
        remote.conversations[0].tags = ['architecture', 'design', 'remote-tag'];

        const result = await smartMerge(local, remote, base);

        const mergedConv = result.merged.conversations.find(c => c.id === 'conv-1');
        expect(mergedConv?.tags).toContain('local-tag');
        expect(mergedConv?.tags).toContain('remote-tag');
    });

    it('should append remote messages as a block when both sides add messages', async () => {
        const localNewMsg: Message = {
            id: 'local-new-msg',
            role: 'user',
            content: 'Local follow-up',
            timestamp: 1704067320000
        };
        const remoteNewMsg: Message = {
            id: 'remote-new-msg',
            role: 'assistant',
            content: 'Remote response',
            timestamp: 1704067340000
        };

        local.conversations[0].messages.push(localNewMsg);
        remote.conversations[0].messages.push(remoteNewMsg);

        const result = await smartMerge(local, remote, base);

        const mergedConv = result.merged.conversations.find(c => c.id === 'conv-1');
        expect(mergedConv?.messages).toHaveLength(4); // 2 base + 1 local + 1 remote
        expect(mergedConv?.messages.find(m => m.id === 'local-new-msg')).toBeDefined();
        expect(mergedConv?.messages.find(m => m.id === 'remote-new-msg')).toBeDefined();
    });

    it('should not duplicate messages already in both sides', async () => {
        const sharedMsg: Message = {
            id: 'shared-msg',
            role: 'user',
            content: 'Shared message',
            timestamp: 1704067320000
        };

        local.conversations[0].messages.push({ ...sharedMsg });
        remote.conversations[0].messages.push({ ...sharedMsg });

        const result = await smartMerge(local, remote, base);

        const mergedConv = result.merged.conversations.find(c => c.id === 'conv-1');
        const sharedMsgCount = mergedConv?.messages.filter(m => m.id === 'shared-msg').length;
        expect(sharedMsgCount).toBe(1);
    });

    it('should handle only remote adding messages', async () => {
        const remoteNewMsg: Message = {
            id: 'remote-only-msg',
            role: 'assistant',
            content: 'Remote only message',
            timestamp: 1704067340000
        };
        remote.conversations[0].messages.push(remoteNewMsg);

        const result = await smartMerge(local, remote, base);

        expect(result.conflicts).toHaveLength(0);
        const mergedConv = result.merged.conversations.find(c => c.id === 'conv-1');
        expect(mergedConv?.messages.find(m => m.id === 'remote-only-msg')).toBeDefined();
    });

    it('should update metadata with most recent timestamp', async () => {
        local.conversations[0].metadata.updatedAt = 1704067400000;
        remote.conversations[0].metadata.updatedAt = 1704067500000;

        const result = await smartMerge(local, remote, base);

        const mergedConv = result.merged.conversations.find(c => c.id === 'conv-1');
        expect(mergedConv?.metadata.updatedAt).toBe(1704067500000);
    });
});

// ============================================================
// Insight Merge Tests
// ============================================================

describe('smartMerge - Insights', () => {
    let base: PortableProfile;
    let local: PortableProfile;
    let remote: PortableProfile;

    beforeEach(() => {
        base = createBaseProfile();
        local = cloneProfile(base);
        remote = cloneProfile(base);
    });

    it('should add new remote insights', async () => {
        const newInsight: UserInsight = {
            id: 'insight-new',
            category: 'interest',
            content: 'User interested in AI safety',
            confidence: 0.9,
            derivedFrom: ['conv-1'],
            createdAt: 1704067300000,
            updatedAt: 1704067300000
        };
        remote.insights.push(newInsight);

        const result = await smartMerge(local, remote, base);

        expect(result.stats.insightsAdded).toBe(1);
        expect(result.merged.insights.find(i => i.id === 'insight-new')).toBeDefined();
    });

    it('should merge derivedFrom arrays when content is same', async () => {
        local.insights[0].derivedFrom = ['conv-1', 'conv-local'];
        remote.insights[0].derivedFrom = ['conv-1', 'conv-remote'];

        const result = await smartMerge(local, remote, base);

        const mergedInsight = result.merged.insights.find(i => i.id === 'insight-1');
        expect(mergedInsight?.derivedFrom).toContain('conv-local');
        expect(mergedInsight?.derivedFrom).toContain('conv-remote');
    });

    it('should take newer insight when content differs with different timestamps', async () => {
        local.insights[0].content = 'Local updated insight';
        local.insights[0].updatedAt = 1704067200000;
        remote.insights[0].content = 'Remote updated insight';
        remote.insights[0].updatedAt = 1704067300000; // Newer

        const result = await smartMerge(local, remote, base);

        // Should auto-merge by taking newer
        const insightConflicts = result.conflicts.filter(c => c.type === 'insight');
        expect(insightConflicts).toHaveLength(0);

        const mergedInsight = result.merged.insights.find(i => i.id === 'insight-1');
        expect(mergedInsight?.content).toBe('Remote updated insight');
    });

    it('should detect conflict when content differs with same timestamp', async () => {
        local.insights[0].content = 'Local insight';
        local.insights[0].updatedAt = 1704067200000;
        remote.insights[0].content = 'Remote insight';
        remote.insights[0].updatedAt = 1704067200000; // Same timestamp

        const result = await smartMerge(local, remote, base);

        const insightConflict = result.conflicts.find(c => c.type === 'insight');
        expect(insightConflict).toBeDefined();
        expect(insightConflict?.conflictingFields).toContain('content');
    });

    it('should take higher confidence when content is same', async () => {
        local.insights[0].confidence = 0.7;
        remote.insights[0].confidence = 0.95;

        const result = await smartMerge(local, remote, base);

        const mergedInsight = result.merged.insights.find(i => i.id === 'insight-1');
        expect(mergedInsight?.confidence).toBe(0.95);
    });
});

// ============================================================
// Preference Merge Tests
// ============================================================

describe('smartMerge - Preferences', () => {
    let base: PortableProfile;
    let local: PortableProfile;
    let remote: PortableProfile;

    beforeEach(() => {
        base = createBaseProfile();
        local = cloneProfile(base);
        remote = cloneProfile(base);
    });

    it('should add new remote preferences', async () => {
        const newPref: SystemPreference = {
            id: 'pref-new',
            key: 'fontSize',
            value: '14',
            category: 'output_style',
            isEnabled: true
        };
        remote.preferences.push(newPref);

        const result = await smartMerge(local, remote, base);

        expect(result.merged.preferences.find(p => p.id === 'pref-new')).toBeDefined();
    });

    it('should detect conflict when preference values differ', async () => {
        local.preferences[0].value = 'light';
        remote.preferences[0].value = 'system';

        const result = await smartMerge(local, remote, base);

        const prefConflict = result.conflicts.find(c => c.type === 'preference');
        expect(prefConflict).toBeDefined();
        expect(prefConflict?.conflictingFields).toContain('value');
    });

    it('should detect conflict when isEnabled differs', async () => {
        local.preferences[0].isEnabled = true;
        remote.preferences[0].isEnabled = false;

        const result = await smartMerge(local, remote, base);

        const prefConflict = result.conflicts.find(c => c.type === 'preference');
        expect(prefConflict).toBeDefined();
        expect(prefConflict?.conflictingFields).toContain('isEnabled');
    });

    it('should not conflict when preferences are identical', async () => {
        // No changes
        const result = await smartMerge(local, remote, base);

        const prefConflicts = result.conflicts.filter(c => c.type === 'preference');
        expect(prefConflicts).toHaveLength(0);
    });
});

// ============================================================
// Project Merge Tests
// ============================================================

describe('smartMerge - Projects', () => {
    let base: PortableProfile;
    let local: PortableProfile;
    let remote: PortableProfile;

    beforeEach(() => {
        base = createBaseProfile();
        local = cloneProfile(base);
        remote = cloneProfile(base);
    });

    it('should add new remote projects', async () => {
        const newProject: ProjectContext = {
            id: 'proj-new',
            name: 'New Project',
            description: 'A new project',
            techStack: ['Python'],
            relatedMemories: []
        };
        remote.projects.push(newProject);

        const result = await smartMerge(local, remote, base);

        expect(result.merged.projects.find(p => p.id === 'proj-new')).toBeDefined();
    });

    it('should auto-merge tech stack (union)', async () => {
        local.projects[0].techStack = ['TypeScript', 'React', 'Vite'];
        remote.projects[0].techStack = ['TypeScript', 'React', 'TailwindCSS'];

        const result = await smartMerge(local, remote, base);

        const mergedProject = result.merged.projects.find(p => p.id === 'proj-1');
        expect(mergedProject?.techStack).toContain('Vite');
        expect(mergedProject?.techStack).toContain('TailwindCSS');
    });

    it('should auto-merge related memories (union)', async () => {
        local.projects[0].relatedMemories = ['mem-1', 'mem-local'];
        remote.projects[0].relatedMemories = ['mem-1', 'mem-remote'];

        const result = await smartMerge(local, remote, base);

        const mergedProject = result.merged.projects.find(p => p.id === 'proj-1');
        expect(mergedProject?.relatedMemories).toContain('mem-local');
        expect(mergedProject?.relatedMemories).toContain('mem-remote');
    });

    it('should detect conflict when name differs', async () => {
        local.projects[0].name = 'IdentityReport v2';
        remote.projects[0].name = 'Identity Report';

        const result = await smartMerge(local, remote, base);

        const projectConflict = result.conflicts.find(c => c.type === 'project');
        expect(projectConflict).toBeDefined();
        expect(projectConflict?.conflictingFields).toContain('name');
    });

    it('should detect conflict when description differs', async () => {
        local.projects[0].description = 'Local description';
        remote.projects[0].description = 'Remote description';

        const result = await smartMerge(local, remote, base);

        const projectConflict = result.conflicts.find(c => c.type === 'project');
        expect(projectConflict).toBeDefined();
        expect(projectConflict?.conflictingFields).toContain('description');
    });
});

// ============================================================
// Grant Merge Tests (Union, No Conflicts)
// ============================================================

describe('smartMerge - Grants', () => {
    let base: PortableProfile;
    let local: PortableProfile;
    let remote: PortableProfile;

    beforeEach(() => {
        base = createBaseProfile();
        local = cloneProfile(base);
        remote = cloneProfile(base);
    });

    it('should add new remote grants', async () => {
        const newGrant: AccessGrant = {
            id: 'grant-new',
            grantee: 'gemini',
            permissions: ['read_identity'],
            expiresAt: Date.now() + 86400000,
            signature: 'new-signature'
        };
        remote.activeGrants.push(newGrant);

        const result = await smartMerge(local, remote, base);

        expect(result.merged.activeGrants.find(g => g.id === 'grant-new')).toBeDefined();
    });

    it('should not add expired grants', async () => {
        const expiredGrant: AccessGrant = {
            id: 'grant-expired',
            grantee: 'expired-service',
            permissions: ['read_identity'],
            expiresAt: Date.now() - 86400000, // Expired
            signature: 'expired-signature'
        };
        remote.activeGrants.push(expiredGrant);

        const result = await smartMerge(local, remote, base);

        expect(result.merged.activeGrants.find(g => g.id === 'grant-expired')).toBeUndefined();
    });

    it('should filter out expired grants from both local and remote', async () => {
        const expiredLocalGrant: AccessGrant = {
            id: 'grant-expired-local',
            grantee: 'expired-local',
            permissions: ['read_identity'],
            expiresAt: Date.now() - 1000,
            signature: 'sig'
        };
        local.activeGrants.push(expiredLocalGrant);

        const result = await smartMerge(local, remote, base);

        expect(result.merged.activeGrants.find(g => g.id === 'grant-expired-local')).toBeUndefined();
    });

    it('should not create duplicate grants', async () => {
        // Same grant in both - should only appear once
        const result = await smartMerge(local, remote, base);

        const grant1Count = result.merged.activeGrants.filter(g => g.id === 'grant-1').length;
        expect(grant1Count).toBe(1);
    });
});

// ============================================================
// Conflict Resolution Tests
// ============================================================

describe('applyResolution', () => {
    it('should return local version for local resolution', () => {
        const conflict: Conflict<UserIdentity> = {
            id: 'conflict-1',
            type: 'identity',
            entityId: 'identity',
            localVersion: { displayName: 'Local', fullName: '', email: '', location: '', role: '' },
            remoteVersion: { displayName: 'Remote', fullName: '', email: '', location: '', role: '' },
            autoMergeable: false,
            conflictingFields: ['displayName'],
            localModifiedAt: Date.now(),
            remoteModifiedAt: Date.now()
        };

        const result = applyResolution(conflict, 'local');
        expect(result.displayName).toBe('Local');
    });

    it('should return remote version for remote resolution', () => {
        const conflict: Conflict<UserIdentity> = {
            id: 'conflict-1',
            type: 'identity',
            entityId: 'identity',
            localVersion: { displayName: 'Local', fullName: '', email: '', location: '', role: '' },
            remoteVersion: { displayName: 'Remote', fullName: '', email: '', location: '', role: '' },
            autoMergeable: false,
            conflictingFields: ['displayName'],
            localModifiedAt: Date.now(),
            remoteModifiedAt: Date.now()
        };

        const result = applyResolution(conflict, 'remote');
        expect(result.displayName).toBe('Remote');
    });

    it('should return custom value for custom resolution', () => {
        const conflict: Conflict<UserIdentity> = {
            id: 'conflict-1',
            type: 'identity',
            entityId: 'identity',
            localVersion: { displayName: 'Local', fullName: '', email: '', location: '', role: '' },
            remoteVersion: { displayName: 'Remote', fullName: '', email: '', location: '', role: '' },
            autoMergeable: false,
            conflictingFields: ['displayName'],
            localModifiedAt: Date.now(),
            remoteModifiedAt: Date.now()
        };

        const customValue = { displayName: 'Custom', fullName: 'Custom Full', email: '', location: '', role: '' };
        const result = applyResolution(conflict, 'custom', customValue);
        expect(result.displayName).toBe('Custom');
    });

    it('should throw error for custom resolution without custom value', () => {
        const conflict: Conflict = {
            id: 'conflict-1',
            type: 'identity',
            entityId: 'identity',
            localVersion: {},
            remoteVersion: {},
            autoMergeable: false,
            conflictingFields: [],
            localModifiedAt: Date.now(),
            remoteModifiedAt: Date.now()
        };

        expect(() => applyResolution(conflict, 'custom')).toThrow('Custom resolution requires a custom value');
    });
});

describe('applyResolutions', () => {
    it('should apply multiple resolutions to a profile', async () => {
        const base = createBaseProfile();
        const local = cloneProfile(base);
        const remote = cloneProfile(base);

        // Create conflicts
        local.identity.displayName = 'Local Name';
        remote.identity.displayName = 'Remote Name';

        const { merged, conflicts } = await smartMerge(local, remote, base);

        const resolutions = new Map<string, { choice: 'local' | 'remote' | 'custom'; customValue?: unknown }>();
        for (const conflict of conflicts) {
            resolutions.set(conflict.id, { choice: 'remote' });
        }

        const resolved = applyResolutions(merged, conflicts, resolutions);
        expect(resolved.identity.displayName).toBe('Remote Name');
    });

    it('should handle mixed resolutions', async () => {
        const base = createBaseProfile();
        const local = cloneProfile(base);
        const remote = cloneProfile(base);

        // Create memory conflict
        local.shortTermMemory[0].content = 'Local memory content';
        remote.shortTermMemory[0].content = 'Remote memory content';

        // Create insight conflict (same timestamp, different content)
        local.insights[0].content = 'Local insight';
        remote.insights[0].content = 'Remote insight';

        const { merged, conflicts } = await smartMerge(local, remote, base);

        const resolutions = new Map<string, { choice: 'local' | 'remote' | 'custom'; customValue?: unknown }>();

        for (const conflict of conflicts) {
            if (conflict.type === 'memory') {
                resolutions.set(conflict.id, { choice: 'local' });
            } else {
                resolutions.set(conflict.id, { choice: 'remote' });
            }
        }

        const resolved = applyResolutions(merged, conflicts, resolutions);

        // Memory should be local
        const resolvedMemory = resolved.shortTermMemory.find(m => m.id === 'mem-1');
        if (resolvedMemory) {
            expect(resolvedMemory.content).toBe('Local memory content');
        }
    });
});

// ============================================================
// Test Vector Scenarios
// ============================================================

describe('SYNC_SCENARIOS from test vectors', () => {
    it('should handle noConflict scenario', async () => {
        const scenario = SYNC_SCENARIOS.noConflict;

        // Create profiles from scenario
        const base = createBaseProfile();
        base.identity.displayName = scenario.base.name;

        const local = cloneProfile(base);
        local.identity.email = scenario.local.email || '';

        const remote = cloneProfile(base);
        remote.identity.location = scenario.remote.location || '';

        const result = await smartMerge(local, remote, base);

        expect(result.conflicts).toHaveLength(0);
        expect(result.merged.identity.email).toBe('alice@example.com');
        expect(result.merged.identity.location).toBe('NYC');
    });

    it('should handle fieldConflict scenario', async () => {
        const scenario = SYNC_SCENARIOS.fieldConflict;

        const base = createBaseProfile();
        base.identity.displayName = scenario.base.name;

        const local = cloneProfile(base);
        local.identity.displayName = scenario.local.name;

        const remote = cloneProfile(base);
        remote.identity.displayName = scenario.remote.name;

        const result = await smartMerge(local, remote, base);

        expect(result.conflicts.length).toBeGreaterThan(0);
        const identityConflict = result.conflicts.find(c => c.type === 'identity');
        expect(identityConflict?.conflictingFields).toContain('displayName');
    });
});

// ============================================================
// Edge Cases and Error Handling
// ============================================================

describe('smartMerge - Edge Cases', () => {
    it('should handle empty profiles', async () => {
        const emptyProfile: PortableProfile = {
            identity: { displayName: '', fullName: '', email: '', location: '', role: '' },
            preferences: [],
            shortTermMemory: [],
            longTermMemory: [],
            projects: [],
            conversations: [],
            insights: [],
            activeGrants: []
        };

        const result = await smartMerge(emptyProfile, emptyProfile);

        expect(result.conflicts).toHaveLength(0);
        expect(result.merged).toBeDefined();
    });

    it('should handle undefined base (two-way merge)', async () => {
        const base = createBaseProfile();
        const local = cloneProfile(base);
        const remote = cloneProfile(base);

        local.identity.displayName = 'Local';
        remote.identity.displayName = 'Remote';

        const result = await smartMerge(local, remote);

        // Should detect conflict in two-way merge
        expect(result.conflicts.length).toBeGreaterThan(0);
    });

    it('should return proper stats', async () => {
        const base = createBaseProfile();
        const local = cloneProfile(base);
        const remote = cloneProfile(base);

        // Add new content to remote
        remote.shortTermMemory.push({
            id: 'new-mem',
            timestamp: '2024-01-02T10:00:00Z',
            content: 'New memory',
            tags: [],
            type: 'technical',
            sourceModel: 'gpt-4',
            sourceProvider: 'openai',
            confidence: 0.8
        });

        const result = await smartMerge(local, remote, base);

        expect(result.stats).toBeDefined();
        expect(result.stats.memoriesAdded).toBe(1);
        expect(typeof result.autoResolved).toBe('number');
    });

    it('should preserve all original data when no conflicts', async () => {
        const base = createBaseProfile();
        const local = cloneProfile(base);
        const remote = cloneProfile(base);

        // Only add data, no modifications
        const newInsight: UserInsight = {
            id: 'insight-new',
            category: 'expertise',
            content: 'New insight',
            confidence: 0.8,
            derivedFrom: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        remote.insights.push(newInsight);

        const result = await smartMerge(local, remote, base);

        // Original data should be preserved
        expect(result.merged.identity).toEqual(base.identity);
        expect(result.merged.insights).toHaveLength(2);
    });
});
