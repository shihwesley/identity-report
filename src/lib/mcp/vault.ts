/**
 * MCP Profile Vault
 * 
 * Manages the user's profile data and provides tool implementations for the MCP server.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    PortableProfile,
    Conversation,
    MemoryFragment
} from '../types';
import { vault } from '../vault/manager';
import { SummarizationService } from '../services/summarizer';
import { VAULT_PATH, log, logError, logAudit } from './config';

export class ProfileVault {
    private profile: PortableProfile;

    constructor() {
        this.profile = this.initDefaultProfile();
        this.loadData();
    }

    private loadData() {
        // Load from file system or use defaults
        const dataPath = path.join(VAULT_PATH, 'profile.json');

        if (fs.existsSync(dataPath)) {
            try {
                const data = fs.readFileSync(dataPath, 'utf8');
                this.profile = JSON.parse(data);
                log('Loaded profile from:', { path: dataPath });
            } catch (e) {
                logError('Error loading profile:', { error: (e as Error).message, path: dataPath });
                this.profile = this.initDefaultProfile();
            }
        }
    }

    private initDefaultProfile(): PortableProfile {
        return {
            identity: {
                displayName: 'User',
                fullName: 'Profile User',
                email: '',
                location: '',
                role: 'Developer',
                avatarUrl: ''
            },
            preferences: [
                { id: '1', key: 'Response Style', value: 'Concise and technical', category: 'output_style', isEnabled: true },
                { id: '2', key: 'Code Format', value: 'Include comments', category: 'coding_style', isEnabled: true }
            ],
            conversations: [],
            shortTermMemory: [],
            longTermMemory: [],
            projects: [],
            insights: [],
            activeGrants: []
        };
    }

    async readResource(uri: string): Promise<any> {
        switch (uri) {
            case 'profile://identity':
                return this.profile.identity;

            case 'profile://preferences':
                return {
                    preferences: this.profile.preferences,
                    activeCount: this.profile.preferences.filter(p => p.isEnabled).length
                };

            case 'profile://memory/recent':
                return {
                    memories: this.profile.shortTermMemory ? this.profile.shortTermMemory.slice(-20) : [],
                    count: this.profile.shortTermMemory ? Math.min(20, this.profile.shortTermMemory.length) : 0
                };

            case 'profile://memory/all':
                return {
                    memories: [...(this.profile.shortTermMemory || []), ...(this.profile.longTermMemory || [])],
                    totalCount: (this.profile.shortTermMemory?.length || 0) + (this.profile.longTermMemory?.length || 0)
                };

            case 'profile://insights':
                return {
                    insights: this.profile.insights || [],
                    categories: this.categorizeInsights()
                };

            case 'profile://conversations/recent':
                return {
                    conversations: (this.profile.conversations || [])
                        .slice(-10)
                        .map(c => ({
                            id: c.id,
                            title: c.title,
                            provider: c.metadata?.provider,
                            messageCount: c.metadata?.messageCount,
                            createdAt: c.metadata?.createdAt
                        })),
                    totalCount: (this.profile.conversations || []).length
                };

            case 'profile://stats':
                return this.getStats();

            default:
                // Handle parameterized URIs
                if (uri.startsWith('profile://conversations/')) {
                    const id = uri.replace('profile://conversations/', '');
                    return this.getConversation(id);
                }
                if (uri.startsWith('profile://memory/search?')) {
                    const query = new URLSearchParams(uri.split('?')[1]).get('q');
                    return this.searchMemory(query || '');
                }
                return { error: 'Resource not found', uri };
        }
    }

    async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
        switch (name) {
            case 'search_memory': {
                const query = args.query;
                if (typeof query !== 'string' || query.trim().length === 0) {
                    return { error: 'Invalid query: must be a non-empty string' };
                }
                const limit = typeof args.limit === 'number' ? args.limit : 10;
                return this.searchMemory(query, limit);
            }

            case 'add_memory': {
                const content = args.content;
                if (typeof content !== 'string' || content.trim().length === 0) {
                    return { error: 'Invalid content: must be a non-empty string' };
                }
                return this.addMemory(args as { content: string; tags?: string[]; type?: string });
            }

            case 'get_context_for_task': {
                const taskDescription = args.task_description;
                if (typeof taskDescription !== 'string' || taskDescription.trim().length === 0) {
                    return { error: 'Invalid task_description: must be a non-empty string' };
                }
                return this.getContextForTask(taskDescription);
            }

            case 'get_conversation_history': {
                const topic = args.topic;
                if (typeof topic !== 'string' || topic.trim().length === 0) {
                    return { error: 'Invalid topic: must be a non-empty string' };
                }
                const provider = typeof args.provider === 'string' ? args.provider : 'all';
                return this.getConversationHistory(topic, provider);
            }

            case 'archive_conversation': {
                const title = args.title;
                const messages = args.messages;
                if (typeof title !== 'string' || title.trim().length === 0) {
                    return { error: 'Invalid title: must be a non-empty string' };
                }
                if (!Array.isArray(messages) || messages.length === 0) {
                    return { error: 'Invalid messages: must be a non-empty array' };
                }
                return this.archiveConversation(args as {
                    title: string;
                    messages: Array<{ role: string; content: string; timestamp?: number }>;
                    provider?: string;
                    model?: string;
                    summary?: string;
                });
            }

            case 'toggle_auto_archive': {
                const enabled = args.enabled;
                if (typeof enabled !== 'boolean') {
                    return { error: 'Invalid enabled: must be a boolean' };
                }
                return this.setAutoArchive(enabled);
            }

            case 'sync_vault': {
                const jwt = process.env.PINATA_JWT;
                if (!jwt) {
                    return { error: 'PINATA_JWT environment variable not set. Cannot sync to cloud.' };
                }
                return vault.syncToCloud({ pinataJwt: jwt });
            }

            case 'toggle_auto_sync': {
                const enabled = args.enabled;
                if (typeof enabled !== 'boolean') {
                    return { error: 'Invalid enabled: must be a boolean' };
                }
                return this.setAutoSync(enabled);
            }

            case 'analyze_vault': {
                // AI calls this to get structure, then generates summary itself
                const allConversations = await vault.getConversations();
                const clusters = SummarizationService.clusterConversations(allConversations);
                return {
                    totalConversations: allConversations.length,
                    clusters: clusters,
                    hint: "Use these clusters to generate a summary for the user. Group by 'topic' and mention duplicates."
                };
            }

            case 'grant_access': {
                const grantee = args.grantee;
                if (typeof grantee !== 'string' || grantee.trim().length === 0) {
                    return { error: 'Invalid grantee: must be a non-empty string' };
                }
                const permissions = Array.isArray(args.permissions) ? args.permissions : ['read_memory'];
                const durationSeconds = typeof args.durationSeconds === 'number' ? args.durationSeconds : 3600;
                return vault.grantAccess(
                    grantee,
                    permissions as ('read_identity' | 'read_memory' | 'write_memory')[],
                    durationSeconds
                );
            }

            default:
                return { error: 'Tool not found', name };
        }
    }

    // --- Tool Implementations ---

    private searchMemory(query: string, limit = 10) {
        const lowerQuery = query.toLowerCase();
        const allMemories = [...(this.profile.shortTermMemory || []), ...(this.profile.longTermMemory || [])];

        const matches = allMemories
            .filter(m =>
                m.content.toLowerCase().includes(lowerQuery) ||
                m.tags.some(t => t.toLowerCase().includes(lowerQuery))
            )
            .slice(0, limit);

        return {
            query,
            matches,
            count: matches.length,
            totalSearched: allMemories.length
        };
    }

    private addMemory(args: any) {
        const memory: MemoryFragment = {
            id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timestamp: new Date().toISOString(),
            content: args.content,
            tags: args.tags || [],
            type: (args.type as any) || 'fact',
            sourceModel: 'mcp-client',
            sourceProvider: 'local',
            confidence: 0.9
        };

        if (!this.profile.shortTermMemory) {
            this.profile.shortTermMemory = [];
        }

        this.profile.shortTermMemory.push(memory);

        // Move to long-term if buffer full
        if (this.profile.shortTermMemory.length > 50) {
            if (!this.profile.longTermMemory) this.profile.longTermMemory = [];
            const toMove = this.profile.shortTermMemory.splice(0, 20);
            this.profile.longTermMemory.push(...toMove);
        }

        this.saveProfile();

        log('Memory stored successfully', { memoryId: memory.id });
        logAudit('User memory added', { memoryId: memory.id, type: memory.type });
    }

    private getContextForTask(taskDescription: string) {
        // Search memories for relevant context
        const memoryResults = this.searchMemory(taskDescription, 5);

        // Search conversations
        const relevantConvs = (this.profile.conversations || [])
            .filter(c =>
                c.title.toLowerCase().includes(taskDescription.toLowerCase()) ||
                c.tags?.some(t => taskDescription.toLowerCase().includes(t.toLowerCase()))
            )
            .slice(0, 3)
            .map(c => ({
                id: c.id,
                title: c.title,
                provider: c.metadata?.provider,
                summary: c.summary || 'No summary available'
            }));

        // Get relevant insights
        const relevantInsights = (this.profile.insights || [])
            .filter(i =>
                i.content.toLowerCase().includes(taskDescription.toLowerCase())
            )
            .slice(0, 5);

        return {
            task: taskDescription,
            context: {
                memories: memoryResults.matches,
                conversations: relevantConvs,
                insights: relevantInsights,
                preferences: this.profile.preferences.filter(p => p.isEnabled)
            },
            hint: 'Use this context to personalize your response to the user'
        };
    }

    private getConversationHistory(topic: string, provider = 'all') {
        let conversations = this.profile.conversations || [];

        if (provider !== 'all') {
            conversations = conversations.filter(c => c.metadata?.provider === provider);
        }

        const matching = conversations
            .filter(c =>
                c.title.toLowerCase().includes(topic.toLowerCase()) ||
                c.tags?.some(t => t.toLowerCase().includes(topic.toLowerCase()))
            )
            .slice(0, 5);

        return {
            topic,
            provider: provider === 'all' ? 'all providers' : provider,
            conversations: matching.map(c => ({
                id: c.id,
                title: c.title,
                provider: c.metadata?.provider,
                model: c.metadata?.model,
                messageCount: c.metadata?.messageCount,
                createdAt: c.metadata?.createdAt,
                preview: c.messages?.[0]?.content.slice(0, 200)
            })),
            count: matching.length
        };
    }

    // --- Helper Methods ---

    private categorizeInsights() {
        const categories: Record<string, number> = {};
        for (const insight of (this.profile.insights || [])) {
            const cat = insight.category || 'other';
            categories[cat] = (categories[cat] || 0) + 1;
        }
        return categories;
    }

    private getStats() {
        const convs = this.profile.conversations || [];
        const providers = new Set(convs.map(c => c.metadata?.provider).filter(Boolean));

        return {
            identity: {
                name: this.profile.identity.fullName,
                role: this.profile.identity.role
            },
            memory: {
                total: (this.profile.shortTermMemory?.length || 0) + (this.profile.longTermMemory?.length || 0)
            },
            conversations: {
                total: convs.length,
                providers: Array.from(providers),
                messageCount: convs.reduce((sum, c) => sum + (c.metadata?.messageCount || 0), 0)
            },
            insights: {
                total: (this.profile.insights || []).length,
                categories: this.categorizeInsights()
            },
            preferences: {
                total: this.profile.preferences.length,
                active: this.profile.preferences.filter(p => p.isEnabled).length
            }
        };
    }

    private getConversation(id: string) {
        const conv = (this.profile.conversations || []).find(c => c.id === id);
        if (!conv) {
            return { error: 'Conversation not found', id };
        }
        return conv;
    }

    private saveProfile() {
        const dataPath = path.join(VAULT_PATH, 'profile.json');
        try {
            if (!fs.existsSync(VAULT_PATH)) {
                fs.mkdirSync(VAULT_PATH, { recursive: true });
            }
            fs.writeFileSync(dataPath, JSON.stringify(this.profile, null, 2));
            log('Profile saved successfully', { path: dataPath });
        } catch (e) {
            logError('Error saving profile:', { error: (e as Error).message, path: dataPath });
        }
    }

    async archiveConversation(args: {
        title: string;
        messages: any[];
        provider?: string;
        model?: string;
        summary?: string;
    }): Promise<any> {
        const conversation: Conversation = {
            id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            title: args.title,
            messages: args.messages.map((m: any) => ({
                id: m.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                role: m.role,
                content: m.content,
                timestamp: m.timestamp || Date.now(),
                contentType: 'text', // Default to text for simplified archival
                metadata: {
                    model: args.model
                }
            })),
            metadata: {
                provider: (args.provider || 'mcp-archived') as any,
                model: args.model || 'unknown',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                importedAt: Date.now(),
                messageCount: args.messages.length,
                wordCount: args.messages.reduce((sum: number, m: any) => sum + (m.content?.split(' ').length || 0), 0)
            },
            summary: args.summary,
            tags: []
        };

        if (!this.profile.conversations) {
            this.profile.conversations = [];
        }

        logAudit('Conversation archived', { conversationId: conversation.id, title: args.title });

        // Check for Auto-Sync Preference
        const autoSync = this.profile.preferences.find(p => p.key === 'Auto-Sync' && p.isEnabled);
        if (autoSync) {
            log('Auto-Sync enabled. Triggering background sync to IPFS...');
            // Background sync (don't await to keep response fast)
            const jwt = process.env.PINATA_JWT;
            if (jwt) {
                vault.syncToCloud({ pinataJwt: jwt })
                    .then(({ cid, txHash }) => {
                        log('Auto-Sync Complete', { cid, txHash });
                        logAudit('Vault synced to cloud (auto)', { cid });
                    })
                    .catch(err => logError('Auto-Sync Failed:', { error: err }));
            } else {
                log('Auto-Sync Skipped: PINATA_JWT not set');
            }
        }

        return {
            success: true,
            id: conversation.id,
            message: `Conversation '${args.title}' archived successfully.${autoSync ? ' Background sync started.' : ''}`
        };
    }

    async setAutoSync(enabled: boolean): Promise<any> {
        const prefKey = 'Auto-Sync';
        let pref = this.profile.preferences.find(p => p.key === prefKey);

        if (!pref) {
            pref = {
                id: `pref_${Date.now()}_sync`,
                key: prefKey,
                value: 'Enabled',
                category: 'communication',
                isEnabled: enabled
            };
            this.profile.preferences.push(pref);
        } else {
            pref.isEnabled = enabled;
        }

        this.saveProfile();
        logAudit('Auto-Sync preference updated', { enabled });
        return { success: true, enabled, message: `Auto-Sync ${enabled ? 'Enabled' : 'Disabled'}` };
    }

    async setAutoArchive(enabled: boolean): Promise<any> {
        const prefKey = 'Auto-Archive Chats';
        let pref = this.profile.preferences.find(p => p.key === prefKey);

        if (!pref) {
            pref = {
                id: `pref_${Date.now()}`,
                key: prefKey,
                value: 'Enabled',
                category: 'communication',
                isEnabled: enabled
            };
            this.profile.preferences.push(pref);
        } else {
            pref.isEnabled = enabled;
        }

        this.saveProfile();
        return { success: true, enabled };
    }
}
