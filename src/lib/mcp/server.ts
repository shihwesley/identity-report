/**
 * Profile Context Protocol (PCP) MCP Server
 * 
 * The main server module that orchestrates profile data (vault) and transport layers.
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
import { McpTransport, createTransport } from './transports';
import { TRANSPORT_MODE, SSE_PORT, VAULT_PATH, log, logError, logAudit } from './config';

export class ProfileMcpServer {
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
        log('Received MCP Request', { method: req.method, id: req.id });

        try {
            switch (req.method) {
                case 'initialize':
                    return this.handleInitialize(req as InitializeRequest);
                case 'notifications/initialized':
                    return; // Acknowledgment, no response needed
                case 'resources/list':
                    return this.handleResourcesList(req as ListResourcesRequest);
                case 'resources/read':
                    return this.handleResourcesRead(req as ReadResourceRequest);
                case 'tools/list':
                    return this.handleToolsList(req as ListToolsRequest);
                case 'tools/call':
                    return this.handleToolsCall(req as CallToolRequest);
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

    private async handleResourcesRead(req: ReadResourceRequest) {
        const { uri } = req.params || {};

        if (!uri) {
            return this.sendError(req.id, -32602, 'Missing uri parameter');
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

    private async handleToolsCall(req: CallToolRequest) {
        const { name, arguments: args } = req.params || {};

        if (!name) {
            return this.sendError(req.id, -32602, 'Missing tool name');
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
    const transport = createTransport(TRANSPORT_MODE as any, SSE_PORT);
    const server = new ProfileMcpServer(vault, transport);

    log(`Profile Context Protocol MCP Server running in ${TRANSPORT_MODE} mode...`);
    log('Vault path:', VAULT_PATH);

    server.start().catch((err) => {
        log('Server error:', err);
        process.exit(1);
    });
}
