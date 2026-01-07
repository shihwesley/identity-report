/**
 * MCP SSE Transport
 *
 * Implements the Model Context Protocol using Server-Sent Events (SSE).
 * Enhanced with JWT authentication support.
 */

import * as http from 'http';
import { randomUUID } from 'crypto';
import { McpRequest, McpResponse } from '../types';
import { McpTransport } from './index';
import { log } from '../config';
import { McpAuthMiddleware, AuthenticatedSession } from '../auth';

export interface SseSession {
    sessionId: string;
    response: http.ServerResponse;
    authSession?: AuthenticatedSession;
    connectedAt: number;
    ip?: string;
}

export class SseTransport implements McpTransport {
    private port: number;
    private clients: Map<string, SseSession> = new Map();
    // Map request IDs to session IDs to route responses back to the correct client
    private requestSessionMap: Map<string | number, string> = new Map();
    private authMiddleware: McpAuthMiddleware | null = null;

    constructor(port: number = 3001) {
        this.port = port;
    }

    /**
     * Set the authentication middleware.
     */
    setAuthMiddleware(middleware: McpAuthMiddleware): void {
        this.authMiddleware = middleware;
        log('SSE Transport: Auth middleware configured');
    }

    /**
     * Get authenticated session for a connection.
     */
    getAuthSession(sessionId: string): AuthenticatedSession | undefined {
        return this.clients.get(sessionId)?.authSession;
    }

    async start(handler: (req: McpRequest, sessionId?: string) => Promise<void>): Promise<void> {
        const server = http.createServer(async (req, res) => {
            // CORS Headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            // SSE Endpoint
            if (req.url?.startsWith('/sse')) {
                await this.handleSseConnection(req, res);
                return;
            }

            // Message Endpoint
            if (req.url?.startsWith('/messages') && req.method === 'POST') {
                await this.handlePostMessage(req, res, handler);
                return;
            }

            // Health check endpoint
            if (req.url === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'healthy',
                    activeSessions: this.clients.size,
                    authEnabled: !!this.authMiddleware
                }));
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
                log(`- Health: http://localhost:${this.port}/health`);
                log(`- Auth: ${this.authMiddleware ? 'enabled' : 'disabled'}`);
                resolve();
            });
        });
    }

    private async handleSseConnection(req: http.IncomingMessage, res: http.ServerResponse) {
        const sessionId = randomUUID();
        const ip = this.getClientIp(req);

        // Authenticate if middleware is configured
        let authSession: AuthenticatedSession | undefined;
        if (this.authMiddleware) {
            const authResult = await this.authMiddleware.authenticate({
                headers: this.getHeaders(req),
                ip
            });

            if (!authResult.authenticated) {
                log(`SSE connection rejected: ${authResult.error}`);
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: authResult.error }));
                return;
            }

            authSession = authResult.session;
        }

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // Store client connection with auth info
        const sseSession: SseSession = {
            sessionId,
            response: res,
            authSession,
            connectedAt: Date.now(),
            ip
        };
        this.clients.set(sessionId, sseSession);
        log(`Client connected: ${sessionId}${authSession ? ` (${authSession.client})` : ''}`);

        // Send endpoint URL event
        const endpointEvent = {
            type: 'endpoint',
            endpoint: `http://localhost:${this.port}/messages?sessionId=${sessionId}`
        };
        res.write(`event: endpoint\ndata: ${JSON.stringify(endpointEvent)}\n\n`);

        // Log connection if auth middleware is configured
        if (this.authMiddleware && authSession) {
            this.authMiddleware.getAuditLogger().logConnectionOpened({
                sessionId: authSession.sessionId,
                ip,
                client: authSession.client
            });
        }

        req.on('close', () => {
            const session = this.clients.get(sessionId);
            this.clients.delete(sessionId);
            log(`Client disconnected: ${sessionId}`);

            // Log disconnection
            if (this.authMiddleware && session?.authSession) {
                this.authMiddleware.removeSession(session.authSession.sessionId);
            }

            // Clean up any pending requests for this session
            for (const [reqId, sessId] of this.requestSessionMap.entries()) {
                if (sessId === sessionId) {
                    this.requestSessionMap.delete(reqId);
                }
            }
        });
    }

    /**
     * Get client IP from request.
     */
    private getClientIp(req: http.IncomingMessage): string | undefined {
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
        }
        return req.socket.remoteAddress;
    }

    /**
     * Get headers as a simple object.
     */
    private getHeaders(req: http.IncomingMessage): Record<string, string> {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') {
                headers[key] = value;
            } else if (Array.isArray(value)) {
                headers[key] = value[0];
            }
        }
        return headers;
    }

    private async handlePostMessage(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        handler: (req: McpRequest, sessionId?: string) => Promise<void>
    ) {
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

                // Pass session ID to handler for authorization checks
                await handler(request, sessionId);

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
            for (const [, session] of this.clients) {
                const payload = JSON.stringify(response);
                session.response.write(`event: message\ndata: ${payload}\n\n`);
            }
            return;
        }

        const sessionId = this.requestSessionMap.get(id);

        if (sessionId) {
            const session = this.clients.get(sessionId);
            if (session) {
                const payload = JSON.stringify(response);
                session.response.write(`event: message\ndata: ${payload}\n\n`);
                this.requestSessionMap.delete(id); // Clean up
                return;
            } else {
                log(`Client not found for session ${sessionId}, creating orphan response`);
                this.requestSessionMap.delete(id); // Cleanup dead session ref
            }
        }

        log(`No active session found for response ID: ${id}. Dropping message.`);
    }

    /**
     * Get active session count.
     */
    getActiveSessionCount(): number {
        return this.clients.size;
    }

    /**
     * Get all active sessions info.
     */
    getActiveSessions(): Array<{
        sessionId: string;
        authSessionId?: string;
        client?: string;
        connectedAt: number;
        ip?: string;
    }> {
        return Array.from(this.clients.values()).map(session => ({
            sessionId: session.sessionId,
            authSessionId: session.authSession?.sessionId,
            client: session.authSession?.client,
            connectedAt: session.connectedAt,
            ip: session.ip
        }));
    }
}
