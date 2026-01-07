/**
 * Offline-First Sync Queue
 *
 * Queues all write operations when offline and replays them upon reconnection.
 * Handles partial failures with exponential backoff retry.
 */

// ============================================================
// Types
// ============================================================

export type OperationType = 'create' | 'update' | 'delete';
export type EntityType = 'memory' | 'conversation' | 'profile' | 'preference' | 'project';

export interface QueuedOperation {
    id: string;
    type: OperationType;
    entity: EntityType;
    entityId: string;
    payload: unknown;
    timestamp: number;
    retryCount: number;
    nextRetryAt: number;
    status: 'pending' | 'processing' | 'failed' | 'dead';
}

export interface DeadLetterEntry extends QueuedOperation {
    failedAt: number;
    lastError: string;
    purgeAt: number;
}

export interface EnqueueResult {
    success: boolean;
    blocked: boolean;
    message?: string;
    operationId?: string;
}

export interface SyncQueueStatus {
    isOnline: boolean;
    isSyncing: boolean;
    pending: number;
    processing: number;
    failed: number;
    deadLetter: number;
    isBlocked: boolean;
    queueCapacity: {
        used: number;
        max: number;
    };
}

export interface SyncQueueConfig {
    maxQueueSize: number;
    maxRetries: number;
    deadLetterTtlDays: number;
    initialRetryDelay: number;
    maxRetryDelay: number;
    requiredPinServices: number;
}

type SyncQueueEventType = 'status_change' | 'operation_complete' | 'operation_failed' | 'dead_letter_warning';

interface SyncQueueEvent {
    type: SyncQueueEventType;
    data: unknown;
}

type SyncQueueListener = (event: SyncQueueEvent) => void;

// ============================================================
// Constants
// ============================================================

export const DEFAULT_SYNC_CONFIG: SyncQueueConfig = {
    maxQueueSize: 1000,
    maxRetries: 3,
    deadLetterTtlDays: 30,
    initialRetryDelay: 1000,
    maxRetryDelay: 5 * 60 * 1000, // 5 minutes
    requiredPinServices: 2
};

const STORAGE_KEY_QUEUE = 'identity-report-sync-queue';
const STORAGE_KEY_DEAD_LETTER = 'identity-report-dead-letter';

// ============================================================
// Sync Queue Class
// ============================================================

export class SyncQueue {
    private queue: QueuedOperation[] = [];
    private deadLetter: DeadLetterEntry[] = [];
    private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
    private isSyncing: boolean = false;
    private config: SyncQueueConfig;
    private listeners: Set<SyncQueueListener> = new Set();
    private processTimeout: ReturnType<typeof setTimeout> | null = null;
    private deadLetterPurgerInterval: ReturnType<typeof setInterval> | null = null;

    // Injected dependencies
    private syncExecutor: ((operations: QueuedOperation[]) => Promise<void>) | null = null;

    constructor(config: Partial<SyncQueueConfig> = {}) {
        this.config = { ...DEFAULT_SYNC_CONFIG, ...config };

        if (typeof window !== 'undefined') {
            this.setupEventListeners();
            this.loadFromStorage();
            this.startDeadLetterPurger();
        }
    }

    // ============================================================
    // Public API
    // ============================================================

    /**
     * Set the sync executor function that will be called to process operations.
     */
    setSyncExecutor(executor: (operations: QueuedOperation[]) => Promise<void>): void {
        this.syncExecutor = executor;
    }

    /**
     * Enqueue a new operation.
     */
    async enqueue(
        operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount' | 'nextRetryAt' | 'status'>
    ): Promise<EnqueueResult> {
        // Check queue limit
        if (this.queue.length >= this.config.maxQueueSize) {
            return {
                success: false,
                blocked: true,
                message: 'Sync queue full. Please connect to internet to sync pending changes.'
            };
        }

        const op: QueuedOperation = {
            ...operation,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            retryCount: 0,
            nextRetryAt: Date.now(),
            status: 'pending'
        };

        this.queue.push(op);
        await this.persistQueue();
        this.emitStatusChange();

        // Try to process immediately if online
        if (this.isOnline && !this.isSyncing) {
            this.scheduleProcessing(0);
        }

        return { success: true, blocked: false, operationId: op.id };
    }

    /**
     * Force immediate sync attempt.
     */
    async forceSync(): Promise<void> {
        if (!this.isOnline) {
            throw new Error('Cannot sync while offline');
        }
        await this.processQueue();
    }

    /**
     * Clear all pending operations (destructive).
     */
    async clearQueue(): Promise<number> {
        const count = this.queue.length;
        this.queue = [];
        await this.persistQueue();
        this.emitStatusChange();
        return count;
    }

    /**
     * Retry a dead letter entry.
     */
    async retryDeadLetter(entryId: string): Promise<boolean> {
        const entry = this.deadLetter.find(d => d.id === entryId);
        if (!entry) return false;

        // Move back to queue with reset retry count
        const op: QueuedOperation = {
            id: entry.id,
            type: entry.type,
            entity: entry.entity,
            entityId: entry.entityId,
            payload: entry.payload,
            timestamp: entry.timestamp,
            retryCount: 0,
            nextRetryAt: Date.now(),
            status: 'pending'
        };

        this.queue.push(op);
        this.deadLetter = this.deadLetter.filter(d => d.id !== entryId);

        await this.persistQueue();
        await this.persistDeadLetter();
        this.emitStatusChange();

        if (this.isOnline) {
            this.scheduleProcessing(0);
        }

        return true;
    }

    /**
     * Retry all dead letter entries.
     */
    async retryAllDeadLetter(): Promise<number> {
        const count = this.deadLetter.length;
        for (const entry of this.deadLetter) {
            await this.retryDeadLetter(entry.id);
        }
        return count;
    }

    /**
     * Dismiss a dead letter entry (permanently delete).
     */
    async dismissDeadLetter(entryId: string): Promise<boolean> {
        const before = this.deadLetter.length;
        this.deadLetter = this.deadLetter.filter(d => d.id !== entryId);
        if (this.deadLetter.length < before) {
            await this.persistDeadLetter();
            this.emitStatusChange();
            return true;
        }
        return false;
    }

    /**
     * Get current queue status.
     */
    getStatus(): SyncQueueStatus {
        return {
            isOnline: this.isOnline,
            isSyncing: this.isSyncing,
            pending: this.queue.filter(o => o.status === 'pending').length,
            processing: this.queue.filter(o => o.status === 'processing').length,
            failed: this.queue.filter(o => o.status === 'failed').length,
            deadLetter: this.deadLetter.length,
            isBlocked: this.queue.length >= this.config.maxQueueSize,
            queueCapacity: {
                used: this.queue.length,
                max: this.config.maxQueueSize
            }
        };
    }

    /**
     * Get all dead letter entries.
     */
    getDeadLetterEntries(): DeadLetterEntry[] {
        return [...this.deadLetter];
    }

    /**
     * Get all pending operations.
     */
    getPendingOperations(): QueuedOperation[] {
        return this.queue.filter(o => o.status === 'pending');
    }

    /**
     * Subscribe to queue events.
     */
    subscribe(listener: SyncQueueListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Cleanup resources.
     */
    destroy(): void {
        if (typeof window !== 'undefined') {
            window.removeEventListener('online', this.handleOnline);
            window.removeEventListener('offline', this.handleOffline);
        }
        if (this.processTimeout) {
            clearTimeout(this.processTimeout);
        }
        if (this.deadLetterPurgerInterval) {
            clearInterval(this.deadLetterPurgerInterval);
        }
        this.listeners.clear();
    }

    // ============================================================
    // Internal Methods
    // ============================================================

    private setupEventListeners(): void {
        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);
    }

    private handleOnline = (): void => {
        this.isOnline = true;
        this.emitStatusChange();
        this.scheduleProcessing(0);
    };

    private handleOffline = (): void => {
        this.isOnline = false;
        this.emitStatusChange();
    };

    private scheduleProcessing(delay: number): void {
        if (this.processTimeout) {
            clearTimeout(this.processTimeout);
        }
        this.processTimeout = setTimeout(() => this.processQueue(), delay);
    }

    private async processQueue(): Promise<void> {
        if (this.isSyncing || !this.isOnline || !this.syncExecutor) {
            return;
        }

        this.isSyncing = true;
        this.emitStatusChange();

        try {
            // Get pending operations ready for processing
            const pendingOps = this.queue
                .filter(o => o.status === 'pending' && o.nextRetryAt <= Date.now())
                .sort((a, b) => a.timestamp - b.timestamp);

            if (pendingOps.length === 0) {
                return;
            }

            // Mark as processing
            for (const op of pendingOps) {
                op.status = 'processing';
            }
            this.emitStatusChange();

            try {
                // Execute sync
                await this.syncExecutor(pendingOps);

                // Success - remove from queue
                const successIds = new Set(pendingOps.map(o => o.id));
                this.queue = this.queue.filter(o => !successIds.has(o.id));

                for (const op of pendingOps) {
                    this.emit({
                        type: 'operation_complete',
                        data: { operationId: op.id, entity: op.entity, entityId: op.entityId }
                    });
                }
            } catch (error) {
                // Failed - handle retry or dead letter
                for (const op of pendingOps) {
                    op.status = 'failed';
                    op.retryCount++;

                    if (op.retryCount >= this.config.maxRetries) {
                        this.moveToDeadLetter(op, error instanceof Error ? error.message : 'Unknown error');
                    } else {
                        // Schedule retry with exponential backoff
                        const delay = Math.min(
                            this.config.initialRetryDelay * Math.pow(2, op.retryCount),
                            this.config.maxRetryDelay
                        );
                        op.nextRetryAt = Date.now() + delay;
                        op.status = 'pending';

                        this.emit({
                            type: 'operation_failed',
                            data: {
                                operationId: op.id,
                                retryCount: op.retryCount,
                                nextRetryAt: op.nextRetryAt,
                                error: error instanceof Error ? error.message : 'Unknown error'
                            }
                        });
                    }
                }
            }

            await this.persistQueue();
            await this.persistDeadLetter();
        } finally {
            this.isSyncing = false;
            this.emitStatusChange();

            // Schedule next processing if there are pending operations
            const nextRetry = this.queue
                .filter(o => o.status === 'pending')
                .map(o => o.nextRetryAt)
                .sort((a, b) => a - b)[0];

            if (nextRetry && this.isOnline) {
                const delay = Math.max(0, nextRetry - Date.now());
                this.scheduleProcessing(delay);
            }
        }
    }

    private moveToDeadLetter(op: QueuedOperation, error: string): void {
        const deadEntry: DeadLetterEntry = {
            ...op,
            status: 'dead',
            failedAt: Date.now(),
            lastError: error,
            purgeAt: Date.now() + (this.config.deadLetterTtlDays * 24 * 60 * 60 * 1000)
        };

        this.deadLetter.push(deadEntry);
        this.queue = this.queue.filter(o => o.id !== op.id);

        this.emit({
            type: 'operation_failed',
            data: {
                operationId: op.id,
                movedToDeadLetter: true,
                error
            }
        });
    }

    private startDeadLetterPurger(): void {
        // Check daily for expired dead letter entries
        this.deadLetterPurgerInterval = setInterval(() => {
            this.checkDeadLetterExpiry();
        }, 24 * 60 * 60 * 1000);

        // Also check on startup
        this.checkDeadLetterExpiry();
    }

    private checkDeadLetterExpiry(): void {
        const now = Date.now();
        const warningThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days

        // Find entries about to expire
        const expiring = this.deadLetter.filter(d =>
            d.purgeAt <= now + warningThreshold && d.purgeAt > now
        );

        if (expiring.length > 0) {
            this.emit({
                type: 'dead_letter_warning',
                data: {
                    entries: expiring.map(e => ({
                        id: e.id,
                        entity: e.entity,
                        entityId: e.entityId,
                        purgeAt: e.purgeAt
                    }))
                }
            });
        }

        // Purge expired entries
        const before = this.deadLetter.length;
        this.deadLetter = this.deadLetter.filter(d => d.purgeAt > now);

        if (this.deadLetter.length < before) {
            this.persistDeadLetter();
            this.emitStatusChange();
        }
    }

    // ============================================================
    // Persistence
    // ============================================================

    private loadFromStorage(): void {
        try {
            const queueData = localStorage.getItem(STORAGE_KEY_QUEUE);
            if (queueData) {
                this.queue = JSON.parse(queueData);
                // Reset processing status on reload
                for (const op of this.queue) {
                    if (op.status === 'processing') {
                        op.status = 'pending';
                    }
                }
            }

            const deadLetterData = localStorage.getItem(STORAGE_KEY_DEAD_LETTER);
            if (deadLetterData) {
                this.deadLetter = JSON.parse(deadLetterData);
            }
        } catch (error) {
            console.error('Failed to load sync queue from storage:', error);
        }
    }

    private async persistQueue(): Promise<void> {
        try {
            localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(this.queue));
        } catch (error) {
            console.error('Failed to persist sync queue:', error);
        }
    }

    private async persistDeadLetter(): Promise<void> {
        try {
            localStorage.setItem(STORAGE_KEY_DEAD_LETTER, JSON.stringify(this.deadLetter));
        } catch (error) {
            console.error('Failed to persist dead letter queue:', error);
        }
    }

    // ============================================================
    // Events
    // ============================================================

    private emit(event: SyncQueueEvent): void {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (error) {
                console.error('Error in sync queue listener:', error);
            }
        }
    }

    private emitStatusChange(): void {
        this.emit({
            type: 'status_change',
            data: this.getStatus()
        });
    }
}

// ============================================================
// Singleton Instance
// ============================================================

let syncQueueInstance: SyncQueue | null = null;

export function getSyncQueue(config?: Partial<SyncQueueConfig>): SyncQueue {
    if (!syncQueueInstance) {
        syncQueueInstance = new SyncQueue(config);
    }
    return syncQueueInstance;
}

export function resetSyncQueue(): void {
    if (syncQueueInstance) {
        syncQueueInstance.destroy();
        syncQueueInstance = null;
    }
}
