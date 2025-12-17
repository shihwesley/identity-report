/**
 * Profile Context Protocol (PCP) MCP Server
 * 
 * An MCP server that exposes the user's portable AI profile to any connected AI model.
 * This enables AI models to understand the user's context, preferences, and history.
 * 
 * Protocol Version: 2024-11-05 (MCP Standard)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    PortableProfile,
    Conversation,
    MemoryFragment,
    UserInsight
} from '../types';
import { vault } from '../vault/manager';
import { SummarizationService } from '../services/summarizer';

// --- Types ---

interface BaseMcpRequest {
    jsonrpc: '2.0';
    id: number | string;
}

interface InitializeRequest extends BaseMcpRequest {
    method: 'initialize';
    params?: {
        protocolVersion?: string;
        capabilities?: any;
        clientInfo?: {
            name: string;
            version: string;
        };
    };
}

interface InitializedNotification extends BaseMcpRequest {
    method: 'notifications/initialized';
    params?: any;
}

interface ListResourcesRequest extends BaseMcpRequest {
    method: 'resources/list';
    params?: {
        cursor?: string;
    };
}

interface ReadResourceRequest extends BaseMcpRequest {
    method: 'resources/read';
    params: {
        uri: string;
    };
}

interface ListToolsRequest extends BaseMcpRequest {
    method: 'tools/list';
    params?: {
        cursor?: string;
    };
}

interface CallToolRequest extends BaseMcpRequest {
    method: 'tools/call';
    params: {
        name: string;
        arguments?: Record<string, any>;
    };
}

interface ListPromptsRequest extends BaseMcpRequest {
    method: 'prompts/list';
    params?: {
        cursor?: string;
    };
}

type McpRequest =
    | InitializeRequest
    | InitializedNotification
    | ListResourcesRequest
    | ReadResourceRequest
    | ListToolsRequest
    | CallToolRequest
    | ListPromptsRequest;

interface McpResponse {
    jsonrpc: '2.0';
    id: number | string;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

// --- Configuration ---
const VAULT_PATH = process.env.VAULT_PATH || path.join(process.env.HOME || '', '.profile-vault');
const DEBUG = process.env.DEBUG === 'true';

function log(...args: any[]) {
    if (DEBUG) {
        console.error('[PCP-MCP]', ...args);
    }
}

// --- Vault Implementation ---

class ProfileVault {
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
                log('Loaded profile from:', dataPath);
            } catch (e) {
                log('Error loading profile:', (e as Error).message);
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
            insights: []
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

    async callTool(name: string, args: any): Promise<any> {
        switch (name) {
            case 'search_memory':
                return this.searchMemory(args.query, args.limit || 10);

            case 'add_memory':
                return this.addMemory(args);

            case 'get_context_for_task':
                return this.getContextForTask(args.task_description);

            case 'get_conversation_history':
                return this.getConversationHistory(args.topic, args.provider || 'all');

            case 'archive_conversation':
                return this.archiveConversation(args);

            case 'toggle_auto_archive':
                return this.setAutoArchive(args.enabled);

            case 'sync_vault':
                const jwt = process.env.PINATA_JWT;
                if (!jwt) {
                    return { error: 'PINATA_JWT environment variable not set. Cannot sync to cloud.' };
                }
                return vault.syncToCloud({ pinataJwt: jwt });

            case 'toggle_auto_sync':
                return this.setAutoSync(args.enabled);

            case 'analyze_vault':
                // AI calls this to get structure, then generates summary itself
                const allConversations = await vault.getConversations();
                const clusters = SummarizationService.clusterConversations(allConversations);
                return {
                    totalConversations: allConversations.length,
                    clusters: clusters,
                    hint: "Use these clusters to generate a summary for the user. Group by 'topic' and mention duplicates."
                };

            case 'grant_access':
                return vault.grantAccess(
                    args.grantee,
                    args.permissions || ['read_memory'],
                    args.durationSeconds || 3600 // Default 1 hour
                );

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
            type: args.type || 'fact',
            sourceModel: 'mcp-client',
            sourceProvider: 'local',
            confidence: 0.9,
            // embedding: [] // Removed property not in type
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

        return {
            success: true,
            memory,
            message: 'Memory stored successfully'
        };
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
        try {
            if (!fs.existsSync(VAULT_PATH)) {
                fs.mkdirSync(VAULT_PATH, { recursive: true });
            }
            const dataPath = path.join(VAULT_PATH, 'profile.json');
            fs.writeFileSync(dataPath, JSON.stringify(this.profile, null, 2));
            log('Profile saved to:', dataPath);
        } catch (e) {
            log('Error saving profile:', (e as Error).message);
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

        this.profile.conversations.push(conversation);
        this.saveProfile();

        // Check for Auto-Sync Preference
        const autoSync = this.profile.preferences.find(p => p.key === 'Auto-Sync' && p.isEnabled);
        if (autoSync) {
            log('Auto-Sync enabled. Triggering background sync to IPFS...');
            // Background sync (don't await to keep response fast)
            const jwt = process.env.PINATA_JWT;
            if (jwt) {
                vault.syncToCloud({ pinataJwt: jwt })
                    .then(({ cid, txHash }) => log(`Auto-Sync Complete. CID: ${cid}, Tx: ${txHash}`))
                    .catch(err => log('Auto-Sync Failed:', err));
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
                category: 'communication', // Using 'communication' as a safe existing category
                isEnabled: enabled
            };
            this.profile.preferences.push(pref);
        } else {
            pref.isEnabled = enabled;
        }

        this.saveProfile();
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

// --- Transports ---

interface McpTransport {
    start(handler: (req: McpRequest) => Promise<void>): Promise<void>;
    send(response: McpResponse): Promise<void>;
}

class StdioTransport implements McpTransport {
    private buffer: string = '';

    async start(handler: (req: McpRequest) => Promise<void>): Promise<void> {
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', async (chunk) => {
            this.buffer += chunk.toString();
            const lines = this.buffer.split('\n');
            this.buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const req = JSON.parse(line) as McpRequest;
                        await handler(req);
                    } catch (e) {
                        log('Invalid JSON:', (e as Error).message);
                    }
                }
            }
        });

        // Keep process alive
        return new Promise(() => { });
    }

    async send(response: McpResponse): Promise<void> {
        process.stdout.write(JSON.stringify(response) + '\n');
    }
}

import * as http from 'http';
import { randomUUID } from 'crypto';

class SseTransport implements McpTransport {
    private port: number;
    private clients: Map<string, http.ServerResponse> = new Map();
    // Map request IDs to session IDs to route responses back to the correct client
    private requestSessionMap: Map<string | number, string> = new Map();

    constructor(port: number = 3001) {
        this.port = port;
    }

    async start(handler: (req: McpRequest) => Promise<void>): Promise<void> {
        const server = http.createServer(async (req, res) => {
            // CORS Headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            // SSE Endpoint
            if (req.url === '/sse') {
                this.handleSseConnection(req, res);
                return;
            }

            // Message Endpoint
            if (req.url === '/messages' && req.method === 'POST') {
                await this.handlePostMessage(req, res, handler);
                return;
            }

            res.writeHead(404);
            res.end('Not Found');
        });

        return new Promise((resolve) => {
            server.listen(this.port, () => {
                log(`SSE Transport listening on http://localhost:${this.port}`);
                log(`- SSE URL: http://localhost:${this.port}/sse`);
                log(`- POST URL: http://localhost:${this.port}/messages`);
                resolve();
            });
        });
    }

    private handleSseConnection(req: http.IncomingMessage, res: http.ServerResponse) {
        const sessionId = randomUUID();

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // Store client connection
        this.clients.set(sessionId, res);
        log(`Client connected: ${sessionId}`);

        // Send endpoint URL event
        const endpointEvent = {
            type: 'endpoint',
            endpoint: `http://localhost:${this.port}/messages?sessionId=${sessionId}`
        };
        res.write(`event: endpoint\ndata: ${JSON.stringify(endpointEvent)}\n\n`);

        req.on('close', () => {
            this.clients.delete(sessionId);
            log(`Client disconnected: ${sessionId}`);

            // Clean up any pending requests for this session (optional but good practice)
            for (const [reqId, sessId] of this.requestSessionMap.entries()) {
                if (sessId === sessionId) {
                    this.requestSessionMap.delete(reqId);
                }
            }
        });
    }

    private async handlePostMessage(req: http.IncomingMessage, res: http.ServerResponse, handler: (req: McpRequest) => Promise<void>) {
        let body = '';

        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const url = new URL(req.url || '', `http://localhost:${this.port}`);
                const sessionId = url.searchParams.get('sessionId');

                if (!sessionId || !this.clients.has(sessionId)) {
                    log('Invalid or missing sessionId in POST request');
                    res.writeHead(401);
                    res.end('Unauthorized: Invalid Session ID');
                    return;
                }

                const request = JSON.parse(body) as McpRequest;

                // Map the request ID to this session so we know where to send the response
                if (request.id !== undefined) {
                    this.requestSessionMap.set(request.id, sessionId);
                }

                await handler(request);

                res.writeHead(202); // Accepted
                res.end('Accepted');
            } catch (e) {
                log('Error handling POST:', (e as Error).message);
                res.writeHead(400);
                res.end('Bad Request');
            }
        });
    }

    async send(response: McpResponse): Promise<void> {
        const id = response.id;

        if (id === undefined) {
            // If it's a notification (no ID), typically we might broadcast or need distinct handling.
            // For now, let's log safe warning or broadcast if critical.
            // But per MCP, server notifications (like progress) should prolly be targeted if possible.
            // If this is a general broadcast (e.g. "resource changed"), send to all.
            for (const [, client] of this.clients) {
                const payload = JSON.stringify(response);
                client.write(`event: message\ndata: ${payload}\n\n`);
            }
            return;
        }

        const sessionId = this.requestSessionMap.get(id);

        if (sessionId) {
            const client = this.clients.get(sessionId);
            if (client) {
                const payload = JSON.stringify(response);
                client.write(`event: message\ndata: ${payload}\n\n`);
                this.requestSessionMap.delete(id); // Clean up
                return;
            } else {
                log(`Client not found for session ${sessionId}, creating orphan response`);
                this.requestSessionMap.delete(id); // Cleanup dead session ref
            }
        }

        log(`No active session found for response ID: ${id}. Dropping message.`);
    }
}

// --- MCP Server Logic ---

class ProfileMcpServer {
    private vault: ProfileVault;
    private transport: McpTransport;

    constructor(vault: ProfileVault, transport: McpTransport) {
        this.vault = vault;
        this.transport = transport;

        log('Server logic initialized');
    }

    async start() {
        await this.transport.start((req) => this.handleRequest(req));
    }

    private async handleRequest(req: McpRequest) {
        log('Request:', req.method, req.id);

        try {
            switch (req.method) {
                case 'initialize':
                    return this.handleInitialize(req);
                case 'notifications/initialized':
                    return; // Acknowledgment, no response needed
                case 'resources/list':
                    return this.handleResourcesList(req);
                case 'resources/read':
                    return this.handleResourcesRead(req);
                case 'tools/list':
                    return this.handleToolsList(req);
                case 'tools/call':
                    return this.handleToolsCall(req);
                case 'prompts/list':
                    return this.handlePromptsList(req);
                default:
                    // req is never here because we handled all known methods
                    const unknownReq = req as any;
                    this.sendError(unknownReq.id, -32601, `Method not found: ${unknownReq.method}`);
            }
        } catch (error) {
            this.sendError(req.id, -32603, (error as Error).message);
        }
    }

    // --- Protocol Handlers ---

    private async handleInitialize(req: InitializeRequest) {
        this.sendResponse(req.id, {
            protocolVersion: '2024-11-05',
            capabilities: {
                resources: {
                    subscribe: false,
                    listChanged: false
                },
                tools: {},
                prompts: {}
            },
            serverInfo: {
                name: 'profile-context-protocol',
                version: '1.0.0',
                description: 'User\'s portable AI profile with conversation history and preferences'
            }
        });
    }

    private async handleResourcesList(req: ListResourcesRequest) {
        const resources = [
            {
                uri: 'profile://identity',
                name: 'User Identity',
                description: 'Basic user information and role',
                mimeType: 'application/json'
            },
            {
                uri: 'profile://preferences',
                name: 'User Preferences',
                description: 'Communication style and output preferences',
                mimeType: 'application/json'
            },
            {
                uri: 'profile://memory/recent',
                name: 'Recent Memory',
                description: 'Last 20 memory fragments from conversations',
                mimeType: 'application/json'
            },
            {
                uri: 'profile://memory/all',
                name: 'All Memories',
                description: 'Complete long-term memory storage',
                mimeType: 'application/json'
            },
            {
                uri: 'profile://insights',
                name: 'User Insights',
                description: 'AI-derived insights about user preferences and expertise',
                mimeType: 'application/json'
            },
            {
                uri: 'profile://conversations/recent',
                name: 'Recent Conversations',
                description: 'Summary of recent conversations across all providers',
                mimeType: 'application/json'
            },
            {
                uri: 'profile://stats',
                name: 'Profile Statistics',
                description: 'Overview of profile data and sources',
                mimeType: 'application/json'
            }
        ];

        this.sendResponse(req.id, { resources });
    }

    private async handleResourcesRead(req: ReadResourceRequest) {
        const { uri } = req.params || {};

        if (!uri) {
            return this.sendError(req.id, -32602, 'Missing uri parameter');
        }

        const content = await this.vault.readResource(uri);

        this.sendResponse(req.id, {
            contents: [{
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(content, null, 2)
            }]
        });
    }

    private async handleToolsList(req: ListToolsRequest) {
        const tools = [
            {
                name: 'search_memory',
                description: 'Search the user\'s long-term memory for relevant context. Use this to find what the user has discussed before.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Search query (keywords or topic)'
                        },
                        limit: {
                            type: 'integer',
                            description: 'Maximum results to return (default: 10)',
                            default: 10
                        }
                    },
                    required: ['query']
                }
            },
            {
                name: 'add_memory',
                description: 'Store a new insight or fact about the user. Use this to remember important information from the conversation.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        content: {
                            type: 'string',
                            description: 'The insight or fact to remember'
                        },
                        tags: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Tags for categorization'
                        },
                        type: {
                            type: 'string',
                            enum: ['technical', 'personal', 'preference', 'fact'],
                            description: 'Type of memory'
                        }
                    },
                    required: ['content']
                }
            },
            {
                name: 'archive_conversation',
                description: 'Archive the current conversation into the Profile Vault. Call this when the user asks to save the chat, or if auto-archive is enabled.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        title: { type: 'string', description: 'Title of the conversation' },
                        messages: {
                            type: 'array',
                            description: 'List of messages to archive',
                            items: {
                                type: 'object',
                                properties: {
                                    role: { type: 'string' },
                                    content: { type: 'string' },
                                    timestamp: { type: 'number' }
                                }
                            }
                        },
                        summary: { type: 'string', description: 'Brief summary of the discussion' }
                    },
                    required: ['title', 'messages']
                }
            },
            {
                name: 'toggle_auto_archive',
                description: 'Enable or disable automatic archiving of conversations.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        enabled: { type: 'boolean' }
                    },
                    required: ['enabled']
                }
            },
            {
                name: 'toggle_auto_sync',
                description: 'Enable or disable automatic cloud sync when archiving conversations.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        enabled: { type: 'boolean' }
                    },
                    required: ['enabled']
                }
            },
            {
                name: 'sync_vault',
                description: 'Trigger a manual sync of the Profile Vault to Decentralized Storage (IPFS).',
                inputSchema: {
                    type: 'object',
                    properties: {},
                }
            },
            {
                name: 'analyze_vault',
                description: 'Analyzes the vault to group conversations by topic and identify duplicates. Use this BEFORE summarizing.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                }
            },
            {
                name: 'grant_access',
                description: 'Generate a cryptographically signed Access Grant for a specific agent/user.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        grantee: { type: 'string', description: 'Name/ID of the agent receiving access' },
                        permissions: {
                            type: 'array',
                            items: { type: 'string', enum: ['read_identity', 'read_memory', 'write_memory'] }
                        },
                        durationSeconds: { type: 'number', description: 'Validity duration in seconds' }
                    },
                    required: ['grantee']
                }
            },
            {
                name: 'get_context_for_task',
                description: 'Get relevant background context for a specific task. Returns memories and insights related to the task.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        task_description: {
                            type: 'string',
                            description: 'Description of the task or topic'
                        }
                    },
                    required: ['task_description']
                }
            },
            {
                name: 'get_conversation_history',
                description: 'Retrieve past conversations on a specific topic from any AI provider.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        topic: {
                            type: 'string',
                            description: 'Topic to search for'
                        },
                        provider: {
                            type: 'string',
                            enum: ['openai', 'anthropic', 'google', 'all'],
                            description: 'Filter by provider (default: all)'
                        }
                    },
                    required: ['topic']
                }
            }
        ];

        this.sendResponse(req.id, { tools });
    }

    private async handleToolsCall(req: CallToolRequest) {
        const { name, arguments: args } = req.params || {};

        if (!name) {
            return this.sendError(req.id, -32602, 'Missing tool name');
        }

        const result = await this.vault.callTool(name, args || {});

        this.sendResponse(req.id, {
            content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
            }]
        });
    }

    private async handlePromptsList(req: ListPromptsRequest) {
        const prompts = [
            {
                name: 'introduce_user',
                description: 'Get an introduction to the user based on their profile',
                arguments: []
            },
            {
                name: 'summarize_history',
                description: 'Summarize the user\'s conversation history on a topic',
                arguments: [
                    {
                        name: 'topic',
                        description: 'Topic to summarize',
                        required: true
                    }
                ]
            }
        ];

        this.sendResponse(req.id, { prompts });
    }

    // --- Response Helpers ---

    private async sendResponse(id: number | string, result: any) {
        const msg: McpResponse = { jsonrpc: '2.0', id, result };
        await this.transport.send(msg);
        log('Response sent for id:', id);
    }

    private async sendError(id: number | string, code: number, message: string) {
        const msg: McpResponse = { jsonrpc: '2.0', id, error: { code, message } };
        await this.transport.send(msg);
        log('Error sent:', code, message);
    }
}

// --- Start Server ---

if (require.main === module) {
    const vault = new ProfileVault();

    // Select transport based on environment
    const transportType = process.env.MCP_TRANSPORT || 'stdio';
    let transport: McpTransport;

    if (transportType === 'sse') {
        const port = parseInt(process.env.PORT || '3001');
        transport = new SseTransport(port);
    } else {
        transport = new StdioTransport();
    }

    const server = new ProfileMcpServer(vault, transport);

    log(`Profile Context Protocol MCP Server running in ${transportType} mode...`);
    log('Vault path:', VAULT_PATH);

    server.start().catch((err) => {
        log('Server error:', err);
        process.exit(1);
    });
}
