/**
 * Guardian Manager
 *
 * Manages guardians for key recovery, including share distribution
 * and recovery request handling.
 */

import {
    Guardian,
    GuardianShare,
    RecoveryConfig,
    ShamirConfig,
    SocialRecoveryConfig,
    ShareInfo,
    ShareDistribution,
    RecoveryRequest,
    RecoveryStatus,
    CollectedShare,
    ExpiryCheckResult,
    ExpiryWarning,
    RecoveryEvent,
    RECOVERY_CONSTANTS,
    validateRecoveryConfig
} from './types';

import {
    splitSecret,
    combineShares,
    encodeShare,
    decodeShare,
    hashBytes,
    Share,
    splitEncryptionKey,
    reconstructEncryptionKey
} from './shamir';

import { logger } from '@/lib/logger';

// ============================================================
// Guardian Manager Class
// ============================================================

export class GuardianManager {
    private config: RecoveryConfig | null = null;
    private guardians: Map<string, Guardian> = new Map();
    private shares: Map<string, GuardianShare> = new Map();
    private pendingRecovery: RecoveryRequest | null = null;
    private events: RecoveryEvent[] = [];

    constructor() {}

    // ============================================================
    // Configuration
    // ============================================================

    /**
     * Initialize recovery configuration.
     */
    async initializeRecovery(
        encryptionKey: CryptoKey,
        guardians: Omit<Guardian, 'id' | 'addedAt' | 'shareIndex'>[],
        options: {
            threshold?: number;
            timeLockHours?: number;
            enableExpiry?: boolean;
            expiryDays?: number;
        } = {}
    ): Promise<RecoveryConfig> {
        // Validate guardian count
        if (guardians.length < RECOVERY_CONSTANTS.MIN_GUARDIANS) {
            throw new Error(`Minimum ${RECOVERY_CONSTANTS.MIN_GUARDIANS} guardians required`);
        }
        if (guardians.length > RECOVERY_CONSTANTS.MAX_GUARDIANS) {
            throw new Error(`Maximum ${RECOVERY_CONSTANTS.MAX_GUARDIANS} guardians allowed`);
        }

        const totalShares = guardians.length;
        const threshold = options.threshold ?? Math.ceil(totalShares / 2) + 1;  // Majority + 1
        const timeLockHours = options.timeLockHours ?? RECOVERY_CONSTANTS.DEFAULT_TIME_LOCK_HOURS;

        // Validate threshold
        if (threshold < 2 || threshold > totalShares) {
            throw new Error(`Threshold must be between 2 and ${totalShares}`);
        }

        // Validate time lock
        if (timeLockHours < RECOVERY_CONSTANTS.MIN_TIME_LOCK_HOURS) {
            throw new Error(`Minimum time lock is ${RECOVERY_CONSTANTS.MIN_TIME_LOCK_HOURS} hours`);
        }

        // Calculate expiry if enabled
        const expiresAt = options.enableExpiry
            ? Date.now() + (options.expiryDays ?? RECOVERY_CONSTANTS.DEFAULT_SHARE_EXPIRY_DAYS) * 24 * 60 * 60 * 1000
            : undefined;

        // Split the encryption key
        const { shares, verificationHash } = await splitEncryptionKey(encryptionKey, {
            totalShares,
            threshold
        });

        // Create guardian records with shares
        const guardianRecords: Guardian[] = [];
        const shareInfos: ShareInfo[] = [];

        for (let i = 0; i < guardians.length; i++) {
            const guardian: Guardian = {
                ...guardians[i],
                id: `guardian-${Date.now()}-${i}`,
                addedAt: Date.now(),
                shareIndex: shares[i].index
            };
            guardianRecords.push(guardian);
            this.guardians.set(guardian.id, guardian);

            // Create share info (CID will be set after IPFS upload)
            shareInfos.push({
                index: shares[i].index,
                guardianId: guardian.id,
                ipfsCid: '',  // Set after distribution
                distributedAt: 0,
                acknowledged: false,
                expiresAt
            });

            // Store the actual share data
            const encodedShare = encodeShare(shares[i]);
            this.shares.set(guardian.id, {
                guardianId: guardian.id,
                encryptedShare: encodedShare,  // TODO: Encrypt with guardian's public key
                index: shares[i].index,
                createdAt: Date.now(),
                expiresAt
            });
        }

        // Create config
        this.config = {
            enabled: true,
            method: 'both',
            shamir: {
                totalShares,
                threshold,
                verificationHash,
                shares: shareInfos,
                expiresAt
            },
            social: {
                guardians: guardianRecords,
                timeLockHours,
                requiredVotes: threshold
            },
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // Log event
        this.logEvent('recovery_configured', {
            totalShares,
            threshold,
            timeLockHours,
            hasExpiry: !!expiresAt
        });

        logger.info('Recovery initialized', {
            guardians: guardians.length,
            threshold,
            timeLockHours
        });

        return this.config;
    }

    /**
     * Get current recovery configuration.
     */
    getConfig(): RecoveryConfig | null {
        return this.config;
    }

    /**
     * Check if recovery is configured.
     */
    isConfigured(): boolean {
        return this.config !== null && this.config.enabled;
    }

    // ============================================================
    // Guardian Management
    // ============================================================

    /**
     * Get all guardians.
     */
    getGuardians(): Guardian[] {
        return Array.from(this.guardians.values());
    }

    /**
     * Get a specific guardian.
     */
    getGuardian(guardianId: string): Guardian | undefined {
        return this.guardians.get(guardianId);
    }

    /**
     * Update guardian info (label, email, etc.).
     */
    updateGuardian(guardianId: string, updates: Partial<Pick<Guardian, 'label' | 'email'>>): Guardian {
        const guardian = this.guardians.get(guardianId);
        if (!guardian) {
            throw new Error('Guardian not found');
        }

        const updated = { ...guardian, ...updates };
        this.guardians.set(guardianId, updated);

        if (this.config?.social) {
            const idx = this.config.social.guardians.findIndex(g => g.id === guardianId);
            if (idx >= 0) {
                this.config.social.guardians[idx] = updated;
            }
        }

        return updated;
    }

    /**
     * Get share for a guardian.
     */
    getGuardianShare(guardianId: string): GuardianShare | undefined {
        return this.shares.get(guardianId);
    }

    /**
     * Mark a share as acknowledged by the guardian.
     */
    acknowledgeShare(guardianId: string): void {
        const guardian = this.guardians.get(guardianId);
        if (!guardian) {
            throw new Error('Guardian not found');
        }

        guardian.lastVerified = Date.now();
        this.guardians.set(guardianId, guardian);

        if (this.config?.shamir) {
            const shareInfo = this.config.shamir.shares.find(s => s.guardianId === guardianId);
            if (shareInfo) {
                shareInfo.acknowledged = true;
            }
        }

        this.logEvent('share_acknowledged', { guardianId });
    }

    // ============================================================
    // Share Distribution
    // ============================================================

    /**
     * Prepare shares for distribution to guardians.
     */
    prepareShareDistributions(): ShareDistribution[] {
        if (!this.config?.shamir) {
            throw new Error('Recovery not configured');
        }

        const distributions: ShareDistribution[] = [];

        for (const guardian of this.guardians.values()) {
            const share = this.shares.get(guardian.id);
            if (!share) continue;

            distributions.push({
                guardianId: guardian.id,
                guardianAddress: guardian.address,
                guardianLabel: guardian.label,
                shareIndex: share.index,
                encryptedShare: share.encryptedShare,
                distributedAt: Date.now(),
                notificationSent: false
            });
        }

        return distributions;
    }

    /**
     * Mark a share as distributed (after IPFS upload).
     */
    markShareDistributed(guardianId: string, ipfsCid: string): void {
        if (!this.config?.shamir) {
            throw new Error('Recovery not configured');
        }

        const shareInfo = this.config.shamir.shares.find(s => s.guardianId === guardianId);
        if (shareInfo) {
            shareInfo.ipfsCid = ipfsCid;
            shareInfo.distributedAt = Date.now();
        }

        const guardian = this.guardians.get(guardianId);
        if (guardian) {
            guardian.shareCid = ipfsCid;
            this.guardians.set(guardianId, guardian);
        }

        this.logEvent('share_distributed', { guardianId, ipfsCid });
    }

    // ============================================================
    // Recovery Process
    // ============================================================

    /**
     * Initiate a recovery request.
     */
    initiateRecovery(initiatorAddress: string, targetDid: string): RecoveryRequest {
        if (!this.config) {
            throw new Error('Recovery not configured');
        }

        // Check if initiator is a guardian
        const isGuardian = Array.from(this.guardians.values())
            .some(g => g.address.toLowerCase() === initiatorAddress.toLowerCase());

        if (!isGuardian) {
            throw new Error('Only guardians can initiate recovery');
        }

        // Check if there's already a pending recovery
        if (this.pendingRecovery && this.pendingRecovery.status !== 'cancelled' && this.pendingRecovery.status !== 'completed') {
            throw new Error('Recovery already in progress');
        }

        const timeLockHours = this.config.social?.timeLockHours ?? RECOVERY_CONSTANTS.DEFAULT_TIME_LOCK_HOURS;

        this.pendingRecovery = {
            id: `recovery-${Date.now()}`,
            initiatedBy: initiatorAddress,
            initiatedAt: Date.now(),
            status: 'time_locked',
            timeLockEnd: Date.now() + timeLockHours * 60 * 60 * 1000,
            collectedShares: [],
            requiredShares: this.config.shamir?.threshold ?? 3,
            targetDid
        };

        this.logEvent('recovery_initiated', {
            recoveryId: this.pendingRecovery.id,
            initiator: initiatorAddress,
            targetDid,
            timeLockEnd: this.pendingRecovery.timeLockEnd
        });

        logger.info('Recovery initiated', {
            recoveryId: this.pendingRecovery.id,
            initiator: initiatorAddress,
            timeLockHours
        });

        return this.pendingRecovery;
    }

    /**
     * Cancel a pending recovery (only by original owner).
     */
    cancelRecovery(ownerAddress: string): void {
        if (!this.pendingRecovery) {
            throw new Error('No pending recovery');
        }

        // In a real implementation, verify the owner's signature
        this.pendingRecovery.status = 'cancelled';
        this.pendingRecovery.cancelledAt = Date.now();

        this.logEvent('recovery_cancelled', {
            recoveryId: this.pendingRecovery.id,
            cancelledBy: ownerAddress
        });

        logger.info('Recovery cancelled', {
            recoveryId: this.pendingRecovery.id
        });
    }

    /**
     * Submit a share for recovery.
     */
    submitShare(guardianAddress: string, shareData: string): void {
        if (!this.pendingRecovery) {
            throw new Error('No pending recovery');
        }

        // Check if time lock has passed
        if (Date.now() < this.pendingRecovery.timeLockEnd) {
            throw new Error('Time lock has not expired');
        }

        // Find the guardian
        const guardian = Array.from(this.guardians.values())
            .find(g => g.address.toLowerCase() === guardianAddress.toLowerCase());

        if (!guardian) {
            throw new Error('Not a recognized guardian');
        }

        // Check if already submitted
        const existing = this.pendingRecovery.collectedShares
            .find(s => s.guardianAddress.toLowerCase() === guardianAddress.toLowerCase());

        if (existing) {
            throw new Error('Share already submitted');
        }

        // Add the share
        this.pendingRecovery.collectedShares.push({
            guardianId: guardian.id,
            guardianAddress: guardian.address,
            submittedAt: Date.now(),
            shareData,
            verified: false
        });

        // Update status
        if (this.pendingRecovery.collectedShares.length >= this.pendingRecovery.requiredShares) {
            this.pendingRecovery.status = 'ready';
        } else {
            this.pendingRecovery.status = 'collecting_shares';
        }

        this.logEvent('share_submitted', {
            recoveryId: this.pendingRecovery.id,
            guardianId: guardian.id,
            sharesCollected: this.pendingRecovery.collectedShares.length,
            sharesRequired: this.pendingRecovery.requiredShares
        });

        logger.info('Share submitted', {
            recoveryId: this.pendingRecovery.id,
            guardian: guardian.label,
            collected: this.pendingRecovery.collectedShares.length,
            required: this.pendingRecovery.requiredShares
        });
    }

    /**
     * Complete the recovery process and reconstruct the key.
     */
    async completeRecovery(): Promise<CryptoKey> {
        if (!this.pendingRecovery) {
            throw new Error('No pending recovery');
        }

        if (this.pendingRecovery.status !== 'ready') {
            throw new Error('Recovery not ready');
        }

        if (this.pendingRecovery.collectedShares.length < this.pendingRecovery.requiredShares) {
            throw new Error('Not enough shares collected');
        }

        // Decode shares
        const shares: Share[] = this.pendingRecovery.collectedShares
            .filter(s => s.shareData)
            .map(s => decodeShare(s.shareData!));

        // Reconstruct the key
        const verificationHash = this.config?.shamir?.verificationHash;
        const key = await reconstructEncryptionKey(shares, verificationHash);

        // Mark as completed
        this.pendingRecovery.status = 'completed';
        this.pendingRecovery.completedAt = Date.now();

        this.logEvent('recovery_completed', {
            recoveryId: this.pendingRecovery.id,
            sharesUsed: shares.length
        });

        logger.info('Recovery completed', {
            recoveryId: this.pendingRecovery.id
        });

        return key;
    }

    /**
     * Get the pending recovery request.
     */
    getPendingRecovery(): RecoveryRequest | null {
        return this.pendingRecovery;
    }

    // ============================================================
    // Share Expiry Management
    // ============================================================

    /**
     * Check for expiring or expired shares.
     */
    checkShareExpiry(): ExpiryCheckResult {
        if (!this.config?.shamir?.expiresAt) {
            return {
                hasExpiredShares: false,
                expiredCount: 0,
                warningCount: 0,
                warnings: []
            };
        }

        const now = Date.now();
        const expiresAt = this.config.shamir.expiresAt;
        const daysRemaining = Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000));

        const warnings: ExpiryWarning[] = [];
        let hasExpiredShares = false;

        if (daysRemaining <= 0) {
            hasExpiredShares = true;
        }

        // Check each share
        for (const shareInfo of this.config.shamir.shares) {
            const shareExpiry = shareInfo.expiresAt ?? expiresAt;
            const shareDaysRemaining = Math.ceil((shareExpiry - now) / (24 * 60 * 60 * 1000));

            let severity: 'info' | 'warning' | 'urgent' = 'info';
            if (shareDaysRemaining <= 0) {
                hasExpiredShares = true;
                severity = 'urgent';
            } else if (shareDaysRemaining <= RECOVERY_CONSTANTS.SHARE_EXPIRY_URGENT_DAYS) {
                severity = 'urgent';
            } else if (shareDaysRemaining <= RECOVERY_CONSTANTS.SHARE_EXPIRY_WARNING_DAYS) {
                severity = 'warning';
            } else {
                continue;  // No warning needed
            }

            warnings.push({
                type: 'share_expiry',
                shareIndex: shareInfo.index,
                guardianId: shareInfo.guardianId,
                expiresAt: shareExpiry,
                daysRemaining: shareDaysRemaining,
                severity
            });
        }

        return {
            hasExpiredShares,
            expiredCount: warnings.filter(w => w.daysRemaining <= 0).length,
            warningCount: warnings.length,
            warnings
        };
    }

    /**
     * Regenerate shares (when shares are expiring).
     */
    async regenerateShares(encryptionKey: CryptoKey): Promise<void> {
        if (!this.config?.shamir) {
            throw new Error('Recovery not configured');
        }

        const { totalShares, threshold } = this.config.shamir;

        // Generate new shares
        const { shares, verificationHash } = await splitEncryptionKey(encryptionKey, {
            totalShares,
            threshold
        });

        // Update share info
        const now = Date.now();
        const newExpiresAt = this.config.shamir.expiresAt
            ? now + RECOVERY_CONSTANTS.DEFAULT_SHARE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
            : undefined;

        for (let i = 0; i < shares.length; i++) {
            const guardianId = this.config.shamir.shares[i].guardianId;

            // Update share info
            this.config.shamir.shares[i] = {
                ...this.config.shamir.shares[i],
                index: shares[i].index,
                distributedAt: 0,  // Needs redistribution
                acknowledged: false,
                expiresAt: newExpiresAt
            };

            // Update stored share
            const encodedShare = encodeShare(shares[i]);
            this.shares.set(guardianId, {
                guardianId,
                encryptedShare: encodedShare,
                index: shares[i].index,
                createdAt: now,
                expiresAt: newExpiresAt
            });

            // Update guardian
            const guardian = this.guardians.get(guardianId);
            if (guardian) {
                guardian.shareIndex = shares[i].index;
                guardian.shareCid = undefined;  // Needs re-upload
                this.guardians.set(guardianId, guardian);
            }
        }

        // Update config
        this.config.shamir.verificationHash = verificationHash;
        this.config.shamir.expiresAt = newExpiresAt;
        this.config.updatedAt = now;

        this.logEvent('shares_regenerated', {
            totalShares,
            threshold,
            newExpiresAt
        });

        logger.info('Shares regenerated', {
            totalShares,
            threshold,
            expiresAt: newExpiresAt
        });
    }

    // ============================================================
    // Events
    // ============================================================

    /**
     * Log a recovery event.
     */
    private logEvent(type: RecoveryEvent['type'], data: Record<string, unknown>): void {
        const event: RecoveryEvent = {
            id: `event-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            type,
            timestamp: Date.now(),
            data
        };
        this.events.push(event);

        // Keep only last 100 events
        if (this.events.length > 100) {
            this.events = this.events.slice(-100);
        }
    }

    /**
     * Get recovery events.
     */
    getEvents(limit: number = 50): RecoveryEvent[] {
        return this.events.slice(-limit);
    }

    // ============================================================
    // Serialization
    // ============================================================

    /**
     * Export state for storage.
     */
    exportState(): {
        config: RecoveryConfig | null;
        guardians: Guardian[];
        shares: GuardianShare[];
        events: RecoveryEvent[];
    } {
        return {
            config: this.config,
            guardians: Array.from(this.guardians.values()),
            shares: Array.from(this.shares.values()),
            events: this.events
        };
    }

    /**
     * Import state from storage.
     */
    importState(state: {
        config: RecoveryConfig | null;
        guardians: Guardian[];
        shares: GuardianShare[];
        events?: RecoveryEvent[];
    }): void {
        this.config = state.config;
        this.guardians = new Map(state.guardians.map(g => [g.id, g]));
        this.shares = new Map(state.shares.map(s => [s.guardianId, s]));
        this.events = state.events ?? [];
    }
}

// ============================================================
// Singleton Instance
// ============================================================

let guardianManagerInstance: GuardianManager | null = null;

export function getGuardianManager(): GuardianManager {
    if (!guardianManagerInstance) {
        guardianManagerInstance = new GuardianManager();
    }
    return guardianManagerInstance;
}

export function resetGuardianManager(): void {
    guardianManagerInstance = null;
}
