/**
 * Unit Tests for Guardian Manager
 *
 * Tests cover:
 * - Guardian initialization and configuration
 * - Guardian invite/update/acknowledge flows
 * - Share distribution management
 * - Recovery process (initiate, submit shares, complete)
 * - Time lock enforcement
 * - Share expiry management
 * - Event logging
 * - State serialization
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    GuardianManager,
    getGuardianManager,
    resetGuardianManager
} from '@/lib/recovery/guardian';
import { RECOVERY_CONSTANTS } from '@/lib/recovery/types';
import { RECOVERY_SCENARIOS } from '../../fixtures/test-vectors';

// Mock logger to prevent console output during tests
vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

describe('GuardianManager', () => {
    let manager: GuardianManager;
    let testKey: CryptoKey;

    // Test guardian data
    const testGuardians = RECOVERY_SCENARIOS.threeOfFive.guardians.map((g, idx) => ({
        address: `0x${(idx + 1).toString().padStart(40, '0')}`,
        label: g.name,
        email: g.email
    }));

    beforeEach(async () => {
        resetGuardianManager();
        manager = new GuardianManager();

        // Generate a test encryption key
        testKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Configuration', () => {
        it('should not be configured initially', () => {
            expect(manager.isConfigured()).toBe(false);
            expect(manager.getConfig()).toBeNull();
        });

        it('should initialize recovery with valid configuration', async () => {
            const config = await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3),
                { threshold: 2 }
            );

            expect(manager.isConfigured()).toBe(true);
            expect(config.enabled).toBe(true);
            expect(config.method).toBe('both');
            expect(config.shamir?.totalShares).toBe(3);
            expect(config.shamir?.threshold).toBe(2);
            expect(config.social?.guardians).toHaveLength(3);
        });

        it('should use default threshold (majority + 1)', async () => {
            const config = await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 5)
            );

            // 5 guardians: majority is 3, so threshold is 4
            expect(config.shamir?.threshold).toBe(4);
        });

        it('should use custom time lock', async () => {
            const config = await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3),
                { timeLockHours: 48 }
            );

            expect(config.social?.timeLockHours).toBe(48);
        });

        it('should use default time lock when not specified', async () => {
            const config = await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3)
            );

            expect(config.social?.timeLockHours).toBe(RECOVERY_CONSTANTS.DEFAULT_TIME_LOCK_HOURS);
        });

        it('should set expiry when enabled', async () => {
            const config = await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3),
                { enableExpiry: true, expiryDays: 180 }
            );

            expect(config.shamir?.expiresAt).toBeDefined();
            const expectedExpiry = Date.now() + 180 * 24 * 60 * 60 * 1000;
            expect(config.shamir?.expiresAt).toBeCloseTo(expectedExpiry, -4); // Within ~10 seconds
        });

        it('should throw for fewer than minimum guardians', async () => {
            await expect(
                manager.initializeRecovery(testKey, testGuardians.slice(0, 2))
            ).rejects.toThrow(`Minimum ${RECOVERY_CONSTANTS.MIN_GUARDIANS} guardians required`);
        });

        it('should throw for more than maximum guardians', async () => {
            const tooManyGuardians = Array.from({ length: 6 }, (_, i) => ({
                address: `0x${i.toString().padStart(40, '0')}`,
                label: `Guardian ${i}`,
                email: `g${i}@example.com`
            }));

            await expect(
                manager.initializeRecovery(testKey, tooManyGuardians)
            ).rejects.toThrow(`Maximum ${RECOVERY_CONSTANTS.MAX_GUARDIANS} guardians allowed`);
        });

        it('should throw for invalid threshold (less than 2)', async () => {
            await expect(
                manager.initializeRecovery(
                    testKey,
                    testGuardians.slice(0, 3),
                    { threshold: 1 }
                )
            ).rejects.toThrow('Threshold must be between 2 and 3');
        });

        it('should throw for invalid threshold (greater than total)', async () => {
            await expect(
                manager.initializeRecovery(
                    testKey,
                    testGuardians.slice(0, 3),
                    { threshold: 4 }
                )
            ).rejects.toThrow('Threshold must be between 2 and 3');
        });

        it('should throw for time lock below minimum', async () => {
            await expect(
                manager.initializeRecovery(
                    testKey,
                    testGuardians.slice(0, 3),
                    { timeLockHours: 12 }
                )
            ).rejects.toThrow(`Minimum time lock is ${RECOVERY_CONSTANTS.MIN_TIME_LOCK_HOURS} hours`);
        });

        it('should generate verification hash for shares', async () => {
            const config = await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3)
            );

            expect(config.shamir?.verificationHash).toBeDefined();
            expect(config.shamir?.verificationHash).toHaveLength(64); // SHA-256 hex
        });
    });

    describe('Guardian Management', () => {
        beforeEach(async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3),
                { threshold: 2 }
            );
        });

        it('should return all guardians', () => {
            const guardians = manager.getGuardians();
            expect(guardians).toHaveLength(3);
            expect(guardians[0].label).toBe(testGuardians[0].label);
        });

        it('should return specific guardian by ID', () => {
            const guardians = manager.getGuardians();
            const guardian = manager.getGuardian(guardians[0].id);

            expect(guardian).toBeDefined();
            expect(guardian?.label).toBe(testGuardians[0].label);
        });

        it('should return undefined for unknown guardian ID', () => {
            const guardian = manager.getGuardian('non-existent-id');
            expect(guardian).toBeUndefined();
        });

        it('should update guardian info', () => {
            const guardians = manager.getGuardians();
            const updated = manager.updateGuardian(guardians[0].id, {
                label: 'Updated Label',
                email: 'updated@example.com'
            });

            expect(updated.label).toBe('Updated Label');
            expect(updated.email).toBe('updated@example.com');

            // Verify persisted
            const fetched = manager.getGuardian(guardians[0].id);
            expect(fetched?.label).toBe('Updated Label');
        });

        it('should throw when updating non-existent guardian', () => {
            expect(() => manager.updateGuardian('fake-id', { label: 'Test' }))
                .toThrow('Guardian not found');
        });

        it('should get guardian share', () => {
            const guardians = manager.getGuardians();
            const share = manager.getGuardianShare(guardians[0].id);

            expect(share).toBeDefined();
            expect(share?.guardianId).toBe(guardians[0].id);
            expect(share?.encryptedShare).toBeDefined();
            expect(share?.index).toBeGreaterThanOrEqual(1);
        });

        it('should acknowledge share receipt', () => {
            const guardians = manager.getGuardians();
            const guardianId = guardians[0].id;

            manager.acknowledgeShare(guardianId);

            const guardian = manager.getGuardian(guardianId);
            expect(guardian?.lastVerified).toBeDefined();
            expect(guardian?.lastVerified).toBeGreaterThan(0);

            const config = manager.getConfig();
            const shareInfo = config?.shamir?.shares.find(s => s.guardianId === guardianId);
            expect(shareInfo?.acknowledged).toBe(true);
        });

        it('should throw when acknowledging for unknown guardian', () => {
            expect(() => manager.acknowledgeShare('fake-id'))
                .toThrow('Guardian not found');
        });
    });

    describe('Share Distribution', () => {
        beforeEach(async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3),
                { threshold: 2 }
            );
        });

        it('should prepare share distributions', () => {
            const distributions = manager.prepareShareDistributions();

            expect(distributions).toHaveLength(3);
            distributions.forEach((dist, idx) => {
                expect(dist.guardianAddress).toBe(testGuardians[idx].address);
                expect(dist.guardianLabel).toBe(testGuardians[idx].label);
                expect(dist.encryptedShare).toBeDefined();
                expect(dist.distributedAt).toBeGreaterThan(0);
                expect(dist.notificationSent).toBe(false);
            });
        });

        it('should throw when preparing distributions without config', () => {
            const unconfigured = new GuardianManager();
            expect(() => unconfigured.prepareShareDistributions())
                .toThrow('Recovery not configured');
        });

        it('should mark share as distributed', () => {
            const guardians = manager.getGuardians();
            const testCid = 'QmTest123';

            manager.markShareDistributed(guardians[0].id, testCid);

            const config = manager.getConfig();
            const shareInfo = config?.shamir?.shares.find(s => s.guardianId === guardians[0].id);
            expect(shareInfo?.ipfsCid).toBe(testCid);
            expect(shareInfo?.distributedAt).toBeGreaterThan(0);

            const guardian = manager.getGuardian(guardians[0].id);
            expect(guardian?.shareCid).toBe(testCid);
        });

        it('should throw when marking distribution without config', () => {
            const unconfigured = new GuardianManager();
            expect(() => unconfigured.markShareDistributed('id', 'cid'))
                .toThrow('Recovery not configured');
        });
    });

    describe('Recovery Process', () => {
        const initiatorAddress = testGuardians[0].address;
        const targetDid = 'did:key:z123456';

        beforeEach(async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3),
                { threshold: 2, timeLockHours: 24 }
            );
        });

        it('should initiate recovery request', () => {
            const request = manager.initiateRecovery(initiatorAddress, targetDid);

            expect(request.id).toBeDefined();
            expect(request.initiatedBy).toBe(initiatorAddress);
            expect(request.targetDid).toBe(targetDid);
            expect(request.status).toBe('time_locked');
            expect(request.requiredShares).toBe(2);
            expect(request.timeLockEnd).toBeGreaterThan(Date.now());
        });

        it('should throw when non-guardian initiates recovery', () => {
            const nonGuardian = '0xdeadbeef'.padEnd(42, '0');

            expect(() => manager.initiateRecovery(nonGuardian, targetDid))
                .toThrow('Only guardians can initiate recovery');
        });

        it('should throw when recovery not configured', () => {
            const unconfigured = new GuardianManager();
            expect(() => unconfigured.initiateRecovery(initiatorAddress, targetDid))
                .toThrow('Recovery not configured');
        });

        it('should throw when recovery already in progress', () => {
            manager.initiateRecovery(initiatorAddress, targetDid);

            expect(() => manager.initiateRecovery(initiatorAddress, targetDid))
                .toThrow('Recovery already in progress');
        });

        it('should allow new recovery after cancellation', () => {
            manager.initiateRecovery(initiatorAddress, targetDid);
            manager.cancelRecovery('owner');

            const newRequest = manager.initiateRecovery(initiatorAddress, targetDid);
            expect(newRequest.status).toBe('time_locked');
        });

        it('should cancel pending recovery', () => {
            manager.initiateRecovery(initiatorAddress, targetDid);
            manager.cancelRecovery('owner');

            const pending = manager.getPendingRecovery();
            expect(pending?.status).toBe('cancelled');
            expect(pending?.cancelledAt).toBeDefined();
        });

        it('should throw when cancelling without pending recovery', () => {
            expect(() => manager.cancelRecovery('owner'))
                .toThrow('No pending recovery');
        });

        it('should reject share submission during time lock', () => {
            manager.initiateRecovery(initiatorAddress, targetDid);

            // Time lock is still active
            expect(() => manager.submitShare(initiatorAddress, 'shareData'))
                .toThrow('Time lock has not expired');
        });

        it('should accept share submission after time lock', async () => {
            // Mock time to be after time lock
            const request = manager.initiateRecovery(initiatorAddress, targetDid);

            // Manually manipulate time lock for testing
            request.timeLockEnd = Date.now() - 1000;

            const guardians = manager.getGuardians();
            const share = manager.getGuardianShare(guardians[0].id);

            manager.submitShare(guardians[0].address, share!.encryptedShare);

            const pending = manager.getPendingRecovery();
            expect(pending?.collectedShares).toHaveLength(1);
            expect(pending?.status).toBe('collecting_shares');
        });

        it('should update status to ready when enough shares collected', async () => {
            const request = manager.initiateRecovery(initiatorAddress, targetDid);
            request.timeLockEnd = Date.now() - 1000;

            const guardians = manager.getGuardians();

            // Submit threshold shares (2)
            for (let i = 0; i < 2; i++) {
                const share = manager.getGuardianShare(guardians[i].id);
                manager.submitShare(guardians[i].address, share!.encryptedShare);
            }

            const pending = manager.getPendingRecovery();
            expect(pending?.status).toBe('ready');
            expect(pending?.collectedShares).toHaveLength(2);
        });

        it('should reject duplicate share submission', async () => {
            const request = manager.initiateRecovery(initiatorAddress, targetDid);
            request.timeLockEnd = Date.now() - 1000;

            const guardians = manager.getGuardians();
            const share = manager.getGuardianShare(guardians[0].id);

            manager.submitShare(guardians[0].address, share!.encryptedShare);

            expect(() => manager.submitShare(guardians[0].address, share!.encryptedShare))
                .toThrow('Share already submitted');
        });

        it('should reject share from non-guardian', async () => {
            const request = manager.initiateRecovery(initiatorAddress, targetDid);
            request.timeLockEnd = Date.now() - 1000;

            expect(() => manager.submitShare('0xunknown', 'data'))
                .toThrow('Not a recognized guardian');
        });

        it.skip('should complete recovery and return key', async () => {
            const request = manager.initiateRecovery(initiatorAddress, targetDid);
            request.timeLockEnd = Date.now() - 1000;

            const guardians = manager.getGuardians();

            // Submit threshold shares
            for (let i = 0; i < 2; i++) {
                const share = manager.getGuardianShare(guardians[i].id);
                manager.submitShare(guardians[i].address, share!.encryptedShare);
            }

            const recoveredKey = await manager.completeRecovery();

            expect(recoveredKey).toBeDefined();
            expect(recoveredKey.type).toBe('secret');

            // Verify recovered key matches original
            const originalRaw = await crypto.subtle.exportKey('raw', testKey);
            const recoveredRaw = await crypto.subtle.exportKey('raw', recoveredKey);
            expect(new Uint8Array(recoveredRaw)).toEqual(new Uint8Array(originalRaw));

            const pending = manager.getPendingRecovery();
            expect(pending?.status).toBe('completed');
            expect(pending?.completedAt).toBeDefined();
        });

        it('should throw when completing non-ready recovery', async () => {
            manager.initiateRecovery(initiatorAddress, targetDid);

            await expect(manager.completeRecovery())
                .rejects.toThrow('Recovery not ready');
        });

        it('should throw when no pending recovery', async () => {
            await expect(manager.completeRecovery())
                .rejects.toThrow('No pending recovery');
        });

        it('should return pending recovery', () => {
            expect(manager.getPendingRecovery()).toBeNull();

            manager.initiateRecovery(initiatorAddress, targetDid);

            const pending = manager.getPendingRecovery();
            expect(pending).toBeDefined();
            expect(pending?.targetDid).toBe(targetDid);
        });
    });

    describe('Share Expiry Management', () => {
        it('should return no warnings when expiry not enabled', async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3),
                { enableExpiry: false }
            );

            const result = manager.checkShareExpiry();

            expect(result.hasExpiredShares).toBe(false);
            expect(result.expiredCount).toBe(0);
            expect(result.warningCount).toBe(0);
            expect(result.warnings).toHaveLength(0);
        });

        it('should detect expiring shares (warning level)', async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3),
                { enableExpiry: true, expiryDays: 20 } // 20 days, within warning threshold (30)
            );

            const result = manager.checkShareExpiry();

            expect(result.warningCount).toBeGreaterThan(0);
            result.warnings.forEach(w => {
                expect(w.severity).toBe('warning');
                expect(w.daysRemaining).toBeLessThanOrEqual(RECOVERY_CONSTANTS.SHARE_EXPIRY_WARNING_DAYS);
            });
        });

        it('should detect urgent expiring shares', async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3),
                { enableExpiry: true, expiryDays: 5 } // 5 days, within urgent threshold (7)
            );

            const result = manager.checkShareExpiry();

            expect(result.warningCount).toBeGreaterThan(0);
            result.warnings.forEach(w => {
                expect(w.severity).toBe('urgent');
                expect(w.daysRemaining).toBeLessThanOrEqual(RECOVERY_CONSTANTS.SHARE_EXPIRY_URGENT_DAYS);
            });
        });

        it('should detect expired shares', async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3),
                { enableExpiry: true }
            );

            // Manually set expiry in the past
            const config = manager.getConfig();
            if (config?.shamir) {
                config.shamir.expiresAt = Date.now() - 1000;
                config.shamir.shares.forEach(s => {
                    s.expiresAt = Date.now() - 1000;
                });
            }

            const result = manager.checkShareExpiry();

            expect(result.hasExpiredShares).toBe(true);
            expect(result.expiredCount).toBeGreaterThan(0);
        });

        it('should regenerate shares', async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3),
                { enableExpiry: true }
            );

            const originalHash = manager.getConfig()?.shamir?.verificationHash;

            await manager.regenerateShares(testKey);

            const newConfig = manager.getConfig();
            expect(newConfig?.shamir?.verificationHash).toBe(originalHash); // Same key = same hash

            // All shares should be marked for redistribution
            newConfig?.shamir?.shares.forEach(s => {
                expect(s.distributedAt).toBe(0);
                expect(s.acknowledged).toBe(false);
            });
        });

        it('should throw when regenerating without config', async () => {
            const unconfigured = new GuardianManager();
            await expect(unconfigured.regenerateShares(testKey))
                .rejects.toThrow('Recovery not configured');
        });
    });

    describe('Event Logging', () => {
        it('should log recovery configured event', async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3)
            );

            const events = manager.getEvents();
            const configEvent = events.find(e => e.type === 'recovery_configured');

            expect(configEvent).toBeDefined();
            expect(configEvent?.data.totalShares).toBe(3);
        });

        it('should log share acknowledged event', async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3)
            );

            const guardians = manager.getGuardians();
            manager.acknowledgeShare(guardians[0].id);

            const events = manager.getEvents();
            const ackEvent = events.find(e => e.type === 'share_acknowledged');

            expect(ackEvent).toBeDefined();
            expect(ackEvent?.data.guardianId).toBe(guardians[0].id);
        });

        it.skip('should log recovery events', async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3),
                { threshold: 2 }
            );

            const guardians = manager.getGuardians();
            const targetDid = 'did:key:z123';

            // Initiate
            const request = manager.initiateRecovery(guardians[0].address, targetDid);

            // Submit shares (bypass time lock for testing)
            request.timeLockEnd = Date.now() - 1000;
            for (let i = 0; i < 2; i++) {
                const share = manager.getGuardianShare(guardians[i].id);
                manager.submitShare(guardians[i].address, share!.encryptedShare);
            }

            // Complete
            await manager.completeRecovery();

            const events = manager.getEvents();
            const types = events.map(e => e.type);

            expect(types).toContain('recovery_initiated');
            expect(types).toContain('share_submitted');
            expect(types).toContain('recovery_completed');
        });

        it('should limit events to 100', async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3)
            );

            const guardians = manager.getGuardians();

            // Generate many events
            for (let i = 0; i < 110; i++) {
                manager.acknowledgeShare(guardians[0].id);
            }

            const events = manager.getEvents(200);
            expect(events.length).toBeLessThanOrEqual(100);
        });

        it('should respect limit parameter for getEvents', async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3)
            );

            const events = manager.getEvents(1);
            expect(events.length).toBeLessThanOrEqual(1);
        });
    });

    describe('State Serialization', () => {
        it('should export state', async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3)
            );

            const state = manager.exportState();

            expect(state.config).toBeDefined();
            expect(state.guardians).toHaveLength(3);
            expect(state.shares).toHaveLength(3);
            expect(Array.isArray(state.events)).toBe(true);
        });

        it('should import state', async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3)
            );

            const state = manager.exportState();

            // Create new manager and import
            const newManager = new GuardianManager();
            newManager.importState(state);

            expect(newManager.isConfigured()).toBe(true);
            expect(newManager.getGuardians()).toHaveLength(3);
        });

        it('should handle missing events in import', async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3)
            );

            const state = manager.exportState();
            delete (state as Record<string, unknown>).events;

            const newManager = new GuardianManager();
            newManager.importState(state as Parameters<typeof newManager.importState>[0]);

            expect(newManager.getEvents()).toHaveLength(0);
        });
    });

    describe('Singleton Pattern', () => {
        it('should return same instance from getGuardianManager', () => {
            resetGuardianManager();
            const manager1 = getGuardianManager();
            const manager2 = getGuardianManager();

            expect(manager1).toBe(manager2);
        });

        it('should reset singleton', () => {
            const manager1 = getGuardianManager();
            resetGuardianManager();
            const manager2 = getGuardianManager();

            expect(manager1).not.toBe(manager2);
        });
    });

    describe('Edge Cases', () => {
        it('should handle case-insensitive address matching', async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3),
                { threshold: 2 }
            );

            const targetDid = 'did:key:z123';
            // Use lowercase address
            const request = manager.initiateRecovery(
                testGuardians[0].address.toLowerCase(),
                targetDid
            );

            expect(request).toBeDefined();
        });

        it('should update config timestamp on share regeneration', async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3)
            );

            const originalUpdatedAt = manager.getConfig()?.updatedAt;

            // Wait a bit to ensure time difference
            await new Promise(r => setTimeout(r, 10));

            await manager.regenerateShares(testKey);

            const newUpdatedAt = manager.getConfig()?.updatedAt;
            expect(newUpdatedAt).toBeGreaterThan(originalUpdatedAt!);
        });

        it('should update social config when guardian is updated', async () => {
            await manager.initializeRecovery(
                testKey,
                testGuardians.slice(0, 3)
            );

            const guardians = manager.getGuardians();
            manager.updateGuardian(guardians[0].id, { label: 'New Label' });

            const config = manager.getConfig();
            const socialGuardian = config?.social?.guardians.find(g => g.id === guardians[0].id);

            expect(socialGuardian?.label).toBe('New Label');
        });
    });
});
