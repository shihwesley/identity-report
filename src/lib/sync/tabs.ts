/**
 * Tab Sync Manager
 *
 * Implements real-time synchronization between browser tabs using BroadcastChannel.
 * Uses heartbeat-based authority to manage write access.
 */

import {
    TabMessage,
    HeartbeatMessage,
    ChangeMessage,
    ConflictMessage,
    TabState,
    ConflictEntityType,
    Conflict
} from './types';

// ============================================================
// Configuration
// ============================================================

const CHANNEL_NAME = 'identity-report-sync';
const HEARTBEAT_INTERVAL_MS = 10000;  // 10 seconds
const INACTIVE_TIMEOUT_MS = 30000;    // 30 seconds
const AUTHORITY_CHECK_INTERVAL_MS = 5000;  // 5 seconds

// ============================================================
// Types
// ============================================================

export interface TabSyncOptions {
    onConflict?: (conflict: Conflict) => void;
    onChange?: (change: ChangeMessage['payload']) => void;
    onAuthorityChange?: (hasAuthority: boolean) => void;
    onTabsChange?: (tabs: TabState[]) => void;
}

export type ChangeOperation = 'create' | 'update' | 'delete';

// ============================================================
// Tab Sync Manager
// ============================================================

export class TabSyncManager {
    private channel: BroadcastChannel | null = null;
    private tabId: string;
    private tabs: Map<string, TabState> = new Map();
    private heartbeatInterval: number | null = null;
    private authorityCheckInterval: number | null = null;
    private _hasWriteAuthority: boolean = false;
    private lastActivity: number = Date.now();
    private options: TabSyncOptions;
    private isInitialized: boolean = false;

    constructor(options: TabSyncOptions = {}) {
        this.tabId = this.generateTabId();
        this.options = options;
    }

    /**
     * Initialize the tab sync manager.
     * Must be called in browser environment.
     */
    initialize(): void {
        if (this.isInitialized) return;
        if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
            console.warn('TabSyncManager: BroadcastChannel not available');
            this._hasWriteAuthority = true;  // Single tab has authority
            return;
        }

        try {
            this.channel = new BroadcastChannel(CHANNEL_NAME);
            this.channel.onmessage = this.handleMessage.bind(this);

            // Register this tab
            this.tabs.set(this.tabId, {
                tabId: this.tabId,
                lastHeartbeat: Date.now(),
                hasWriteAuthority: false,
                isActive: true
            });

            // Start heartbeat
            this.heartbeatInterval = window.setInterval(
                () => this.sendHeartbeat(),
                HEARTBEAT_INTERVAL_MS
            );

            // Start authority check
            this.authorityCheckInterval = window.setInterval(
                () => this.checkAuthority(),
                AUTHORITY_CHECK_INTERVAL_MS
            );

            // Send initial heartbeat
            this.sendHeartbeat();

            // Track activity
            this.setupActivityTracking();

            this.isInitialized = true;
            console.log(`TabSyncManager initialized: ${this.tabId}`);
        } catch (error) {
            console.error('TabSyncManager initialization failed:', error);
            this._hasWriteAuthority = true;  // Fallback to single-tab mode
        }
    }

    /**
     * Clean up resources.
     */
    destroy(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.authorityCheckInterval) {
            clearInterval(this.authorityCheckInterval);
            this.authorityCheckInterval = null;
        }
        if (this.channel) {
            this.channel.close();
            this.channel = null;
        }
        this.isInitialized = false;
    }

    /**
     * Check if this tab has write authority.
     */
    get hasWriteAuthority(): boolean {
        return this._hasWriteAuthority;
    }

    /**
     * Get this tab's ID.
     */
    getTabId(): string {
        return this.tabId;
    }

    /**
     * Get all known tabs.
     */
    getTabs(): TabState[] {
        return Array.from(this.tabs.values());
    }

    /**
     * Get active tab count.
     */
    getActiveTabCount(): number {
        return this.tabs.size;
    }

    /**
     * Check if we can write (have authority).
     */
    canWrite(): boolean {
        if (!this.isInitialized) return true;  // Single tab mode
        return this._hasWriteAuthority;
    }

    /**
     * Broadcast a change to other tabs.
     */
    broadcastChange(
        entityType: ConflictEntityType,
        entityId: string,
        operation: ChangeOperation,
        data: unknown
    ): void {
        if (!this.channel) return;

        const message: ChangeMessage = {
            type: 'change',
            tabId: this.tabId,
            timestamp: Date.now(),
            payload: {
                entityType,
                entityId,
                operation,
                data
            }
        };

        this.channel.postMessage(message);
    }

    /**
     * Broadcast a conflict to other tabs.
     */
    broadcastConflict(conflict: Conflict): void {
        if (!this.channel) return;

        const message: ConflictMessage = {
            type: 'conflict',
            tabId: this.tabId,
            timestamp: Date.now(),
            payload: conflict
        };

        this.channel.postMessage(message);
    }

    /**
     * Request write authority.
     */
    requestAuthority(): boolean {
        if (this._hasWriteAuthority) return true;

        // Mark activity to boost our claim
        this.lastActivity = Date.now();
        this.sendHeartbeat();

        // Check authority after a short delay
        setTimeout(() => this.checkAuthority(), 100);

        return this._hasWriteAuthority;
    }

    // ============================================================
    // Private Methods
    // ============================================================

    private generateTabId(): string {
        return `tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    private setupActivityTracking(): void {
        if (typeof window === 'undefined') return;

        const updateActivity = () => {
            this.lastActivity = Date.now();
        };

        // Track user activity
        window.addEventListener('focus', updateActivity);
        window.addEventListener('click', updateActivity);
        window.addEventListener('keydown', updateActivity);
        window.addEventListener('mousemove', this.throttle(updateActivity, 1000));
        window.addEventListener('scroll', this.throttle(updateActivity, 1000));

        // Handle page visibility
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                updateActivity();
                this.sendHeartbeat();
            }
        });

        // Handle page unload
        window.addEventListener('beforeunload', () => {
            this.destroy();
        });
    }

    private throttle(fn: () => void, wait: number): () => void {
        let lastTime = 0;
        return () => {
            const now = Date.now();
            if (now - lastTime >= wait) {
                lastTime = now;
                fn();
            }
        };
    }

    private sendHeartbeat(): void {
        if (!this.channel) return;

        const message: HeartbeatMessage = {
            type: 'heartbeat',
            tabId: this.tabId,
            timestamp: Date.now(),
            hasWriteAuthority: this._hasWriteAuthority
        };

        this.channel.postMessage(message);

        // Update our own state
        this.tabs.set(this.tabId, {
            tabId: this.tabId,
            lastHeartbeat: Date.now(),
            hasWriteAuthority: this._hasWriteAuthority,
            isActive: true
        });
    }

    private handleMessage(event: MessageEvent<TabMessage>): void {
        const message = event.data;
        if (!message || !message.type) return;

        // Ignore our own messages
        if (message.tabId === this.tabId) return;

        switch (message.type) {
            case 'heartbeat':
                this.handleHeartbeat(message as HeartbeatMessage);
                break;
            case 'change':
                this.handleChange(message as ChangeMessage);
                break;
            case 'conflict':
                this.handleConflict(message as ConflictMessage);
                break;
        }
    }

    private handleHeartbeat(message: HeartbeatMessage): void {
        // Update or add the tab
        this.tabs.set(message.tabId, {
            tabId: message.tabId,
            lastHeartbeat: message.timestamp,
            hasWriteAuthority: message.hasWriteAuthority,
            isActive: true
        });

        // Notify of tabs change
        this.options.onTabsChange?.(this.getTabs());

        // Re-check authority
        this.checkAuthority();
    }

    private handleChange(message: ChangeMessage): void {
        // If we receive a change from another tab and have a conflict, handle it
        this.options.onChange?.(message.payload);
    }

    private handleConflict(message: ConflictMessage): void {
        this.options.onConflict?.(message.payload);
    }

    private checkAuthority(): void {
        const now = Date.now();
        const staleTabs: string[] = [];

        // Clean up stale tabs
        for (const [tabId, state] of this.tabs) {
            if (tabId !== this.tabId && now - state.lastHeartbeat > INACTIVE_TIMEOUT_MS) {
                staleTabs.push(tabId);
            }
        }

        for (const tabId of staleTabs) {
            this.tabs.delete(tabId);
        }

        // Determine authority based on most recent activity
        // The tab with the most recent heartbeat gets authority
        let authorityTab: TabState | null = null;
        let mostRecentActivity = 0;

        for (const state of this.tabs.values()) {
            if (state.lastHeartbeat > mostRecentActivity) {
                mostRecentActivity = state.lastHeartbeat;
                authorityTab = state;
            }
        }

        // If this tab has the most recent activity, claim authority
        const ourState = this.tabs.get(this.tabId);
        const previousAuthority = this._hasWriteAuthority;

        if (ourState && authorityTab?.tabId === this.tabId) {
            this._hasWriteAuthority = true;
        } else if (this.tabs.size === 1 && this.tabs.has(this.tabId)) {
            // Only tab - we have authority
            this._hasWriteAuthority = true;
        } else if (authorityTab && authorityTab.tabId !== this.tabId) {
            // Another tab has more recent activity
            this._hasWriteAuthority = false;
        }

        // Notify if authority changed
        if (previousAuthority !== this._hasWriteAuthority) {
            console.log(`TabSyncManager: Authority ${this._hasWriteAuthority ? 'acquired' : 'released'}`);
            this.options.onAuthorityChange?.(this._hasWriteAuthority);
        }

        // Notify of tabs change if any were removed
        if (staleTabs.length > 0) {
            this.options.onTabsChange?.(this.getTabs());
        }
    }
}

// ============================================================
// Singleton Instance
// ============================================================

let tabSyncInstance: TabSyncManager | null = null;

export function getTabSyncManager(options?: TabSyncOptions): TabSyncManager {
    if (!tabSyncInstance) {
        tabSyncInstance = new TabSyncManager(options);
    }
    return tabSyncInstance;
}

export function initializeTabSync(options?: TabSyncOptions): TabSyncManager {
    const manager = getTabSyncManager(options);
    manager.initialize();
    return manager;
}

export function destroyTabSync(): void {
    if (tabSyncInstance) {
        tabSyncInstance.destroy();
        tabSyncInstance = null;
    }
}
