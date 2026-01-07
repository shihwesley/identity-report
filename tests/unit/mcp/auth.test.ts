/**
 * Unit Tests for MCP Authentication Middleware
 *
 * Tests cover:
 * - JWT token validation
 * - Session management
 * - STDIO vs SSE transport authentication
 * - Tool and resource authorization
 * - Scope-based permission checking
 * - Access grant verification
 * - Grant revocation
 * - Session cleanup
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    McpAuthMiddleware,
    createAuthMiddleware,
    getAuthMiddleware,
    resetAuthMiddleware,
    AuthenticatedSession,
    Permission
} from '@/lib/mcp/auth';
import { AuditLogger } from '@/lib/mcp/audit';
import { createJwt, deriveJwtSigningKey } from '@/lib/vault/identity';
import { TEST_TOKENS } from '../../fixtures/test-vectors';

// Mock the config logging
vi.mock('@/lib/mcp/config', () => ({
    log: vi.fn(),
    logError: vi.fn()
}));

describe('McpAuthMiddleware', () => {
    let middleware: McpAuthMiddleware;
    let auditLogger: AuditLogger;
    let jwtKeyPair: { privateKey: Uint8Array; publicKey: Uint8Array; publicKeyHex: string };

    // Test mnemonic for JWT key derivation
    const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

    beforeEach(async () => {
        // Initialize fresh instances
        auditLogger = new AuditLogger({ maxLogs: 100 });

        // Derive JWT signing keys from test mnemonic
        jwtKeyPair = await deriveJwtSigningKey(testMnemonic);

        resetAuthMiddleware();
    });

    afterEach(() => {
        vi.clearAllMocks();
        resetAuthMiddleware();
    });

    describe('STDIO Transport Authentication', () => {
        beforeEach(() => {
            middleware = new McpAuthMiddleware({
                transport: 'stdio',
                auditLogger
            });
        });

        it('should automatically authenticate STDIO requests', async () => {
            const result = await middleware.authenticate({});

            expect(result.authenticated).toBe(true);
            expect(result.session).toBeDefined();
            expect(result.session?.did).toBe('local');
            expect(result.session?.client).toBe('local-stdio');
            expect(result.session?.scope).toContain('*');
        });

        it('should create unique session IDs for STDIO', async () => {
            const result1 = await middleware.authenticate({});
            const result2 = await middleware.authenticate({});

            expect(result1.session?.sessionId).not.toBe(result2.session?.sessionId);
            expect(result1.session?.sessionId).toMatch(/^local-/);
        });

        it('should store STDIO session in session map', async () => {
            const result = await middleware.authenticate({});
            const sessionId = result.session?.sessionId!;

            const retrieved = middleware.getSession(sessionId);
            expect(retrieved).toBeDefined();
            expect(retrieved?.did).toBe('local');
        });
    });

    describe('SSE Transport Authentication', () => {
        beforeEach(() => {
            middleware = new McpAuthMiddleware({
                transport: 'sse',
                jwtPublicKey: jwtKeyPair.publicKey,
                auditLogger
            });
        });

        it('should require authorization header for SSE', async () => {
            const result = await middleware.authenticate({});

            expect(result.authenticated).toBe(false);
            expect(result.error).toBe('Missing authorization header');
        });

        it('should reject missing token', async () => {
            const result = await middleware.authenticate({
                headers: { authorization: 'Bearer ' }
            });

            expect(result.authenticated).toBe(false);
            expect(result.error).toBe('Missing token');
        });

        it('should reject when JWT key not configured', async () => {
            // Create middleware without public key
            const noKeyMiddleware = new McpAuthMiddleware({
                transport: 'sse',
                auditLogger
            });

            const result = await noKeyMiddleware.authenticate({
                headers: { authorization: 'Bearer some-token' }
            });

            expect(result.authenticated).toBe(false);
            expect(result.error).toBe('Authentication not configured');
        });

        it('should authenticate valid JWT token', async () => {
            // Create a valid JWT
            const token = await createJwt({
                sub: 'did:key:zTest123',
                exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
                client: 'test-client',
                scope: ['read:identity', 'read:memories']
            }, jwtKeyPair.privateKey);

            const result = await middleware.authenticate({
                headers: { authorization: `Bearer ${token}` },
                ip: '127.0.0.1'
            });

            expect(result.authenticated).toBe(true);
            expect(result.session?.did).toBe('did:key:zTest123');
            expect(result.session?.client).toBe('test-client');
            expect(result.session?.scope).toContain('read:identity');
            expect(result.session?.ip).toBe('127.0.0.1');
        });

        it('should reject expired JWT token', async () => {
            // Create an expired JWT
            const token = await createJwt({
                sub: 'did:key:zTest123',
                exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
                client: 'test-client',
                scope: ['read:identity']
            }, jwtKeyPair.privateKey);

            const result = await middleware.authenticate({
                headers: { authorization: `Bearer ${token}` }
            });

            expect(result.authenticated).toBe(false);
            expect(result.error).toBe('JWT has expired');
        });

        it('should reject invalid JWT signature', async () => {
            // Create JWT with wrong key
            const wrongKey = await deriveJwtSigningKey(
                'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong'
            );

            const token = await createJwt({
                sub: 'did:key:zTest123',
                exp: Math.floor(Date.now() / 1000) + 3600,
                client: 'test-client',
                scope: ['read:identity']
            }, wrongKey.privateKey);

            const result = await middleware.authenticate({
                headers: { authorization: `Bearer ${token}` }
            });

            expect(result.authenticated).toBe(false);
            expect(result.error).toBe('Invalid JWT signature');
        });

        it('should handle case-insensitive Authorization header', async () => {
            const token = await createJwt({
                sub: 'did:key:zTest123',
                exp: Math.floor(Date.now() / 1000) + 3600,
                client: 'test-client',
                scope: ['read:identity']
            }, jwtKeyPair.privateKey);

            // Use lowercase header name
            const result = await middleware.authenticate({
                headers: { Authorization: `Bearer ${token}` }
            });

            expect(result.authenticated).toBe(true);
        });

        it('should set JWT public key after initialization', async () => {
            const noKeyMiddleware = new McpAuthMiddleware({
                transport: 'sse',
                auditLogger
            });

            // Initially should fail
            let result = await noKeyMiddleware.authenticate({
                headers: { authorization: 'Bearer test' }
            });
            expect(result.authenticated).toBe(false);
            expect(result.error).toBe('Authentication not configured');

            // Set public key
            noKeyMiddleware.setJwtPublicKey(jwtKeyPair.publicKey);

            // Now create valid token and try again
            const token = await createJwt({
                sub: 'did:key:zTest',
                exp: Math.floor(Date.now() / 1000) + 3600,
                client: 'test',
                scope: []
            }, jwtKeyPair.privateKey);

            result = await noKeyMiddleware.authenticate({
                headers: { authorization: `Bearer ${token}` }
            });
            expect(result.authenticated).toBe(true);
        });
    });

    describe('Session Management', () => {
        beforeEach(() => {
            middleware = new McpAuthMiddleware({
                transport: 'stdio',
                auditLogger
            });
        });

        it('should get session by ID', async () => {
            const auth = await middleware.authenticate({});
            const sessionId = auth.session?.sessionId!;

            const session = middleware.getSession(sessionId);
            expect(session).toBeDefined();
            expect(session?.sessionId).toBe(sessionId);
        });

        it('should update last activity on session retrieval', async () => {
            const auth = await middleware.authenticate({});
            const sessionId = auth.session?.sessionId!;

            const initialActivity = middleware.getSession(sessionId)?.lastActivity;

            // Wait a bit
            await new Promise(r => setTimeout(r, 10));

            const laterActivity = middleware.getSession(sessionId)?.lastActivity;
            expect(laterActivity).toBeGreaterThanOrEqual(initialActivity!);
        });

        it('should return null for unknown session', () => {
            const session = middleware.getSession('unknown-session-id');
            expect(session).toBeNull();
        });

        it('should remove session', async () => {
            const auth = await middleware.authenticate({});
            const sessionId = auth.session?.sessionId!;

            middleware.removeSession(sessionId);

            const session = middleware.getSession(sessionId);
            expect(session).toBeNull();
        });

        it('should track active session count', async () => {
            expect(middleware.getActiveSessionCount()).toBe(0);

            await middleware.authenticate({});
            expect(middleware.getActiveSessionCount()).toBe(1);

            await middleware.authenticate({});
            expect(middleware.getActiveSessionCount()).toBe(2);
        });

        it('should list all active sessions', async () => {
            await middleware.authenticate({});
            await middleware.authenticate({});

            const sessions = middleware.getActiveSessions();
            expect(sessions).toHaveLength(2);
            expect(sessions.every(s => s.did === 'local')).toBe(true);
        });

        it('should cleanup expired sessions', async () => {
            const auth = await middleware.authenticate({});
            const sessionId = auth.session?.sessionId!;

            // Manually set old activity time
            const session = middleware.getSession(sessionId)!;
            session.lastActivity = Date.now() - 7200000; // 2 hours ago

            // Cleanup with 1 hour max age
            const cleaned = middleware.cleanupExpiredSessions(3600000);

            expect(cleaned).toBe(1);
            expect(middleware.getSession(sessionId)).toBeNull();
        });

        it('should not cleanup active sessions', async () => {
            await middleware.authenticate({});
            await middleware.authenticate({});

            const cleaned = middleware.cleanupExpiredSessions(3600000);

            expect(cleaned).toBe(0);
            expect(middleware.getActiveSessionCount()).toBe(2);
        });
    });

    describe('Tool Authorization', () => {
        let sessionId: string;

        describe('Local Session (Full Access)', () => {
            beforeEach(async () => {
                middleware = new McpAuthMiddleware({
                    transport: 'stdio',
                    auditLogger
                });

                const auth = await middleware.authenticate({});
                sessionId = auth.session?.sessionId!;
            });

            it('should allow any tool for local session', async () => {
                const result = await middleware.authorizeToolCall(sessionId, 'search_memory');
                expect(result.authorized).toBe(true);

                const adminResult = await middleware.authorizeToolCall(sessionId, 'grant_access');
                expect(adminResult.authorized).toBe(true);
            });

            it('should allow unknown tools for local session', async () => {
                const result = await middleware.authorizeToolCall(sessionId, 'unknown_tool');
                expect(result.authorized).toBe(true);
            });
        });

        describe('Remote Session (Scoped Access)', () => {
            beforeEach(async () => {
                middleware = new McpAuthMiddleware({
                    transport: 'sse',
                    jwtPublicKey: jwtKeyPair.publicKey,
                    auditLogger
                });

                const token = await createJwt({
                    sub: 'did:key:zRemote',
                    exp: Math.floor(Date.now() / 1000) + 3600,
                    client: 'remote-client',
                    scope: ['read:memories', 'write:memories']
                }, jwtKeyPair.privateKey);

                const auth = await middleware.authenticate({
                    headers: { authorization: `Bearer ${token}` }
                });
                sessionId = auth.session?.sessionId!;
            });

            it('should allow tools within scope', async () => {
                const result = await middleware.authorizeToolCall(sessionId, 'search_memory');
                expect(result.authorized).toBe(true);
            });

            it('should allow write tools when write scope present', async () => {
                const result = await middleware.authorizeToolCall(sessionId, 'add_memory');
                expect(result.authorized).toBe(true);
            });

            it('should deny tools outside scope', async () => {
                const result = await middleware.authorizeToolCall(sessionId, 'grant_access');
                expect(result.authorized).toBe(false);
                expect(result.reason).toContain('admin:grants');
            });

            it('should allow public tools (not in permission map)', async () => {
                const result = await middleware.authorizeToolCall(sessionId, 'get_version');
                expect(result.authorized).toBe(true);
            });

            it('should deny for unknown session', async () => {
                const result = await middleware.authorizeToolCall('unknown', 'search_memory');
                expect(result.authorized).toBe(false);
                expect(result.reason).toBe('Session not found');
            });
        });

        describe('Wildcard Scope', () => {
            beforeEach(async () => {
                middleware = new McpAuthMiddleware({
                    transport: 'sse',
                    jwtPublicKey: jwtKeyPair.publicKey,
                    auditLogger
                });

                const token = await createJwt({
                    sub: 'did:key:zAdmin',
                    exp: Math.floor(Date.now() / 1000) + 3600,
                    client: 'admin-client',
                    scope: ['*']
                }, jwtKeyPair.privateKey);

                const auth = await middleware.authenticate({
                    headers: { authorization: `Bearer ${token}` }
                });
                sessionId = auth.session?.sessionId!;
            });

            it('should allow all tools with wildcard scope', async () => {
                const readResult = await middleware.authorizeToolCall(sessionId, 'search_memory');
                expect(readResult.authorized).toBe(true);

                const writeResult = await middleware.authorizeToolCall(sessionId, 'add_memory');
                expect(writeResult.authorized).toBe(true);

                const adminResult = await middleware.authorizeToolCall(sessionId, 'grant_access');
                expect(adminResult.authorized).toBe(true);
            });
        });
    });

    describe('Resource Authorization', () => {
        let sessionId: string;

        beforeEach(async () => {
            middleware = new McpAuthMiddleware({
                transport: 'sse',
                jwtPublicKey: jwtKeyPair.publicKey,
                auditLogger
            });

            const token = await createJwt({
                sub: 'did:key:zUser',
                exp: Math.floor(Date.now() / 1000) + 3600,
                client: 'user-client',
                scope: ['read:identity', 'read:memories']
            }, jwtKeyPair.privateKey);

            const auth = await middleware.authenticate({
                headers: { authorization: `Bearer ${token}` }
            });
            sessionId = auth.session?.sessionId!;
        });

        it('should allow resource read within scope', async () => {
            const result = await middleware.authorizeResourceRead(sessionId, 'profile://identity');
            expect(result.authorized).toBe(true);
        });

        it('should allow memory resources when read:memories in scope', async () => {
            const result = await middleware.authorizeResourceRead(sessionId, 'profile://memory/recent');
            expect(result.authorized).toBe(true);
        });

        it('should deny resources outside scope', async () => {
            const result = await middleware.authorizeResourceRead(sessionId, 'profile://stats');
            expect(result.authorized).toBe(false);
            expect(result.reason).toContain('read:stats');
        });

        it('should allow resources without specific permission requirement', async () => {
            const result = await middleware.authorizeResourceRead(sessionId, 'profile://public');
            expect(result.authorized).toBe(true);
        });

        it('should deny for unknown session', async () => {
            const result = await middleware.authorizeResourceRead('unknown', 'profile://identity');
            expect(result.authorized).toBe(false);
        });
    });

    describe('Access Grant Verification', () => {
        let sessionId: string;

        beforeEach(async () => {
            middleware = new McpAuthMiddleware({
                transport: 'sse',
                jwtPublicKey: jwtKeyPair.publicKey,
                auditLogger
            });

            // Create session with limited scope
            const token = await createJwt({
                sub: 'did:key:zLimited',
                exp: Math.floor(Date.now() / 1000) + 3600,
                client: 'limited-client',
                scope: [] // No direct permissions
            }, jwtKeyPair.privateKey);

            const auth = await middleware.authenticate({
                headers: { authorization: `Bearer ${token}` }
            });
            sessionId = auth.session?.sessionId!;
        });

        it('should allow tool when access grant provides permission', async () => {
            const grant = {
                id: 'grant-1',
                grantee: 'some-client',
                permissions: ['read_memory'],
                expiresAt: Date.now() + 3600000,
                signature: 'fake-signature'
            };

            const result = await middleware.authorizeToolCall(sessionId, 'search_memory', {}, grant);
            expect(result.authorized).toBe(true);
        });

        it('should deny when grant has wrong permission', async () => {
            const grant = {
                id: 'grant-1',
                grantee: 'some-client',
                permissions: ['read_identity'], // Not read_memory
                expiresAt: Date.now() + 3600000,
                signature: 'fake-signature'
            };

            const result = await middleware.authorizeToolCall(sessionId, 'search_memory', {}, grant);
            expect(result.authorized).toBe(false);
        });

        it('should deny when grant is expired', async () => {
            const grant = {
                id: 'grant-1',
                grantee: 'some-client',
                permissions: ['read_memory'],
                expiresAt: Date.now() - 1000, // Expired
                signature: 'fake-signature'
            };

            const result = await middleware.authorizeToolCall(sessionId, 'search_memory', {}, grant);
            expect(result.authorized).toBe(false);
        });

        it('should deny when grant is revoked', async () => {
            const grant = {
                id: 'grant-revoked',
                grantee: 'some-client',
                permissions: ['read_memory'],
                expiresAt: Date.now() + 3600000,
                signature: 'fake-signature'
            };

            middleware.revokeGrant('grant-revoked');

            const result = await middleware.authorizeToolCall(sessionId, 'search_memory', {}, grant);
            expect(result.authorized).toBe(false);
        });
    });

    describe('Grant Revocation', () => {
        beforeEach(() => {
            middleware = new McpAuthMiddleware({
                transport: 'stdio',
                auditLogger
            });
        });

        it('should revoke grant', () => {
            middleware.revokeGrant('grant-to-revoke');

            expect(middleware.isGrantRevoked('grant-to-revoke')).toBe(true);
        });

        it('should return false for non-revoked grants', () => {
            expect(middleware.isGrantRevoked('not-revoked')).toBe(false);
        });

        it('should log grant revocation', () => {
            middleware.revokeGrant('grant-123');

            const logs = auditLogger.getLogsByType('grant_revoked');
            expect(logs).toHaveLength(1);
            expect(logs[0].grantId).toBe('grant-123');
        });
    });

    describe('Permission Mapping', () => {
        let sessionId: string;

        beforeEach(async () => {
            middleware = new McpAuthMiddleware({
                transport: 'sse',
                jwtPublicKey: jwtKeyPair.publicKey,
                auditLogger
            });
        });

        const testCases: Array<{ tool: string; permission: Permission }> = [
            { tool: 'search_memory', permission: 'read:memories' },
            { tool: 'get_context_for_task', permission: 'read:memories' },
            { tool: 'get_conversation_history', permission: 'read:conversations' },
            { tool: 'add_memory', permission: 'write:memories' },
            { tool: 'archive_conversation', permission: 'write:conversations' },
            { tool: 'grant_access', permission: 'admin:grants' },
            { tool: 'sync_vault', permission: 'admin:sync' },
            { tool: 'toggle_auto_archive', permission: 'admin:settings' }
        ];

        for (const { tool, permission } of testCases) {
            it(`should require ${permission} for ${tool}`, async () => {
                // Create token without required permission
                const token = await createJwt({
                    sub: 'did:key:zTest',
                    exp: Math.floor(Date.now() / 1000) + 3600,
                    client: 'test',
                    scope: []
                }, jwtKeyPair.privateKey);

                const auth = await middleware.authenticate({
                    headers: { authorization: `Bearer ${token}` }
                });

                const result = await middleware.authorizeToolCall(auth.session?.sessionId!, tool);
                expect(result.authorized).toBe(false);
                expect(result.reason).toContain(permission);
            });
        }
    });

    describe('Audit Logging', () => {
        beforeEach(async () => {
            middleware = new McpAuthMiddleware({
                transport: 'sse',
                jwtPublicKey: jwtKeyPair.publicKey,
                auditLogger
            });
        });

        it('should log authentication success', async () => {
            const token = await createJwt({
                sub: 'did:key:zTest',
                exp: Math.floor(Date.now() / 1000) + 3600,
                client: 'test',
                scope: []
            }, jwtKeyPair.privateKey);

            await middleware.authenticate({
                headers: { authorization: `Bearer ${token}` }
            });

            const logs = auditLogger.getLogsByType('auth_success');
            expect(logs.length).toBeGreaterThan(0);
        });

        it('should log authentication failure', async () => {
            await middleware.authenticate({});

            const logs = auditLogger.getLogsByType('auth_failure');
            expect(logs.length).toBeGreaterThan(0);
            expect(logs[0].reason).toBe('missing_authorization_header');
        });

        it('should log tool calls with duration', async () => {
            const token = await createJwt({
                sub: 'did:key:zTest',
                exp: Math.floor(Date.now() / 1000) + 3600,
                client: 'test',
                scope: ['read:memories']
            }, jwtKeyPair.privateKey);

            const auth = await middleware.authenticate({
                headers: { authorization: `Bearer ${token}` }
            });

            await middleware.authorizeToolCall(auth.session?.sessionId!, 'search_memory');

            const logs = auditLogger.getLogsByType('tool_call');
            expect(logs.length).toBeGreaterThan(0);
            expect(logs[0].duration).toBeDefined();
            expect(logs[0].tool).toBe('search_memory');
        });

        it('should log authorization failures', async () => {
            await middleware.authorizeToolCall('unknown-session', 'search_memory');

            const logs = auditLogger.getLogsByType('authorization_failure');
            expect(logs.length).toBeGreaterThan(0);
        });

        it('should return audit logger instance', () => {
            const logger = middleware.getAuditLogger();
            expect(logger).toBe(auditLogger);
        });
    });

    describe('Factory Functions', () => {
        it('should create middleware with factory', () => {
            const middleware = createAuthMiddleware({
                transport: 'stdio'
            });

            expect(middleware).toBeInstanceOf(McpAuthMiddleware);
        });

        it('should return same instance from getter after creation', () => {
            const created = createAuthMiddleware({
                transport: 'stdio'
            });

            const retrieved = getAuthMiddleware();
            expect(retrieved).toBe(created);
        });

        it('should return null before creation', () => {
            resetAuthMiddleware();
            expect(getAuthMiddleware()).toBeNull();
        });

        it('should reset instance', () => {
            createAuthMiddleware({ transport: 'stdio' });
            resetAuthMiddleware();

            expect(getAuthMiddleware()).toBeNull();
        });
    });
});
