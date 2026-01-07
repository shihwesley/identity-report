/**
 * Profile Context Protocol (PCP) MCP Server
 *
 * The main server module that orchestrates profile data (vault) and transport layers.
 * Enhanced with JWT authentication and audit logging.
 */

import { ProfileVault } from './vault';
import {
    McpRequest,
    McpResponse,
    InitializeRequest,
    ListResourcesRequest,
    ReadResourceRequest,
    ListToolsRequest,
    CallToolRequest,
    ListPromptsRequest
} from './types';
import { McpTransport, createTransport, SseTransport } from './transports';
import { TRANSPORT_MODE, SSE_PORT, VAULT_PATH, log, logError, logAudit } from './config';
import { McpAuthMiddleware, createAuthMiddleware } from './auth';
import { getAuditLogger, AuditLogger } from './audit';

export class ProfileMcpServer {
    private vault: ProfileVault;
    private transport: McpTransport;
    private authMiddleware: McpAuthMiddleware | null = null;
    private auditLogger: AuditLogger;
    private transportMode: 'stdio' | 'sse';

    constructor(vault: ProfileVault, transport: McpTransport, transportMode: 'stdio' | 'sse' = 'stdio') {
        this.vault = vault;
        this.transport = transport;
        this.transportMode = transportMode;
        this.auditLogger = getAuditLogger();

        // Create auth middleware (STDIO is trusted, SSE requires auth)
        this.authMiddleware = createAuthMiddleware({
            transport: transportMode,
            auditLogger: this.auditLogger
        });

        // Attach auth middleware to SSE transport
        if (transportMode === 'sse' && transport.setAuthMiddleware) {
            transport.setAuthMiddleware(this.authMiddleware);
        }

        log('Server logic initialized', { transport: transportMode, authEnabled: !!this.authMiddleware });
    }

    /**
     * Set the JWT public key for authentication.
     * Called when vault is unlocked.
     */
    setJwtPublicKey(publicKey: Uint8Array | string): void {
        if (this.authMiddleware) {
            this.authMiddleware.setJwtPublicKey(publicKey);
            log('JWT public key configured for MCP auth');
        }
    }

    /**
     * Get the auth middleware instance.
     */
    getAuthMiddleware(): McpAuthMiddleware | null {
        return this.authMiddleware;
    }

    /**
     * Get the audit logger instance.
     */
    getAuditLogger(): AuditLogger {
        return this.auditLogger;
    }

    async start() {
        await this.transport.start((req, sessionId) => this.handleRequest(req, sessionId));

        // Start session cleanup interval (clean sessions older than 1 hour)
        if (this.authMiddleware) {
            setInterval(() => {
                this.authMiddleware?.cleanupExpiredSessions(3600000);
            }, 300000); // Check every 5 minutes
        }
    }

    private async handleRequest(req: McpRequest, sessionId?: string) {
        log('Received MCP Request', { method: req.method, id: req.id, sessionId });

        try {
            switch (req.method) {
                case 'initialize':
                    return this.handleInitialize(req as InitializeRequest);
                case 'notifications/initialized':
                    return; // Acknowledgment, no response needed
                case 'resources/list':
                    return this.handleResourcesList(req as ListResourcesRequest);
                case 'resources/read':
                    return this.handleResourcesRead(req as ReadResourceRequest, sessionId);
                case 'tools/list':
                    return this.handleToolsList(req as ListToolsRequest);
                case 'tools/call':
                    return this.handleToolsCall(req as CallToolRequest, sessionId);
                case 'prompts/list':
                    return this.handlePromptsList(req as ListPromptsRequest);
                default:
                    const unknownReq = req as any;
                    await this.sendError(unknownReq.id, -32601, `Method not found: ${unknownReq.method}`);
            }
        } catch (error) {
            await this.sendError(req.id, -32603, (error as Error).message);
        }
    }

    /**
     * Get or create an auth session ID for authorization.
     * For STDIO, creates a local session. For SSE, uses the provided session.
     */
    private getAuthSessionId(sseSessionId?: string): string {
        if (this.transportMode === 'stdio') {
            // For STDIO, create a local session if we don't have one
            const sessions = this.authMiddleware?.getActiveSessions() || [];
            const localSession = sessions.find(s => s.did === 'local');
            if (localSession) {
                return localSession.sessionId;
            }
            // Create new local session via authenticate
            // This is synchronous for STDIO since it's always trusted
            return 'local-session';
        }

        // For SSE, we need to map the SSE session ID to the auth session ID
        if (sseSessionId && this.transport instanceof SseTransport) {
            const authSession = (this.transport as SseTransport).getAuthSession(sseSessionId);
            if (authSession) {
                return authSession.sessionId;
            }
        }

        return sseSessionId || 'unknown';
    }

    // --- Protocol Handlers ---

    private async handleInitialize(req: InitializeRequest) {
        await this.sendResponse(req.id, {
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

        await this.sendResponse(req.id, { resources });
    }

    private async handleResourcesRead(req: ReadResourceRequest, sseSessionId?: string) {
        const { uri } = req.params || {};

        if (!uri) {
            return this.sendError(req.id, -32602, 'Missing uri parameter');
        }

        // Authorization check (for SSE transport)
        if (this.authMiddleware && this.transportMode === 'sse') {
            const authSessionId = this.getAuthSessionId(sseSessionId);
            const authResult = await this.authMiddleware.authorizeResourceRead(authSessionId, uri);

            if (!authResult.authorized) {
                logError('Resource read denied', { uri, reason: authResult.reason });
                return this.sendError(req.id, -32600, authResult.reason || 'Authorization denied');
            }
        }

        const content = await this.vault.readResource(uri);

        await this.sendResponse(req.id, {
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
                description: 'Search the user\'s long-term memory for relevant context.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search query' },
                        limit: { type: 'integer', description: 'Max results', default: 10 }
                    },
                    required: ['query']
                }
            },
            {
                name: 'add_memory',
                description: 'Store a new insight or fact about the user.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        content: { type: 'string', description: 'The insight to remember' },
                        tags: { type: 'array', items: { type: 'string' } },
                        type: { type: 'string', enum: ['technical', 'personal', 'preference', 'fact'] }
                    },
                    required: ['content']
                }
            },
            {
                name: 'archive_conversation',
                description: 'Archive the current conversation into the Profile Vault.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        title: { type: 'string', description: 'Conversation title' },
                        messages: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    role: { type: 'string' },
                                    content: { type: 'string' },
                                    timestamp: { type: 'number' }
                                }
                            }
                        },
                        summary: { type: 'string', description: 'Brief summary' }
                    },
                    required: ['title', 'messages']
                }
            },
            {
                name: 'toggle_auto_archive',
                description: 'Enable or disable automatic archiving.',
                inputSchema: {
                    type: 'object',
                    properties: { enabled: { type: 'boolean' } },
                    required: ['enabled']
                }
            },
            {
                name: 'toggle_auto_sync',
                description: 'Enable or disable automatic cloud sync.',
                inputSchema: {
                    type: 'object',
                    properties: { enabled: { type: 'boolean' } },
                    required: ['enabled']
                }
            },
            {
                name: 'sync_vault',
                description: 'Trigger a manual sync to Cloud (IPFS).',
                inputSchema: { type: 'object', properties: {} }
            },
            {
                name: 'analyze_vault',
                description: 'Analyzes the vault for topics and duplicates.',
                inputSchema: { type: 'object', properties: {} }
            },
            {
                name: 'grant_access',
                description: 'Generate a signed Access Grant.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        grantee: { type: 'string' },
                        permissions: { type: 'array', items: { type: 'string' } },
                        durationSeconds: { type: 'number' }
                    },
                    required: ['grantee']
                }
            },
            {
                name: 'get_context_for_task',
                description: 'Get relevant background context for a specific task.',
                inputSchema: {
                    type: 'object',
                    properties: { task_description: { type: 'string' } },
                    required: ['task_description']
                }
            },
            {
                name: 'get_conversation_history',
                description: 'Retrieve past conversations on a specific topic.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        topic: { type: 'string' },
                        provider: { type: 'string', enum: ['openai', 'anthropic', 'google', 'all'] }
                    },
                    required: ['topic']
                }
            }
        ];

        await this.sendResponse(req.id, { tools });
    }

    private async handleToolsCall(req: CallToolRequest, sseSessionId?: string) {
        const { name, arguments: args } = req.params || {};

        if (!name) {
            return this.sendError(req.id, -32602, 'Missing tool name');
        }

        // Authorization check (for SSE transport)
        if (this.authMiddleware && this.transportMode === 'sse') {
            const authSessionId = this.getAuthSessionId(sseSessionId);
            const authResult = await this.authMiddleware.authorizeToolCall(
                authSessionId,
                name,
                args as Record<string, unknown>
            );

            if (!authResult.authorized) {
                logError('Tool call denied', { name, reason: authResult.reason });
                return this.sendError(req.id, -32600, authResult.reason || 'Authorization denied');
            }
        }

        log('Executing tool', { name, args });
        const result = await this.vault.callTool(name, args || {});
        logAudit('Tool executed', { name, success: !('error' in (result as any)) });

        await this.sendResponse(req.id, {
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
                description: 'Get an introduction to the user',
                arguments: []
            },
            {
                name: 'summarize_history',
                description: 'Summarize history on a topic',
                arguments: [{ name: 'topic', description: 'Topic', required: true }]
            }
        ];

        await this.sendResponse(req.id, { prompts });
    }

    // --- Response Helpers ---

    private async sendResponse(id: number | string, result: any) {
        const msg: McpResponse = { jsonrpc: '2.0', id, result };
        await this.transport.send(msg);
        log('Response sent', { id });
    }

    private async sendError(id: number | string, code: number, message: string) {
        const msg: McpResponse = { jsonrpc: '2.0', id, error: { code, message } };
        await this.transport.send(msg);
        logError('Error sent', { id, code, message });
    }
}

// --- Start Server ---

if (require.main === module) {
    const vault = new ProfileVault();
    const transportMode = TRANSPORT_MODE as 'stdio' | 'sse';
    const transport = createTransport(transportMode, SSE_PORT);
    const server = new ProfileMcpServer(vault, transport, transportMode);

    log(`Profile Context Protocol MCP Server running in ${TRANSPORT_MODE} mode...`);
    log('Vault path:', VAULT_PATH);
    log('Authentication:', transportMode === 'stdio' ? 'trusted (local)' : 'JWT required');

    server.start().catch((err) => {
        log('Server error:', err);
        process.exit(1);
    });
}
