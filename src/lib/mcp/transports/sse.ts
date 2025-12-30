/**
 * MCP SSE Transport
 * 
 * Implements the Model Context Protocol using Server-Sent Events (SSE).
 */

import * as http from 'http';
import { randomUUID } from 'crypto';
import { McpRequest, McpResponse } from '../types';
import { McpTransport } from './index';
import { log } from '../config';

export class SseTransport implements McpTransport {
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
