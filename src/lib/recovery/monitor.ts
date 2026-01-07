/**
 * Share Expiry Monitor
 *
 * Monitors share expiry dates and triggers auto-prompt reminders.
 * Implements the spec's grace period with escalating notifications.
 */

import { GuardianManager, getGuardianManager } from './guardian';
import { ExpiryCheckResult, ExpiryWarning, RECOVERY_CONSTANTS } from './types';
import { logger } from '@/lib/logger';

// ============================================================
// Types
// ============================================================

export interface ExpiryNotification {
    id: string;
    type: 'dashboard' | 'email' | 'banner';
    severity: 'info' | 'warning' | 'urgent';
    title: string;
    message: string;
    action?: string;
    actionLabel?: string;
    dismissable: boolean;
    createdAt: number;
    expiresAt?: number;
    dismissed?: boolean;
}

export interface MonitorCallbacks {
    onWarning?: (warnings: ExpiryWarning[]) => void;
    onNotification?: (notification: ExpiryNotification) => void;
    onExpired?: () => void;
}

// ============================================================
// Expiry Monitor Class
// ============================================================

export class ShareExpiryMonitor {
    private guardianManager: GuardianManager;
    private checkInterval: number | null = null;
    private lastCheck: number = 0;
    private notifications: ExpiryNotification[] = [];
    private callbacks: MonitorCallbacks;
    private notificationsSent: Set<string> = new Set();

    constructor(callbacks: MonitorCallbacks = {}) {
        this.guardianManager = getGuardianManager();
        this.callbacks = callbacks;
    }

    /**
     * Start monitoring for share expiry.
     * Checks daily by default.
     */
    start(checkIntervalMs: number = 24 * 60 * 60 * 1000): void {
        if (this.checkInterval) {
            this.stop();
        }

        // Initial check
        this.checkExpiry();

        // Schedule periodic checks
        this.checkInterval = window.setInterval(() => {
            this.checkExpiry();
        }, checkIntervalMs);

        logger.info('Share expiry monitor started', { intervalMs: checkIntervalMs });
    }

    /**
     * Stop monitoring.
     */
    stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        logger.info('Share expiry monitor stopped');
    }

    /**
     * Check for expiring shares and generate notifications.
     */
    checkExpiry(): ExpiryCheckResult {
        const result = this.guardianManager.checkShareExpiry();
        this.lastCheck = Date.now();

        if (result.warnings.length === 0) {
            return result;
        }

        // Process warnings and generate notifications
        for (const warning of result.warnings) {
            this.processWarning(warning);
        }

        // Trigger callbacks
        if (result.warnings.length > 0) {
            this.callbacks.onWarning?.(result.warnings);
        }

        if (result.hasExpiredShares) {
            this.callbacks.onExpired?.();
        }

        logger.info('Share expiry check completed', {
            expired: result.expiredCount,
            warnings: result.warningCount
        });

        return result;
    }

    /**
     * Process a warning and create appropriate notifications.
     */
    private processWarning(warning: ExpiryWarning): void {
        const notificationKey = `${warning.guardianId}-${warning.severity}-${Math.floor(warning.daysRemaining / 7)}`;

        // Skip if we've already sent this notification recently
        if (this.notificationsSent.has(notificationKey)) {
            return;
        }

        let notification: ExpiryNotification;

        if (warning.daysRemaining <= 0) {
            // Expired
            notification = this.createExpiredNotification(warning);
        } else if (warning.daysRemaining <= RECOVERY_CONSTANTS.SHARE_EXPIRY_URGENT_DAYS) {
            // Urgent (1-7 days)
            notification = this.createUrgentNotification(warning);
        } else if (warning.daysRemaining <= RECOVERY_CONSTANTS.SHARE_EXPIRY_WARNING_DAYS) {
            // Warning (8-30 days)
            notification = this.createWarningNotification(warning);
        } else {
            return;  // No notification needed
        }

        this.notifications.push(notification);
        this.notificationsSent.add(notificationKey);
        this.callbacks.onNotification?.(notification);
    }

    /**
     * Create notification for expired shares.
     */
    private createExpiredNotification(warning: ExpiryWarning): ExpiryNotification {
        return {
            id: `expiry-${warning.guardianId}-${Date.now()}`,
            type: 'banner',
            severity: 'urgent',
            title: 'Recovery Shares Expired',
            message: `Your recovery shares have expired. Your account recovery is no longer protected. Please regenerate shares immediately.`,
            action: '/settings/recovery',
            actionLabel: 'Regenerate Shares',
            dismissable: false,
            createdAt: Date.now()
        };
    }

    /**
     * Create urgent notification (1-7 days remaining).
     */
    private createUrgentNotification(warning: ExpiryWarning): ExpiryNotification {
        const days = warning.daysRemaining;
        return {
            id: `expiry-${warning.guardianId}-${Date.now()}`,
            type: 'banner',
            severity: 'urgent',
            title: 'Recovery Shares Expiring Soon',
            message: `Your recovery shares will expire in ${days} day${days !== 1 ? 's' : ''}. Regenerate them now to maintain account recovery protection.`,
            action: '/settings/recovery',
            actionLabel: 'Regenerate Now',
            dismissable: true,
            createdAt: Date.now(),
            expiresAt: warning.expiresAt
        };
    }

    /**
     * Create warning notification (8-30 days remaining).
     */
    private createWarningNotification(warning: ExpiryWarning): ExpiryNotification {
        const days = warning.daysRemaining;
        return {
            id: `expiry-${warning.guardianId}-${Date.now()}`,
            type: 'dashboard',
            severity: 'warning',
            title: 'Recovery Shares Expiring',
            message: `Your recovery shares will expire in ${days} days. Consider regenerating them soon.`,
            action: '/settings/recovery',
            actionLabel: 'Review',
            dismissable: true,
            createdAt: Date.now(),
            expiresAt: warning.expiresAt
        };
    }

    /**
     * Get all active notifications.
     */
    getNotifications(): ExpiryNotification[] {
        return this.notifications.filter(n => !n.dismissed);
    }

    /**
     * Dismiss a notification.
     */
    dismissNotification(notificationId: string): void {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification && notification.dismissable) {
            notification.dismissed = true;
        }
    }

    /**
     * Clear all notifications.
     */
    clearNotifications(): void {
        this.notifications = [];
        this.notificationsSent.clear();
    }

    /**
     * Get last check timestamp.
     */
    getLastCheckTime(): number {
        return this.lastCheck;
    }

    /**
     * Check if monitoring is active.
     */
    isRunning(): boolean {
        return this.checkInterval !== null;
    }
}

// ============================================================
// Notification Display Helpers
// ============================================================

/**
 * Get notification priority for sorting.
 */
export function getNotificationPriority(notification: ExpiryNotification): number {
    switch (notification.severity) {
        case 'urgent': return 3;
        case 'warning': return 2;
        case 'info': return 1;
        default: return 0;
    }
}

/**
 * Sort notifications by priority.
 */
export function sortNotificationsByPriority(notifications: ExpiryNotification[]): ExpiryNotification[] {
    return [...notifications].sort((a, b) => {
        const priorityDiff = getNotificationPriority(b) - getNotificationPriority(a);
        if (priorityDiff !== 0) return priorityDiff;
        return b.createdAt - a.createdAt;
    });
}

/**
 * Filter notifications by type.
 */
export function filterNotificationsByType(
    notifications: ExpiryNotification[],
    type: ExpiryNotification['type']
): ExpiryNotification[] {
    return notifications.filter(n => n.type === type && !n.dismissed);
}

// ============================================================
// Singleton Instance
// ============================================================

let monitorInstance: ShareExpiryMonitor | null = null;

export function getExpiryMonitor(callbacks?: MonitorCallbacks): ShareExpiryMonitor {
    if (!monitorInstance) {
        monitorInstance = new ShareExpiryMonitor(callbacks);
    }
    return monitorInstance;
}

export function startExpiryMonitor(callbacks?: MonitorCallbacks): ShareExpiryMonitor {
    const monitor = getExpiryMonitor(callbacks);
    monitor.start();
    return monitor;
}

export function stopExpiryMonitor(): void {
    if (monitorInstance) {
        monitorInstance.stop();
    }
}

export function resetExpiryMonitor(): void {
    stopExpiryMonitor();
    monitorInstance = null;
}
