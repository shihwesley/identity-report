/**
 * MCP Authentication Middleware
 *
 * Provides JWT-based session authentication and AccessGrant-based authorization
 * for the MCP server. Implements the spec's dual-layer security model.
 */

import { verifyJwt, verifySignature, JwtPayload } from '../vault/identity';
import { AccessGrant } from '../types';
import { AuditLogger, getAuditLogger } from './audit';
import { log, logError } from './config';

// ============================================================
// Types
// ============================================================

export type Permission =
    | 'read:identity'
    | 'read:memories'
    | 'read:conversations'
    | 'read:preferences'
    | 'read:projects'
    | 'read:stats'
    | 'write:memories'
    | 'write:conversations'
    | 'admin:grants'
    | 'admin:sync'
    | 'admin:settings';

export interface AuthenticatedSession {
    sessionId: string;
    did: string;
    client: string;
    connectedAt: number;
    lastActivity: number;
    scope: string[];
    ip?: string;
}

export interface AuthResult {
    authenticated: boolean;
    session?: AuthenticatedSession;
    error?: string;
}

export interface AuthorizationResult {
    authorized: boolean;
    reason?: string;
}

export interface McpAuthRequest {
    headers?: Record<string, string>;
    ip?: string;
    sessionId?: string;  // For existing sessions (SSE)
}

// ============================================================
// Permission Mapping
// ============================================================

/**
 * Maps MCP tools to required permissions.
 * Tools not in this map are considered public (no permission required).
 */
const TOOL_PERMISSIONS: Record<string, Permission> = {
    // Read operations
    'search_memory': 'read:memories',
    'get_context_for_task': 'read:memories',
    'get_conversation_history': 'read:conversations',

    // Write operations
    'add_memory': 'write:memories',
    'archive_conversation': 'write:conversations',

    // Admin operations
    'grant_access': 'admin:grants',
    'sync_vault': 'admin:sync',
    'toggle_auto_archive': 'admin:settings',
    'toggle_auto_sync': 'admin:settings',
    'analyze_vault': 'admin:settings'
};

/**
 * Maps MCP resources to required permissions.
 */
const RESOURCE_PERMISSIONS: Record<string, Permission> = {
    'profile://identity': 'read:identity',
    'profile://preferences': 'read:preferences',
    'profile://memory/recent': 'read:memories',
    'profile://memory/all': 'read:memories',
    'profile://insights': 'read:memories',
    'profile://conversations/recent': 'read:conversations',
    'profile://stats': 'read:stats'
};

/**
 * Maps legacy AccessGrant permissions to new permission system.
 */
function mapLegacyPermission(legacyPerm: string): Permission[] {
    switch (legacyPerm) {
        case 'read_identity':
            return ['read:identity', 'read:preferences'];
        case 'read_memory':
            return ['read:memories', 'read:conversations', 'read:stats'];
        case 'write_memory':
            return ['write:memories', 'write:conversations'];
        default:
            return [];
    }
}

// ============================================================
// MCP Auth Middleware
// ============================================================

export class McpAuthMiddleware {
    private sessions: Map<string, AuthenticatedSession> = new Map();
    private revokedGrants: Set<string> = new Set();
    private auditLogger: AuditLogger;
    private jwtPublicKey: Uint8Array | string | null = null;
    private transport: 'stdio' | 'sse';

    constructor(options: {
        transport: 'stdio' | 'sse';
        jwtPublicKey?: Uint8Array | string;
        auditLogger?: AuditLogger;
    }) {
        this.transport = options.transport;
        this.jwtPublicKey = options.jwtPublicKey ?? null;
        this.auditLogger = options.auditLogger ?? getAuditLogger();

        log(`Auth middleware initialized for ${this.transport} transport`);
    }

    /**
     * Set the JWT public key for verification.
     * Called when vault is unlocked and keys are available.
     */
    setJwtPublicKey(publicKey: Uint8Array | string): void {
        this.jwtPublicKey = publicKey;
        log('JWT public key configured');
    }

    /**
     * Authenticate an incoming request.
     * STDIO transport is trusted (no auth required).
     * SSE transport requires JWT authentication.
     */
    async authenticate(request: McpAuthRequest): Promise<AuthResult> {
        // STDIO is trusted - create a local session
        if (this.transport === 'stdio') {
            const session = this.createLocalSession();
            return { authenticated: true, session };
        }

        // SSE requires JWT
        const authHeader = request.headers?.authorization || request.headers?.Authorization;
        if (!authHeader) {
            this.auditLogger.logAuthFailure({
                reason: 'missing_authorization_header',
                ip: request.ip
            });
            return { authenticated: false, error: 'Missing authorization header' };
        }

        const token = authHeader.replace(/^Bearer\s+/i, '');
        if (!token) {
            this.auditLogger.logAuthFailure({
                reason: 'missing_token',
                ip: request.ip
            });
            return { authenticated: false, error: 'Missing token' };
        }

        if (!this.jwtPublicKey) {
            this.auditLogger.logAuthFailure({
                reason: 'jwt_key_not_configured',
                ip: request.ip
            });
            return { authenticated: false, error: 'Authentication not configured' };
        }

        try {
            const payload = await verifyJwt(token, this.jwtPublicKey);
            const session = this.createSession(payload, request.ip);

            this.auditLogger.logAuthSuccess({
                sessionId: session.sessionId,
                did: session.did,
                client: session.client,
                ip: request.ip
            });

            return { authenticated: true, session };
        } catch (error) {
            this.auditLogger.logAuthFailure({
                reason: (error as Error).message,
                ip: request.ip
            });
            return { authenticated: false, error: (error as Error).message };
        }
    }

    /**
     * Create a local session for STDIO transport.
     */
    private createLocalSession(): AuthenticatedSession {
        const session: AuthenticatedSession = {
            sessionId: `local-${crypto.randomUUID()}`,
            did: 'local',
            client: 'local-stdio',
            connectedAt: Date.now(),
            lastActivity: Date.now(),
            scope: ['*']  // Full access for local
        };

        this.sessions.set(session.sessionId, session);
        return session;
    }

    /**
     * Create a session from a verified JWT payload.
     */
    private createSession(payload: JwtPayload, ip?: string): AuthenticatedSession {
        const session: AuthenticatedSession = {
            sessionId: crypto.randomUUID(),
            did: payload.sub,
            client: payload.client,
            connectedAt: Date.now(),
            lastActivity: Date.now(),
            scope: payload.scope,
            ip
        };

        this.sessions.set(session.sessionId, session);

        this.auditLogger.log({
            type: 'session_created',
            sessionId: session.sessionId,
            did: session.did,
            client: session.client,
            ip
        });

        return session;
    }

    /**
     * Get an existing session by ID.
     */
    getSession(sessionId: string): AuthenticatedSession | null {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = Date.now();
        }
        return session ?? null;
    }

    /**
     * Remove a session (on disconnect).
     */
    removeSession(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.auditLogger.logConnectionClosed({
                sessionId,
                duration: Date.now() - session.connectedAt
            });
            this.sessions.delete(sessionId);
        }
    }

    /**
     * Authorize a tool call.
     */
    async authorizeToolCall(
        sessionId: string,
        toolName: string,
        params?: Record<string, unknown>,
        accessGrant?: AccessGrant
    ): Promise<AuthorizationResult> {
        const startTime = Date.now();
        const session = this.sessions.get(sessionId);

        if (!session) {
            this.auditLogger.logAuthorizationFailure({
                sessionId,
                tool: toolName,
                reason: 'session_not_found'
            });
            return { authorized: false, reason: 'Session not found' };
        }

        // Update activity
        session.lastActivity = Date.now();

        // Local sessions have full access
        if (session.did === 'local') {
            this.auditLogger.logToolCall({
                sessionId,
                tool: toolName,
                params,
                result: 'allowed',
                duration: Date.now() - startTime
            });
            return { authorized: true };
        }

        // Check if tool requires permission
        const requiredPermission = TOOL_PERMISSIONS[toolName];
        if (!requiredPermission) {
            // Public tool - allowed
            this.auditLogger.logToolCall({
                sessionId,
                tool: toolName,
                params,
                result: 'allowed',
                duration: Date.now() - startTime
            });
            return { authorized: true };
        }

        // Check session scope
        if (session.scope.includes('*') || session.scope.includes(requiredPermission)) {
            this.auditLogger.logToolCall({
                sessionId,
                tool: toolName,
                params,
                result: 'allowed',
                duration: Date.now() - startTime
            });
            return { authorized: true };
        }

        // Check access grant if provided
        if (accessGrant) {
            const grantResult = await this.verifyAccessGrant(accessGrant, requiredPermission);
            if (grantResult.authorized) {
                this.auditLogger.logToolCall({
                    sessionId,
                    tool: toolName,
                    params,
                    grantId: accessGrant.id,
                    result: 'allowed',
                    duration: Date.now() - startTime
                });
                return { authorized: true };
            }
            // Fall through to denial
        }

        // Denied
        this.auditLogger.logToolCall({
            sessionId,
            tool: toolName,
            params,
            result: 'denied',
            reason: `Missing permission: ${requiredPermission}`,
            duration: Date.now() - startTime
        });

        return {
            authorized: false,
            reason: `Permission denied: ${requiredPermission} required`
        };
    }

    /**
     * Authorize a resource read.
     */
    async authorizeResourceRead(
        sessionId: string,
        resourceUri: string,
        accessGrant?: AccessGrant
    ): Promise<AuthorizationResult> {
        const startTime = Date.now();
        const session = this.sessions.get(sessionId);

        if (!session) {
            this.auditLogger.logAuthorizationFailure({
                sessionId,
                resource: resourceUri,
                reason: 'session_not_found'
            });
            return { authorized: false, reason: 'Session not found' };
        }

        // Update activity
        session.lastActivity = Date.now();

        // Local sessions have full access
        if (session.did === 'local') {
            this.auditLogger.logResourceRead({
                sessionId,
                resource: resourceUri,
                result: 'allowed',
                duration: Date.now() - startTime
            });
            return { authorized: true };
        }

        // Find matching permission for resource
        const requiredPermission = this.getResourcePermission(resourceUri);
        if (!requiredPermission) {
            // No specific permission required
            this.auditLogger.logResourceRead({
                sessionId,
                resource: resourceUri,
                result: 'allowed',
                duration: Date.now() - startTime
            });
            return { authorized: true };
        }

        // Check session scope
        if (session.scope.includes('*') || session.scope.includes(requiredPermission)) {
            this.auditLogger.logResourceRead({
                sessionId,
                resource: resourceUri,
                result: 'allowed',
                duration: Date.now() - startTime
            });
            return { authorized: true };
        }

        // Check access grant if provided
        if (accessGrant) {
            const grantResult = await this.verifyAccessGrant(accessGrant, requiredPermission);
            if (grantResult.authorized) {
                this.auditLogger.logResourceRead({
                    sessionId,
                    resource: resourceUri,
                    result: 'allowed',
                    duration: Date.now() - startTime
                });
                return { authorized: true };
            }
        }

        // Denied
        this.auditLogger.logResourceRead({
            sessionId,
            resource: resourceUri,
            result: 'denied',
            reason: `Missing permission: ${requiredPermission}`,
            duration: Date.now() - startTime
        });

        return {
            authorized: false,
            reason: `Permission denied: ${requiredPermission} required`
        };
    }

    /**
     * Get required permission for a resource URI.
     */
    private getResourcePermission(uri: string): Permission | null {
        // Exact match
        if (RESOURCE_PERMISSIONS[uri]) {
            return RESOURCE_PERMISSIONS[uri];
        }

        // Pattern match (e.g., profile://conversation/*)
        for (const [pattern, permission] of Object.entries(RESOURCE_PERMISSIONS)) {
            if (uri.startsWith(pattern.replace('*', ''))) {
                return permission;
            }
        }

        return null;
    }

    /**
     * Verify an AccessGrant token.
     */
    private async verifyAccessGrant(
        grant: AccessGrant,
        requiredPermission: Permission
    ): Promise<AuthorizationResult> {
        // Check if grant is revoked
        if (this.revokedGrants.has(grant.id)) {
            return { authorized: false, reason: 'Grant has been revoked' };
        }

        // Check expiry
        if (grant.expiresAt < Date.now()) {
            return { authorized: false, reason: 'Grant has expired' };
        }

        // Map legacy permissions to new system and check
        const grantedPermissions: Permission[] = [];
        for (const legacyPerm of grant.permissions) {
            grantedPermissions.push(...mapLegacyPermission(legacyPerm));
        }

        if (!grantedPermissions.includes(requiredPermission)) {
            return { authorized: false, reason: 'Grant does not include required permission' };
        }

        // Verify signature (would need public key from DID resolution in production)
        // For now, we trust the grant if it passes other checks
        // TODO: Implement full signature verification with DID resolution

        return { authorized: true };
    }

    /**
     * Revoke an access grant.
     * Graceful expiry: existing sessions continue, new requests are blocked.
     */
    revokeGrant(grantId: string): void {
        this.revokedGrants.add(grantId);

        // Count sessions that might be using this grant
        const affectedSessions = Array.from(this.sessions.values()).filter(
            s => s.did !== 'local'
        ).length;

        this.auditLogger.logGrantRevoked({
            grantId,
            metadata: { affectedSessions }
        });

        log(`Grant ${grantId} revoked. ${affectedSessions} active sessions may be affected.`);
    }

    /**
     * Check if a grant is revoked.
     */
    isGrantRevoked(grantId: string): boolean {
        return this.revokedGrants.has(grantId);
    }

    /**
     * Get active session count.
     */
    getActiveSessionCount(): number {
        return this.sessions.size;
    }

    /**
     * Get all active sessions (for admin view).
     */
    getActiveSessions(): AuthenticatedSession[] {
        return Array.from(this.sessions.values());
    }

    /**
     * Clean up expired sessions.
     */
    cleanupExpiredSessions(maxAge: number = 3600000): number {
        const now = Date.now();
        let cleaned = 0;

        for (const [sessionId, session] of this.sessions) {
            if (now - session.lastActivity > maxAge) {
                this.auditLogger.log({
                    type: 'session_expired',
                    sessionId,
                    did: session.did,
                    client: session.client,
                    duration: now - session.connectedAt
                });
                this.sessions.delete(sessionId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            log(`Cleaned up ${cleaned} expired sessions`);
        }

        return cleaned;
    }

    /**
     * Get the audit logger instance.
     */
    getAuditLogger(): AuditLogger {
        return this.auditLogger;
    }
}

// ============================================================
// Factory Function
// ============================================================

let authMiddlewareInstance: McpAuthMiddleware | null = null;

export function createAuthMiddleware(options: {
    transport: 'stdio' | 'sse';
    jwtPublicKey?: Uint8Array | string;
    auditLogger?: AuditLogger;
}): McpAuthMiddleware {
    authMiddlewareInstance = new McpAuthMiddleware(options);
    return authMiddlewareInstance;
}

export function getAuthMiddleware(): McpAuthMiddleware | null {
    return authMiddlewareInstance;
}

export function resetAuthMiddleware(): void {
    authMiddlewareInstance = null;
}
