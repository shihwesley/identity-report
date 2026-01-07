/**
 * Unit Tests for MCP Audit Logging System
 *
 * Tests cover:
 * - Basic logging functionality
 * - Event type specific logging methods
 * - Sensitive data scrubbing
 * - Log rotation
 * - Query methods (by session, type, time range, client)
 * - Statistics generation
 * - Import/export for sync
 * - Sync callback triggering
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    AuditLogger,
    AuditEntry,
    AuditEventType,
    getAuditLogger,
    resetAuditLogger
} from '@/lib/mcp/audit';

// Mock the config logging
vi.mock('@/lib/mcp/config', () => ({
    log: vi.fn()
}));

describe('AuditLogger', () => {
    let logger: AuditLogger;

    beforeEach(() => {
        resetAuditLogger();
        logger = new AuditLogger({ maxLogs: 100 });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic Logging', () => {
        it('should log an entry with auto-generated ID and timestamp', () => {
            const entry = logger.log({
                type: 'auth_success',
                sessionId: 'session-123',
                did: 'did:key:zTest'
            });

            expect(entry.id).toBeDefined();
            expect(entry.timestamp).toBeDefined();
            expect(entry.timestamp).toBeCloseTo(Date.now(), -2);
            expect(entry.type).toBe('auth_success');
            expect(entry.sessionId).toBe('session-123');
        });

        it('should store logs in memory', () => {
            logger.log({ type: 'auth_success' });
            logger.log({ type: 'auth_failure' });

            const logs = logger.getLogsForSync();
            expect(logs).toHaveLength(2);
        });

        it('should return a copy from getLogsForSync', () => {
            logger.log({ type: 'auth_success' });

            const logs1 = logger.getLogsForSync();
            const logs2 = logger.getLogsForSync();

            expect(logs1).not.toBe(logs2);
            expect(logs1).toEqual(logs2);
        });
    });

    describe('Event Type Specific Methods', () => {
        it('should log auth success', () => {
            const entry = logger.logAuthSuccess({
                sessionId: 'session-1',
                did: 'did:key:zUser',
                client: 'test-client',
                ip: '192.168.1.1'
            });

            expect(entry.type).toBe('auth_success');
            expect(entry.sessionId).toBe('session-1');
            expect(entry.did).toBe('did:key:zUser');
            expect(entry.client).toBe('test-client');
            expect(entry.ip).toBe('192.168.1.1');
        });

        it('should log auth failure', () => {
            const entry = logger.logAuthFailure({
                reason: 'invalid_token',
                ip: '10.0.0.1'
            });

            expect(entry.type).toBe('auth_failure');
            expect(entry.result).toBe('denied');
            expect(entry.reason).toBe('invalid_token');
            expect(entry.ip).toBe('10.0.0.1');
        });

        it('should log tool call with result', () => {
            const entry = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'search_memory',
                params: { query: 'test' },
                result: 'allowed',
                duration: 150
            });

            expect(entry.type).toBe('tool_call');
            expect(entry.tool).toBe('search_memory');
            expect(entry.result).toBe('allowed');
            expect(entry.duration).toBe(150);
        });

        it('should log tool call denial', () => {
            const entry = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'admin_tool',
                result: 'denied',
                reason: 'insufficient permissions'
            });

            expect(entry.type).toBe('tool_call');
            expect(entry.result).toBe('denied');
            expect(entry.reason).toBe('insufficient permissions');
        });

        it('should log resource read', () => {
            const entry = logger.logResourceRead({
                sessionId: 'session-1',
                resource: 'profile://identity',
                result: 'allowed',
                duration: 50
            });

            expect(entry.type).toBe('resource_read');
            expect(entry.resource).toBe('profile://identity');
            expect(entry.result).toBe('allowed');
        });

        it('should log authorization failure', () => {
            const entry = logger.logAuthorizationFailure({
                sessionId: 'session-1',
                tool: 'admin_tool',
                reason: 'missing_scope'
            });

            expect(entry.type).toBe('authorization_failure');
            expect(entry.result).toBe('denied');
        });

        it('should log grant revocation', () => {
            const entry = logger.logGrantRevoked({
                grantId: 'grant-123',
                metadata: { affectedSessions: 5 }
            });

            expect(entry.type).toBe('grant_revoked');
            expect(entry.grantId).toBe('grant-123');
            expect(entry.metadata).toEqual({ affectedSessions: 5 });
        });

        it('should log grant creation', () => {
            const entry = logger.logGrantCreated({
                grantId: 'grant-456',
                sessionId: 'session-1',
                did: 'did:key:zGrantee'
            });

            expect(entry.type).toBe('grant_created');
            expect(entry.grantId).toBe('grant-456');
        });

        it('should log connection opened', () => {
            const entry = logger.logConnectionOpened({
                sessionId: 'session-1',
                ip: '127.0.0.1',
                client: 'claude-desktop'
            });

            expect(entry.type).toBe('connection_opened');
        });

        it('should log connection closed', () => {
            const entry = logger.logConnectionClosed({
                sessionId: 'session-1',
                duration: 3600000
            });

            expect(entry.type).toBe('connection_closed');
            expect(entry.duration).toBe(3600000);
        });
    });

    describe('Sensitive Data Scrubbing', () => {
        it('should redact password field', () => {
            const entry = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'test_tool',
                params: { username: 'alice', password: 'secret123' },
                result: 'allowed'
            });

            expect(entry.params?.username).toBe('alice');
            expect(entry.params?.password).toBe('[REDACTED]');
        });

        it('should redact mnemonic field', () => {
            const entry = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'test_tool',
                params: { mnemonic: 'word1 word2 word3' },
                result: 'allowed'
            });

            expect(entry.params?.mnemonic).toBe('[REDACTED]');
        });

        it('should redact privateKey field', () => {
            const entry = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'test_tool',
                params: { privateKey: '0xdeadbeef' },
                result: 'allowed'
            });

            expect(entry.params?.privateKey).toBe('[REDACTED]');
        });

        it('should redact secret field', () => {
            const entry = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'test_tool',
                params: { secret: 'my-secret-value' },
                result: 'allowed'
            });

            expect(entry.params?.secret).toBe('[REDACTED]');
        });

        it('should redact token field', () => {
            const entry = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'test_tool',
                params: { token: 'jwt-token-here' },
                result: 'allowed'
            });

            expect(entry.params?.token).toBe('[REDACTED]');
        });

        it('should redact apiKey and api_key fields', () => {
            const entry = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'test_tool',
                params: { apiKey: 'key1', api_key: 'key2' },
                result: 'allowed'
            });

            expect(entry.params?.apiKey).toBe('[REDACTED]');
            expect(entry.params?.api_key).toBe('[REDACTED]');
        });

        it('should redact authorization field', () => {
            const entry = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'test_tool',
                params: { authorization: 'Bearer xyz' },
                result: 'allowed'
            });

            expect(entry.params?.authorization).toBe('[REDACTED]');
        });

        it('should redact credential field', () => {
            const entry = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'test_tool',
                params: { credential: 'cred-data' },
                result: 'allowed'
            });

            expect(entry.params?.credential).toBe('[REDACTED]');
        });

        it('should redact seed field', () => {
            const entry = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'test_tool',
                params: { seed: 'random-seed-bytes' },
                result: 'allowed'
            });

            expect(entry.params?.seed).toBe('[REDACTED]');
        });

        it('should redact nested sensitive fields', () => {
            const entry = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'test_tool',
                params: {
                    config: {
                        apiKey: 'nested-key',
                        name: 'test'
                    }
                },
                result: 'allowed'
            });

            expect((entry.params?.config as Record<string, unknown>).apiKey).toBe('[REDACTED]');
            expect((entry.params?.config as Record<string, unknown>).name).toBe('test');
        });

        it('should redact fields in arrays', () => {
            const entry = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'test_tool',
                params: {
                    items: [
                        { name: 'item1', password: 'pass1' },
                        { name: 'item2', password: 'pass2' }
                    ]
                },
                result: 'allowed'
            });

            const items = entry.params?.items as Array<Record<string, unknown>>;
            expect(items[0].name).toBe('item1');
            expect(items[0].password).toBe('[REDACTED]');
            expect(items[1].password).toBe('[REDACTED]');
        });

        it('should handle null and undefined params', () => {
            const entry1 = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'test_tool',
                params: undefined,
                result: 'allowed'
            });

            expect(entry1.params).toBeUndefined();

            const entry2 = logger.log({
                type: 'tool_call',
                params: null as unknown as Record<string, unknown>
            });

            // null params become undefined after processing
            expect(entry2.params).toBeUndefined();
        });

        it('should handle case-insensitive sensitive keys', () => {
            const entry = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'test_tool',
                params: {
                    PASSWORD: 'upper',
                    Password: 'mixed',
                    APIKEY: 'upper-key'
                },
                result: 'allowed'
            });

            // Our implementation is case-insensitive via toLowerCase
            expect(entry.params?.PASSWORD).toBe('[REDACTED]');
            expect(entry.params?.Password).toBe('[REDACTED]');
        });

        it('should preserve non-sensitive data types', () => {
            const entry = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'test_tool',
                params: {
                    count: 42,
                    enabled: true,
                    rate: 3.14,
                    name: 'test'
                },
                result: 'allowed'
            });

            expect(entry.params?.count).toBe(42);
            expect(entry.params?.enabled).toBe(true);
            expect(entry.params?.rate).toBe(3.14);
            expect(entry.params?.name).toBe('test');
        });
    });

    describe('Log Rotation', () => {
        it('should rotate logs when exceeding maxLogs', () => {
            const smallLogger = new AuditLogger({ maxLogs: 5 });

            for (let i = 0; i < 10; i++) {
                smallLogger.log({ type: 'auth_success', sessionId: `session-${i}` });
            }

            const logs = smallLogger.getLogsForSync();
            expect(logs).toHaveLength(5);

            // Should keep the most recent logs
            expect(logs[0].sessionId).toBe('session-5');
            expect(logs[4].sessionId).toBe('session-9');
        });

        it('should use default maxLogs of 10000', () => {
            const defaultLogger = new AuditLogger();
            // Just verify it can be created without error
            expect(defaultLogger).toBeDefined();
        });
    });

    describe('Query Methods', () => {
        beforeEach(() => {
            // Create test data
            logger.logAuthSuccess({ sessionId: 'session-1', did: 'did:1', client: 'client-a' });
            logger.logAuthSuccess({ sessionId: 'session-2', did: 'did:2', client: 'client-b' });
            logger.logAuthFailure({ reason: 'expired', client: 'client-a' });
            logger.logToolCall({ sessionId: 'session-1', tool: 'tool1', result: 'allowed' });
            logger.logToolCall({ sessionId: 'session-2', tool: 'tool2', result: 'denied' });
        });

        describe('getLogsBySession', () => {
            it('should filter logs by session ID', () => {
                const logs = logger.getLogsBySession('session-1');

                expect(logs.length).toBeGreaterThan(0);
                expect(logs.every(l => l.sessionId === 'session-1')).toBe(true);
            });

            it('should return empty array for unknown session', () => {
                const logs = logger.getLogsBySession('unknown');
                expect(logs).toHaveLength(0);
            });
        });

        describe('getLogsByType', () => {
            it('should filter logs by type', () => {
                const logs = logger.getLogsByType('auth_success');

                expect(logs).toHaveLength(2);
                expect(logs.every(l => l.type === 'auth_success')).toBe(true);
            });

            it('should return empty array for unused type', () => {
                const logs = logger.getLogsByType('grant_revoked');
                expect(logs).toHaveLength(0);
            });
        });

        describe('getLogsByTimeRange', () => {
            it('should filter logs by time range', async () => {
                const start = Date.now() - 1000;

                // Wait a bit then add more logs
                await new Promise(r => setTimeout(r, 10));
                const midTime = Date.now();
                logger.logAuthSuccess({ sessionId: 'session-new', did: 'did:new', client: 'new' });

                const logs = logger.getLogsByTimeRange(midTime - 5, Date.now() + 1000);
                expect(logs.length).toBeGreaterThan(0);
            });

            it('should return empty for non-overlapping range', () => {
                const futureStart = Date.now() + 100000;
                const futureEnd = Date.now() + 200000;

                const logs = logger.getLogsByTimeRange(futureStart, futureEnd);
                expect(logs).toHaveLength(0);
            });
        });

        describe('getRecentLogs', () => {
            it('should return last N logs', () => {
                const logs = logger.getRecentLogs(3);

                expect(logs).toHaveLength(3);
                // Last log should be the most recent tool_call
                expect(logs[2].type).toBe('tool_call');
            });

            it('should return all logs if count exceeds total', () => {
                const logs = logger.getRecentLogs(100);
                expect(logs).toHaveLength(5);
            });

            it('should use default count of 100', () => {
                const logs = logger.getRecentLogs();
                expect(logs).toHaveLength(5);
            });
        });

        describe('getLogsByClient', () => {
            it('should filter logs by client', () => {
                const logs = logger.getLogsByClient('client-a');

                expect(logs.length).toBeGreaterThan(0);
                expect(logs.every(l => l.client === 'client-a')).toBe(true);
            });

            it('should return empty array for unknown client', () => {
                const logs = logger.getLogsByClient('unknown-client');
                expect(logs).toHaveLength(0);
            });
        });
    });

    describe('Statistics', () => {
        beforeEach(() => {
            logger.logAuthSuccess({ sessionId: 'session-1', did: 'did:1', client: 'client-a' });
            logger.logAuthSuccess({ sessionId: 'session-2', did: 'did:2', client: 'client-a' });
            logger.logAuthFailure({ reason: 'expired', client: 'client-b' });
            logger.logToolCall({ sessionId: 'session-1', tool: 'tool1', result: 'allowed' });
        });

        it('should return total entry count', () => {
            const stats = logger.getStats();
            expect(stats.totalEntries).toBe(4);
        });

        it('should count entries by type', () => {
            const stats = logger.getStats();

            expect(stats.entriesByType['auth_success']).toBe(2);
            expect(stats.entriesByType['auth_failure']).toBe(1);
            expect(stats.entriesByType['tool_call']).toBe(1);
        });

        it('should count unique sessions', () => {
            const stats = logger.getStats();
            expect(stats.uniqueSessions).toBe(2);
        });

        it('should count unique clients', () => {
            const stats = logger.getStats();
            expect(stats.uniqueClients).toBe(2);
        });

        it('should track oldest and newest entry timestamps', () => {
            const stats = logger.getStats();

            expect(stats.oldestEntry).toBeDefined();
            expect(stats.newestEntry).toBeDefined();
            expect(stats.newestEntry).toBeGreaterThanOrEqual(stats.oldestEntry!);
        });

        it('should return null timestamps for empty logs', () => {
            const emptyLogger = new AuditLogger();
            const stats = emptyLogger.getStats();

            expect(stats.oldestEntry).toBeNull();
            expect(stats.newestEntry).toBeNull();
        });
    });

    describe('Import/Export', () => {
        describe('exportLogsSince', () => {
            it('should export logs after timestamp', async () => {
                logger.log({ type: 'auth_success', sessionId: 's1' });

                await new Promise(r => setTimeout(r, 10));
                const midTime = Date.now();

                await new Promise(r => setTimeout(r, 10));
                logger.log({ type: 'auth_failure', sessionId: 's2' });

                const exported = logger.exportLogsSince(midTime);
                expect(exported).toHaveLength(1);
                expect(exported[0].type).toBe('auth_failure');
            });

            it('should return empty array if no logs after timestamp', () => {
                logger.log({ type: 'auth_success' });

                const futureTimestamp = Date.now() + 100000;
                const exported = logger.exportLogsSince(futureTimestamp);

                expect(exported).toHaveLength(0);
            });
        });

        describe('importLogs', () => {
            it('should import new logs', () => {
                const newLogs: AuditEntry[] = [
                    {
                        id: 'imported-1',
                        timestamp: Date.now(),
                        type: 'auth_success'
                    },
                    {
                        id: 'imported-2',
                        timestamp: Date.now(),
                        type: 'auth_failure'
                    }
                ];

                const imported = logger.importLogs(newLogs);

                expect(imported).toBe(2);
                expect(logger.getLogsForSync()).toHaveLength(2);
            });

            it('should deduplicate by ID', () => {
                const entry = logger.log({ type: 'auth_success' });

                const duplicateLogs: AuditEntry[] = [
                    entry, // Same ID
                    {
                        id: 'new-1',
                        timestamp: Date.now(),
                        type: 'auth_failure'
                    }
                ];

                const imported = logger.importLogs(duplicateLogs);

                expect(imported).toBe(1); // Only the new one
                expect(logger.getLogsForSync()).toHaveLength(2);
            });

            it('should sort logs by timestamp after import', () => {
                const now = Date.now();

                logger.log({ type: 'auth_success' }); // Current time

                const olderLogs: AuditEntry[] = [
                    {
                        id: 'older-1',
                        timestamp: now - 10000, // 10 seconds ago
                        type: 'auth_failure'
                    }
                ];

                logger.importLogs(olderLogs);

                const logs = logger.getLogsForSync();
                expect(logs[0].id).toBe('older-1');
            });

            it('should trim to maxLogs after import', () => {
                const smallLogger = new AuditLogger({ maxLogs: 3 });

                // Add 2 logs
                smallLogger.log({ type: 'auth_success' });
                smallLogger.log({ type: 'auth_success' });

                // Import 3 more
                const newLogs: AuditEntry[] = Array.from({ length: 3 }, (_, i) => ({
                    id: `imported-${i}`,
                    timestamp: Date.now() + i,
                    type: 'auth_failure' as AuditEventType
                }));

                smallLogger.importLogs(newLogs);

                expect(smallLogger.getLogsForSync()).toHaveLength(3);
            });
        });
    });

    describe('Clear and Sync', () => {
        it('should clear all logs', () => {
            logger.log({ type: 'auth_success' });
            logger.log({ type: 'auth_failure' });

            logger.clear();

            expect(logger.getLogsForSync()).toHaveLength(0);
        });

        it('should trigger sync callback', async () => {
            const syncCallback = vi.fn().mockResolvedValue(undefined);
            const syncLogger = new AuditLogger({ syncCallback });

            syncLogger.log({ type: 'auth_success' });

            await syncLogger.triggerSync();

            expect(syncCallback).toHaveBeenCalledTimes(1);
            expect(syncCallback).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({ type: 'auth_success' })
            ]));
        });

        it('should not throw when no sync callback configured', async () => {
            await expect(logger.triggerSync()).resolves.not.toThrow();
        });
    });

    describe('Singleton Pattern', () => {
        it('should return same instance from getAuditLogger', () => {
            resetAuditLogger();

            const logger1 = getAuditLogger();
            const logger2 = getAuditLogger();

            expect(logger1).toBe(logger2);
        });

        it('should pass options to first instance', () => {
            resetAuditLogger();

            const syncCallback = vi.fn();
            const logger = getAuditLogger({ maxLogs: 50, syncCallback });

            // Add more than 50 logs
            for (let i = 0; i < 60; i++) {
                logger.log({ type: 'auth_success' });
            }

            expect(logger.getLogsForSync().length).toBeLessThanOrEqual(50);
        });

        it('should reset singleton', () => {
            const logger1 = getAuditLogger();
            logger1.log({ type: 'auth_success' });

            resetAuditLogger();

            const logger2 = getAuditLogger();

            expect(logger1).not.toBe(logger2);
            expect(logger2.getLogsForSync()).toHaveLength(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty params object', () => {
            const entry = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'test',
                params: {},
                result: 'allowed'
            });

            expect(entry.params).toEqual({});
        });

        it('should handle deeply nested objects', () => {
            const entry = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'test',
                params: {
                    level1: {
                        level2: {
                            level3: {
                                password: 'deep-secret',
                                value: 'ok'
                            }
                        }
                    }
                },
                result: 'allowed'
            });

            const nested = entry.params?.level1 as Record<string, unknown>;
            const level2 = nested.level2 as Record<string, unknown>;
            const level3 = level2.level3 as Record<string, unknown>;

            expect(level3.password).toBe('[REDACTED]');
            expect(level3.value).toBe('ok');
        });

        it('should handle mixed arrays and objects', () => {
            const entry = logger.logToolCall({
                sessionId: 'session-1',
                tool: 'test',
                params: {
                    users: [
                        { name: 'Alice', token: 'abc' },
                        { name: 'Bob', apiKey: 'xyz' }
                    ],
                    config: {
                        credentials: [
                            { service: 'a', password: 'p1' },
                            { service: 'b', password: 'p2' }
                        ]
                    }
                },
                result: 'allowed'
            });

            const users = entry.params?.users as Array<Record<string, unknown>>;
            expect(users[0].name).toBe('Alice');
            expect(users[0].token).toBe('[REDACTED]');
            expect(users[1].apiKey).toBe('[REDACTED]');

            const config = entry.params?.config as Record<string, unknown>;
            const creds = config.credentials as Array<Record<string, unknown>>;
            expect(creds[0].password).toBe('[REDACTED]');
        });

        it('should handle log with all optional fields', () => {
            const entry = logger.log({
                type: 'tool_call',
                sessionId: 'session-1',
                did: 'did:key:z1',
                client: 'test-client',
                tool: 'test_tool',
                resource: 'profile://test',
                params: { key: 'value' },
                grantId: 'grant-1',
                result: 'allowed',
                reason: 'authorized',
                ip: '127.0.0.1',
                duration: 100,
                metadata: { custom: 'data' }
            });

            expect(entry.sessionId).toBe('session-1');
            expect(entry.did).toBe('did:key:z1');
            expect(entry.client).toBe('test-client');
            expect(entry.tool).toBe('test_tool');
            expect(entry.resource).toBe('profile://test');
            expect(entry.params).toEqual({ key: 'value' });
            expect(entry.grantId).toBe('grant-1');
            expect(entry.result).toBe('allowed');
            expect(entry.reason).toBe('authorized');
            expect(entry.ip).toBe('127.0.0.1');
            expect(entry.duration).toBe(100);
            expect(entry.metadata).toEqual({ custom: 'data' });
        });

        it('should generate unique IDs', () => {
            const ids = new Set<string>();

            for (let i = 0; i < 100; i++) {
                const entry = logger.log({ type: 'auth_success' });
                ids.add(entry.id);
            }

            expect(ids.size).toBe(100);
        });
    });
});
