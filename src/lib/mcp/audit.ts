/**
 * MCP Audit Logging System
 *
 * Comprehensive audit logging for MCP server operations.
 * Logs are encrypted and synced with the vault for persistence.
 */

import { log } from './config';

// ============================================================
// Audit Entry Types
// ============================================================

export type AuditEventType =
    | 'auth_success'
    | 'auth_failure'
    | 'session_created'
    | 'session_expired'
    | 'tool_call'
    | 'resource_read'
    | 'authorization_failure'
    | 'grant_revoked'
    | 'grant_created'
    | 'connection_opened'
    | 'connection_closed';

export interface AuditEntry {
    id: string;
    timestamp: number;
    type: AuditEventType;
    sessionId?: string;
    did?: string;
    client?: string;
    tool?: string;
    resource?: string;
    params?: Record<string, unknown>;
    grantId?: string;
    result?: 'allowed' | 'denied';
    reason?: string;
    ip?: string;
    duration?: number;  // Operation duration in ms
    metadata?: Record<string, unknown>;
}

export interface AuditLogStats {
    totalEntries: number;
    entriesByType: Record<AuditEventType, number>;
    uniqueSessions: number;
    uniqueClients: number;
    oldestEntry: number | null;
    newestEntry: number | null;
}

// ============================================================
// Sensitive Data Sanitization
// ============================================================

const SENSITIVE_KEYS = new Set([
    'password',
    'mnemonic',
    'privateKey',
    'secret',
    'token',
    'apiKey',
    'api_key',
    'authorization',
    'credential',
    'seed'
]);

function sanitizeParams(params: unknown): unknown {
    if (params === null || params === undefined) {
        return params;
    }

    if (typeof params !== 'object') {
        return params;
    }

    if (Array.isArray(params)) {
        return params.map(sanitizeParams);
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_KEYS.has(lowerKey) || SENSITIVE_KEYS.has(key)) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeParams(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

// ============================================================
// Audit Logger Class
// ============================================================

export class AuditLogger {
    private logs: AuditEntry[] = [];
    private readonly maxLogs: number;
    private readonly syncCallback?: (logs: AuditEntry[]) => Promise<void>;

    constructor(options: {
        maxLogs?: number;
        syncCallback?: (logs: AuditEntry[]) => Promise<void>;
    } = {}) {
        this.maxLogs = options.maxLogs ?? 10000;
        this.syncCallback = options.syncCallback;
    }

    /**
     * Log an audit event.
     */
    log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
        const fullEntry: AuditEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            ...entry,
            // Sanitize params if present
            params: entry.params ? sanitizeParams(entry.params) as Record<string, unknown> : undefined
        };

        this.logs.push(fullEntry);

        // Rotate logs if we exceed max
        if (this.logs.length > this.maxLogs) {
            const removed = this.logs.splice(0, this.logs.length - this.maxLogs);
            log(`Audit log rotated, removed ${removed.length} old entries`);
        }

        // Log to console for debugging (in non-production)
        if (process.env.DEBUG === 'true') {
            log(`[AUDIT] ${entry.type}`, {
                sessionId: entry.sessionId,
                client: entry.client,
                tool: entry.tool,
                result: entry.result
            });
        }

        return fullEntry;
    }

    /**
     * Log authentication success.
     */
    logAuthSuccess(data: {
        sessionId: string;
        did: string;
        client: string;
        ip?: string;
    }): AuditEntry {
        return this.log({
            type: 'auth_success',
            ...data
        });
    }

    /**
     * Log authentication failure.
     */
    logAuthFailure(data: {
        reason: string;
        ip?: string;
        client?: string;
    }): AuditEntry {
        return this.log({
            type: 'auth_failure',
            result: 'denied',
            ...data
        });
    }

    /**
     * Log a tool call.
     */
    logToolCall(data: {
        sessionId: string;
        tool: string;
        params?: Record<string, unknown>;
        grantId?: string;
        result: 'allowed' | 'denied';
        duration?: number;
        reason?: string;
    }): AuditEntry {
        return this.log({
            type: 'tool_call',
            ...data
        });
    }

    /**
     * Log a resource read.
     */
    logResourceRead(data: {
        sessionId: string;
        resource: string;
        result: 'allowed' | 'denied';
        duration?: number;
        reason?: string;
    }): AuditEntry {
        return this.log({
            type: 'resource_read',
            ...data
        });
    }

    /**
     * Log an authorization failure.
     */
    logAuthorizationFailure(data: {
        sessionId: string;
        tool?: string;
        resource?: string;
        reason: string;
    }): AuditEntry {
        return this.log({
            type: 'authorization_failure',
            result: 'denied',
            ...data
        });
    }

    /**
     * Log grant revocation.
     */
    logGrantRevoked(data: {
        grantId: string;
        sessionId?: string;
        metadata?: Record<string, unknown>;
    }): AuditEntry {
        return this.log({
            type: 'grant_revoked',
            ...data
        });
    }

    /**
     * Log grant creation.
     */
    logGrantCreated(data: {
        grantId: string;
        sessionId: string;
        did: string;
        metadata?: Record<string, unknown>;
    }): AuditEntry {
        return this.log({
            type: 'grant_created',
            ...data
        });
    }

    /**
     * Log connection opened.
     */
    logConnectionOpened(data: {
        sessionId: string;
        ip?: string;
        client?: string;
    }): AuditEntry {
        return this.log({
            type: 'connection_opened',
            ...data
        });
    }

    /**
     * Log connection closed.
     */
    logConnectionClosed(data: {
        sessionId: string;
        duration?: number;
    }): AuditEntry {
        return this.log({
            type: 'connection_closed',
            ...data
        });
    }

    // ============================================================
    // Query Methods
    // ============================================================

    /**
     * Get all logs for sync.
     */
    getLogsForSync(): AuditEntry[] {
        return [...this.logs];
    }

    /**
     * Get logs by session ID.
     */
    getLogsBySession(sessionId: string): AuditEntry[] {
        return this.logs.filter(e => e.sessionId === sessionId);
    }

    /**
     * Get logs by type.
     */
    getLogsByType(type: AuditEventType): AuditEntry[] {
        return this.logs.filter(e => e.type === type);
    }

    /**
     * Get logs within a time range.
     */
    getLogsByTimeRange(start: number, end: number): AuditEntry[] {
        return this.logs.filter(e => e.timestamp >= start && e.timestamp <= end);
    }

    /**
     * Get recent logs.
     */
    getRecentLogs(count: number = 100): AuditEntry[] {
        return this.logs.slice(-count);
    }

    /**
     * Get logs by client.
     */
    getLogsByClient(client: string): AuditEntry[] {
        return this.logs.filter(e => e.client === client);
    }

    /**
     * Get audit statistics.
     */
    getStats(): AuditLogStats {
        const entriesByType: Record<string, number> = {};
        const sessions = new Set<string>();
        const clients = new Set<string>();

        for (const entry of this.logs) {
            // Count by type
            entriesByType[entry.type] = (entriesByType[entry.type] || 0) + 1;

            // Track unique sessions
            if (entry.sessionId) {
                sessions.add(entry.sessionId);
            }

            // Track unique clients
            if (entry.client) {
                clients.add(entry.client);
            }
        }

        return {
            totalEntries: this.logs.length,
            entriesByType: entriesByType as Record<AuditEventType, number>,
            uniqueSessions: sessions.size,
            uniqueClients: clients.size,
            oldestEntry: this.logs.length > 0 ? this.logs[0].timestamp : null,
            newestEntry: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : null
        };
    }

    // ============================================================
    // Import/Export for Sync
    // ============================================================

    /**
     * Import logs from another source (e.g., from cloud sync).
     * Deduplicates by ID and sorts by timestamp.
     */
    importLogs(entries: AuditEntry[]): number {
        const existingIds = new Set(this.logs.map(e => e.id));
        let imported = 0;

        for (const entry of entries) {
            if (!existingIds.has(entry.id)) {
                this.logs.push(entry);
                existingIds.add(entry.id);
                imported++;
            }
        }

        // Sort by timestamp
        this.logs.sort((a, b) => a.timestamp - b.timestamp);

        // Trim to max size
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        log(`Imported ${imported} audit log entries`);
        return imported;
    }

    /**
     * Export logs since a given timestamp.
     */
    exportLogsSince(timestamp: number): AuditEntry[] {
        return this.logs.filter(e => e.timestamp > timestamp);
    }

    /**
     * Clear all logs.
     */
    clear(): void {
        this.logs = [];
        log('Audit logs cleared');
    }

    /**
     * Trigger sync callback if configured.
     */
    async triggerSync(): Promise<void> {
        if (this.syncCallback) {
            await this.syncCallback(this.logs);
        }
    }
}

// ============================================================
// Singleton Instance
// ============================================================

let auditLoggerInstance: AuditLogger | null = null;

export function getAuditLogger(options?: {
    maxLogs?: number;
    syncCallback?: (logs: AuditEntry[]) => Promise<void>;
}): AuditLogger {
    if (!auditLoggerInstance) {
        auditLoggerInstance = new AuditLogger(options);
    }
    return auditLoggerInstance;
}

export function resetAuditLogger(): void {
    auditLoggerInstance = null;
}
