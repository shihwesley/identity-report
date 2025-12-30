/**
 * MCP STDIO Transport
 * 
 * Implements the Model Context Protocol using standard input/output.
 */

import { McpRequest, McpResponse } from '../types';
import { McpTransport } from './index';
import { log } from '../config';

export class StdioTransport implements McpTransport {
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
