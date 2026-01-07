/**
 * Recovery Types
 *
 * Type definitions for the key recovery system.
 */

// ============================================================
// Guardian Types
// ============================================================

export interface Guardian {
    id: string;
    address: string;          // Ethereum address
    did?: string;             // Optional DID for non-wallet guardians
    label: string;            // Human-readable name (e.g., "Mom", "Best Friend")
    email?: string;           // Optional email for notifications
    addedAt: number;          // Timestamp when guardian was added
    shareCid?: string;        // IPFS CID of their encrypted share
    shareIndex?: number;      // Index of their share (1-255)
    lastVerified?: number;    // Last time guardian verified they have share
}

export interface GuardianShare {
    guardianId: string;
    encryptedShare: string;   // Base64 encoded, encrypted with guardian's public key
    index: number;            // Share index (1-255)
    createdAt: number;
    expiresAt?: number;       // Optional expiry timestamp
}

// ============================================================
// Recovery Configuration
// ============================================================

export interface RecoveryConfig {
    enabled: boolean;
    method: 'shamir' | 'social' | 'both';

    shamir?: ShamirConfig;
    social?: SocialRecoveryConfig;

    createdAt: number;
    updatedAt: number;
}

export interface ShamirConfig {
    totalShares: number;      // N: 3-5 per spec
    threshold: number;        // K: minimum shares needed
    verificationHash: string; // SHA-256 hash of the original key for verification
    shares: ShareInfo[];
    expiresAt?: number;       // Optional expiry timestamp
}

export interface ShareInfo {
    index: number;
    guardianId: string;
    ipfsCid: string;          // IPFS CID where encrypted share is stored
    distributedAt: number;
    acknowledged: boolean;    // Guardian confirmed receipt
    expiresAt?: number;
}

export interface SocialRecoveryConfig {
    guardians: Guardian[];
    timeLockHours: number;    // Minimum 24, default 72
    requiredVotes: number;    // Number of guardian votes needed
}

// ============================================================
// Recovery Request
// ============================================================

export type RecoveryStatus =
    | 'pending'
    | 'collecting_shares'
    | 'time_locked'
    | 'ready'
    | 'completed'
    | 'cancelled'
    | 'expired';

export interface RecoveryRequest {
    id: string;
    initiatedBy: string;      // Guardian address who initiated
    initiatedAt: number;
    status: RecoveryStatus;
    timeLockEnd: number;      // When time lock expires
    collectedShares: CollectedShare[];
    requiredShares: number;
    targetDid: string;        // DID being recovered
    cancelledAt?: number;
    completedAt?: number;
    newOwnerAddress?: string; // For social recovery
}

export interface CollectedShare {
    guardianId: string;
    guardianAddress: string;
    submittedAt: number;
    shareData?: string;       // Encrypted share data (only set after time lock)
    verified: boolean;
}

// ============================================================
// Share Distribution
// ============================================================

export interface ShareDistribution {
    guardianId: string;
    guardianAddress: string;
    guardianLabel: string;
    shareIndex: number;
    encryptedShare: string;   // Encrypted with guardian's public key
    ipfsCid?: string;         // Set after upload
    distributedAt: number;
    notificationSent: boolean;
}

// ============================================================
// Expiry Types
// ============================================================

export interface ExpiryWarning {
    type: 'share_expiry';
    shareIndex: number;
    guardianId: string;
    expiresAt: number;
    daysRemaining: number;
    severity: 'info' | 'warning' | 'urgent';
}

export interface ExpiryCheckResult {
    hasExpiredShares: boolean;
    expiredCount: number;
    warningCount: number;
    warnings: ExpiryWarning[];
}

// ============================================================
// Events
// ============================================================

export type RecoveryEventType =
    | 'recovery_configured'
    | 'guardian_added'
    | 'guardian_removed'
    | 'share_distributed'
    | 'share_acknowledged'
    | 'recovery_initiated'
    | 'share_submitted'
    | 'recovery_cancelled'
    | 'recovery_completed'
    | 'shares_regenerated';

export interface RecoveryEvent {
    id: string;
    type: RecoveryEventType;
    timestamp: number;
    data: Record<string, unknown>;
    actor?: string;           // Who triggered the event
}

// ============================================================
// Constants
// ============================================================

export const RECOVERY_CONSTANTS = {
    MIN_GUARDIANS: 3,
    MAX_GUARDIANS: 5,
    MIN_TIME_LOCK_HOURS: 24,
    DEFAULT_TIME_LOCK_HOURS: 72,
    SHARE_EXPIRY_WARNING_DAYS: 30,
    SHARE_EXPIRY_URGENT_DAYS: 7,
    DEFAULT_SHARE_EXPIRY_DAYS: 365,  // 1 year if expiry enabled
} as const;

// ============================================================
// Validation
// ============================================================

export function validateRecoveryConfig(config: Partial<RecoveryConfig>): string[] {
    const errors: string[] = [];

    if (config.shamir) {
        const { totalShares, threshold } = config.shamir;

        if (totalShares < RECOVERY_CONSTANTS.MIN_GUARDIANS) {
            errors.push(`Minimum ${RECOVERY_CONSTANTS.MIN_GUARDIANS} guardians required`);
        }
        if (totalShares > RECOVERY_CONSTANTS.MAX_GUARDIANS) {
            errors.push(`Maximum ${RECOVERY_CONSTANTS.MAX_GUARDIANS} guardians allowed`);
        }
        if (threshold < 2) {
            errors.push('Threshold must be at least 2');
        }
        if (threshold > totalShares) {
            errors.push('Threshold cannot exceed total shares');
        }
    }

    if (config.social) {
        const { timeLockHours, guardians } = config.social;

        if (timeLockHours < RECOVERY_CONSTANTS.MIN_TIME_LOCK_HOURS) {
            errors.push(`Minimum time lock is ${RECOVERY_CONSTANTS.MIN_TIME_LOCK_HOURS} hours`);
        }
        if (guardians.length < RECOVERY_CONSTANTS.MIN_GUARDIANS) {
            errors.push(`Minimum ${RECOVERY_CONSTANTS.MIN_GUARDIANS} guardians required`);
        }
        if (guardians.length > RECOVERY_CONSTANTS.MAX_GUARDIANS) {
            errors.push(`Maximum ${RECOVERY_CONSTANTS.MAX_GUARDIANS} guardians allowed`);
        }
    }

    return errors;
}
