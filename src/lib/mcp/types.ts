/**
 * MCP Protocol Types
 * 
 * TypeScript interfaces for the Model Context Protocol (MCP) requests and responses.
 * Extracted from server.ts for better modularity and reusability.
 */

// --- Base Types ---

export interface BaseMcpRequest {
    jsonrpc: '2.0';
    id: number | string;
}

// --- Request Types ---

export interface InitializeRequest extends BaseMcpRequest {
    method: 'initialize';
    params?: {
        protocolVersion?: string;
        capabilities?: Record<string, unknown>;
        clientInfo?: {
            name: string;
            version: string;
        };
    };
}

export interface InitializedNotification extends BaseMcpRequest {
    method: 'notifications/initialized';
    params?: Record<string, unknown>;
}

export interface ListResourcesRequest extends BaseMcpRequest {
    method: 'resources/list';
    params?: {
        cursor?: string;
    };
}

export interface ReadResourceRequest extends BaseMcpRequest {
    method: 'resources/read';
    params: {
        uri: string;
    };
}

export interface ListToolsRequest extends BaseMcpRequest {
    method: 'tools/list';
    params?: {
        cursor?: string;
    };
}

export interface CallToolRequest extends BaseMcpRequest {
    method: 'tools/call';
    params: {
        name: string;
        arguments?: Record<string, unknown>;
    };
}

export interface ListPromptsRequest extends BaseMcpRequest {
    method: 'prompts/list';
    params?: {
        cursor?: string;
    };
}

// --- Union Type ---

export type McpRequest =
    | InitializeRequest
    | InitializedNotification
    | ListResourcesRequest
    | ReadResourceRequest
    | ListToolsRequest
    | CallToolRequest
    | ListPromptsRequest;

// --- Response Types ---

export interface McpResponse {
    jsonrpc: '2.0';
    id: number | string;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}

// --- Tool Argument Types ---

export interface SearchMemoryArgs {
    query: string;
    limit?: number;
}

export interface AddMemoryArgs {
    content: string;
    tags?: string[];
    type?: 'technical' | 'personal' | 'preference' | 'fact';
}

export interface ArchiveConversationArgs {
    title: string;
    messages: Array<{
        role: string;
        content: string;
        timestamp?: number;
    }>;
    provider?: string;
    model?: string;
    summary?: string;
}

export interface ToggleAutoArchiveArgs {
    enabled: boolean;
}

export interface ToggleAutoSyncArgs {
    enabled: boolean;
}

export interface GrantAccessArgs {
    grantee: string;
    permissions?: ('read_identity' | 'read_memory' | 'write_memory')[];
    durationSeconds?: number;
}

export interface GetContextForTaskArgs {
    task_description: string;
}

export interface GetConversationHistoryArgs {
    topic: string;
    provider?: 'openai' | 'anthropic' | 'google' | 'all';
}

// --- Resource Types ---

export interface McpResource {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
}

export interface McpTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}

export interface McpPrompt {
    name: string;
    description: string;
    arguments: Array<{
        name: string;
        description: string;
        required: boolean;
    }>;
}
