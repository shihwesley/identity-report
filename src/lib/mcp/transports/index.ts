/**
 * MCP Transport Interface
 * 
 * Defines the contract for MCP transport layers.
 */

import { McpRequest, McpResponse } from '../types';
import { StdioTransport } from './stdio';
import { SseTransport } from './sse';

export interface McpTransport {
    /** Start the transport and register a request handler */
    start(handler: (req: McpRequest) => Promise<void>): Promise<void>;
    /** Send a response back through the transport */
    send(response: McpResponse): Promise<void>;
}

/**
 * Factory to create a transport based on the type.
 */
export function createTransport(type: 'stdio' | 'sse', port?: number): McpTransport {
    if (type === 'sse') {
        return new SseTransport(port);
    }
    return new StdioTransport();
}

export { StdioTransport, SseTransport };
