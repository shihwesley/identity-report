'use client';

/**
 * Sync Status UI Components
 *
 * Displays sync queue status and handles blocked state.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    SyncQueue,
    SyncQueueStatus,
    DeadLetterEntry,
    getSyncQueue
} from '@/lib/sync/queue';

// ============================================================
// SyncStatusIndicator - Compact status for header/navbar
// ============================================================

interface SyncStatusIndicatorProps {
    onClick?: () => void;
}

export function SyncStatusIndicator({ onClick }: SyncStatusIndicatorProps) {
    const [status, setStatus] = useState<SyncQueueStatus | null>(null);

    useEffect(() => {
        const queue = getSyncQueue();
        setStatus(queue.getStatus());

        const unsubscribe = queue.subscribe((event) => {
            if (event.type === 'status_change') {
                setStatus(event.data as SyncQueueStatus);
            }
        });

        return unsubscribe;
    }, []);

    if (!status) return null;

    const getStatusColor = () => {
        if (!status.isOnline) return 'text-gray-500';
        if (status.isSyncing) return 'text-blue-500';
        if (status.isBlocked) return 'text-red-500';
        if (status.deadLetter > 0) return 'text-amber-500';
        if (status.pending > 0) return 'text-amber-500';
        return 'text-green-500';
    };

    const getStatusIcon = () => {
        if (!status.isOnline) {
            return (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
                </svg>
            );
        }
        if (status.isSyncing) {
            return (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
            );
        }
        if (status.isBlocked || status.deadLetter > 0) {
            return (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            );
        }
        if (status.pending > 0) {
            return (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            );
        }
        return (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
        );
    };

    const getStatusText = () => {
        if (!status.isOnline) return 'Offline';
        if (status.isSyncing) return 'Syncing...';
        if (status.isBlocked) return 'Queue Full';
        if (status.pending > 0) return `${status.pending} pending`;
        return 'Synced';
    };

    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 text-sm ${getStatusColor()} hover:opacity-80 transition-opacity`}
            title={`Sync Status: ${getStatusText()}`}
        >
            {getStatusIcon()}
            <span className="hidden sm:inline">{getStatusText()}</span>
            {status.deadLetter > 0 && (
                <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                    {status.deadLetter}
                </span>
            )}
        </button>
    );
}

// ============================================================
// SyncStatusBanner - Persistent banner for blocked state
// ============================================================

interface SyncStatusBannerProps {
    onOpenDetails?: () => void;
}

export function SyncStatusBanner({ onOpenDetails }: SyncStatusBannerProps) {
    const [status, setStatus] = useState<SyncQueueStatus | null>(null);
    const [isClearing, setIsClearing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        const queue = getSyncQueue();
        setStatus(queue.getStatus());

        const unsubscribe = queue.subscribe((event) => {
            if (event.type === 'status_change') {
                setStatus(event.data as SyncQueueStatus);
            }
        });

        return unsubscribe;
    }, []);

    const handleForceSync = useCallback(async () => {
        setIsSyncing(true);
        try {
            const queue = getSyncQueue();
            await queue.forceSync();
        } catch (error) {
            console.error('Force sync failed:', error);
        } finally {
            setIsSyncing(false);
        }
    }, []);

    const handleClearQueue = useCallback(async () => {
        if (!confirm('This will permanently delete all pending changes. Are you sure?')) {
            return;
        }
        setIsClearing(true);
        try {
            const queue = getSyncQueue();
            await queue.clearQueue();
        } finally {
            setIsClearing(false);
        }
    }, []);

    if (!status || !status.isBlocked) return null;

    return (
        <div className="bg-amber-500 text-black px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>
                    Sync queue full ({status.queueCapacity.used}/{status.queueCapacity.max}).
                    New changes blocked until synced.
                </span>
            </div>
            <div className="flex gap-2">
                {onOpenDetails && (
                    <button
                        onClick={onOpenDetails}
                        className="bg-black/20 text-black px-3 py-1 rounded text-sm hover:bg-black/30"
                    >
                        Details
                    </button>
                )}
                <button
                    onClick={handleForceSync}
                    disabled={!status.isOnline || isSyncing}
                    className="bg-black text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                >
                    {isSyncing ? 'Syncing...' : status.isOnline ? 'Sync Now' : 'Offline'}
                </button>
                <button
                    onClick={handleClearQueue}
                    disabled={isClearing}
                    className="bg-red-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                >
                    {isClearing ? 'Clearing...' : 'Clear Queue'}
                </button>
            </div>
        </div>
    );
}

// ============================================================
// SyncStatusPanel - Detailed sync status panel
// ============================================================

interface SyncStatusPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SyncStatusPanel({ isOpen, onClose }: SyncStatusPanelProps) {
    const [status, setStatus] = useState<SyncQueueStatus | null>(null);
    const [deadLetter, setDeadLetter] = useState<DeadLetterEntry[]>([]);
    const [activeTab, setActiveTab] = useState<'status' | 'failed'>('status');

    useEffect(() => {
        const queue = getSyncQueue();
        setStatus(queue.getStatus());
        setDeadLetter(queue.getDeadLetterEntries());

        const unsubscribe = queue.subscribe((event) => {
            if (event.type === 'status_change') {
                setStatus(event.data as SyncQueueStatus);
                setDeadLetter(queue.getDeadLetterEntries());
            }
        });

        return unsubscribe;
    }, []);

    const handleRetryDeadLetter = useCallback(async (entryId: string) => {
        const queue = getSyncQueue();
        await queue.retryDeadLetter(entryId);
    }, []);

    const handleDismissDeadLetter = useCallback(async (entryId: string) => {
        const queue = getSyncQueue();
        await queue.dismissDeadLetter(entryId);
    }, []);

    const handleRetryAll = useCallback(async () => {
        const queue = getSyncQueue();
        await queue.retryAllDeadLetter();
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                    <h2 className="text-lg font-semibold">Sync Status</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        aria-label="Close"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b dark:border-gray-700">
                    <button
                        onClick={() => setActiveTab('status')}
                        className={`flex-1 px-4 py-2 text-sm font-medium ${activeTab === 'status'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Status
                    </button>
                    <button
                        onClick={() => setActiveTab('failed')}
                        className={`flex-1 px-4 py-2 text-sm font-medium ${activeTab === 'failed'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Failed ({status?.deadLetter ?? 0})
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4">
                    {activeTab === 'status' && status && (
                        <div className="space-y-4">
                            {/* Connection Status */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Connection</span>
                                <span className={status.isOnline ? 'text-green-500' : 'text-red-500'}>
                                    {status.isOnline ? 'Online' : 'Offline'}
                                </span>
                            </div>

                            {/* Sync Status */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Sync Status</span>
                                <span className={status.isSyncing ? 'text-blue-500' : 'text-gray-500'}>
                                    {status.isSyncing ? 'Syncing...' : 'Idle'}
                                </span>
                            </div>

                            {/* Queue Status */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Queue</span>
                                    <span>
                                        {status.queueCapacity.used} / {status.queueCapacity.max}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${status.isBlocked ? 'bg-red-500' : 'bg-blue-500'
                                            }`}
                                        style={{
                                            width: `${(status.queueCapacity.used / status.queueCapacity.max) * 100}%`
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Detailed Counts */}
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t dark:border-gray-700">
                                <div className="text-center p-3 bg-gray-100 dark:bg-gray-800 rounded">
                                    <div className="text-2xl font-bold text-amber-500">{status.pending}</div>
                                    <div className="text-sm text-gray-500">Pending</div>
                                </div>
                                <div className="text-center p-3 bg-gray-100 dark:bg-gray-800 rounded">
                                    <div className="text-2xl font-bold text-blue-500">{status.processing}</div>
                                    <div className="text-sm text-gray-500">Processing</div>
                                </div>
                                <div className="text-center p-3 bg-gray-100 dark:bg-gray-800 rounded">
                                    <div className="text-2xl font-bold text-red-500">{status.failed}</div>
                                    <div className="text-sm text-gray-500">Retrying</div>
                                </div>
                                <div className="text-center p-3 bg-gray-100 dark:bg-gray-800 rounded">
                                    <div className="text-2xl font-bold text-gray-500">{status.deadLetter}</div>
                                    <div className="text-sm text-gray-500">Dead Letter</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'failed' && (
                        <div className="space-y-3">
                            {deadLetter.length === 0 ? (
                                <div className="text-center text-gray-500 py-8">
                                    No failed operations
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-end mb-2">
                                        <button
                                            onClick={handleRetryAll}
                                            className="text-sm text-blue-500 hover:text-blue-600"
                                        >
                                            Retry All
                                        </button>
                                    </div>
                                    {deadLetter.map((entry) => (
                                        <DeadLetterItem
                                            key={entry.id}
                                            entry={entry}
                                            onRetry={() => handleRetryDeadLetter(entry.id)}
                                            onDismiss={() => handleDismissDeadLetter(entry.id)}
                                        />
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================
// DeadLetterItem - Individual failed operation item
// ============================================================

interface DeadLetterItemProps {
    entry: DeadLetterEntry;
    onRetry: () => void;
    onDismiss: () => void;
}

function DeadLetterItem({ entry, onRetry, onDismiss }: DeadLetterItemProps) {
    // Calculate days until purge - safe impure call as value is display-only
    const [daysUntilPurge, setDaysUntilPurge] = useState(0);

    useEffect(() => {
        setDaysUntilPurge(Math.ceil((entry.purgeAt - Date.now()) / (24 * 60 * 60 * 1000)));
    }, [entry.purgeAt]);

    return (
        <div className="border dark:border-gray-700 rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between">
                <div>
                    <div className="font-medium capitalize">
                        {entry.type} {entry.entity}
                    </div>
                    <div className="text-sm text-gray-500">
                        ID: {entry.entityId.slice(0, 8)}...
                    </div>
                </div>
                <div className="text-xs text-gray-400">
                    {new Date(entry.failedAt).toLocaleDateString()}
                </div>
            </div>

            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                {entry.lastError}
            </div>

            <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">
                    Auto-delete in {daysUntilPurge} days
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={onDismiss}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        Dismiss
                    </button>
                    <button
                        onClick={onRetry}
                        className="text-blue-500 hover:text-blue-600"
                    >
                        Retry
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// Exports
// ============================================================

export { SyncQueue, getSyncQueue } from '@/lib/sync/queue';
