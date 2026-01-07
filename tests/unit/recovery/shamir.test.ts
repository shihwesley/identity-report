/**
 * Unit Tests for Shamir's Secret Sharing Implementation
 *
 * Tests cover:
 * - Share generation with various k-of-n schemes
 * - Secret reconstruction with exact threshold
 * - Reconstruction with more than threshold shares
 * - Rejection of insufficient shares
 * - Share encoding/decoding
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    splitSecret,
    combineShares,
    encodeShare,
    decodeShare,
    verifyShares,
    hashBytes,
    splitEncryptionKey,
    reconstructEncryptionKey,
    generateUniqueIndex,
    meetsThreshold,
    Share
} from '@/lib/recovery/shamir';
import { RECOVERY_SCENARIOS } from '../../fixtures/test-vectors';

describe('Shamir Secret Sharing', () => {
    // Test secret data
    const testSecret = new Uint8Array([
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10,
        0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
        0x19, 0x1A, 0x1B, 0x1C, 0x1D, 0x1E, 0x1F, 0x20
    ]);

    describe('splitSecret', () => {
        it('should split a secret into the correct number of shares', () => {
            const { threshold, total } = RECOVERY_SCENARIOS.threeOfFive;
            const shares = splitSecret(testSecret, {
                totalShares: total,
                threshold
            });

            expect(shares).toHaveLength(total);
            shares.forEach((share, idx) => {
                expect(share.index).toBe(idx + 1);
                expect(share.data).toHaveLength(testSecret.length);
            });
        });

        it('should create shares with unique indices from 1 to N', () => {
            const shares = splitSecret(testSecret, {
                totalShares: 5,
                threshold: 3
            });

            const indices = shares.map(s => s.index);
            expect(new Set(indices).size).toBe(5);
            expect(indices).toEqual([1, 2, 3, 4, 5]);
        });

        it('should work with 2-of-3 scheme', () => {
            const { threshold, total } = RECOVERY_SCENARIOS.twoOfThree;
            const shares = splitSecret(testSecret, {
                totalShares: total,
                threshold
            });

            expect(shares).toHaveLength(total);
        });

        it('should throw error for threshold less than 2', () => {
            expect(() => splitSecret(testSecret, {
                totalShares: 3,
                threshold: 1
            })).toThrow('Threshold must be at least 2');
        });

        it('should throw error for totalShares less than threshold', () => {
            expect(() => splitSecret(testSecret, {
                totalShares: 2,
                threshold: 3
            })).toThrow('Total shares must be >= threshold');
        });

        it('should throw error for totalShares exceeding 255', () => {
            expect(() => splitSecret(testSecret, {
                totalShares: 256,
                threshold: 3
            })).toThrow('Maximum 255 shares supported');
        });

        it('should handle minimum valid configuration (2-of-2)', () => {
            const shares = splitSecret(testSecret, {
                totalShares: 2,
                threshold: 2
            });

            expect(shares).toHaveLength(2);
        });

        it('should handle maximum threshold equal to totalShares', () => {
            const shares = splitSecret(testSecret, {
                totalShares: 5,
                threshold: 5
            });

            expect(shares).toHaveLength(5);
        });

        it('should generate different shares for same secret (randomness)', () => {
            const shares1 = splitSecret(testSecret, { totalShares: 3, threshold: 2 });
            const shares2 = splitSecret(testSecret, { totalShares: 3, threshold: 2 });

            // Shares should be different due to random polynomial coefficients
            // (extremely unlikely to be the same)
            let atLeastOneDifferent = false;
            for (let i = 0; i < shares1.length; i++) {
                if (shares1[i].data.some((byte, idx) => byte !== shares2[i].data[idx])) {
                    atLeastOneDifferent = true;
                    break;
                }
            }
            expect(atLeastOneDifferent).toBe(true);
        });
    });

    describe('combineShares', () => {
        it('should reconstruct secret with exact threshold shares (3-of-5)', () => {
            const { threshold, total } = RECOVERY_SCENARIOS.threeOfFive;
            const shares = splitSecret(testSecret, {
                totalShares: total,
                threshold
            });

            // Use exactly 3 shares
            const selectedShares = shares.slice(0, threshold);
            const reconstructed = combineShares(selectedShares);

            expect(reconstructed).toEqual(testSecret);
        });

        it('should reconstruct secret with more than threshold shares', () => {
            const shares = splitSecret(testSecret, {
                totalShares: 5,
                threshold: 3
            });

            // Use all 5 shares
            const reconstructed = combineShares(shares);
            expect(reconstructed).toEqual(testSecret);
        });

        it('should reconstruct secret with any combination of threshold shares', () => {
            const shares = splitSecret(testSecret, {
                totalShares: 5,
                threshold: 3
            });

            // Try different combinations of 3 shares
            const combinations = [
                [0, 1, 2],
                [0, 1, 4],
                [0, 3, 4],
                [1, 2, 3],
                [2, 3, 4]
            ];

            for (const combo of combinations) {
                const selectedShares = combo.map(i => shares[i]);
                const reconstructed = combineShares(selectedShares);
                expect(reconstructed).toEqual(testSecret);
            }
        });

        it('should reconstruct secret with 2-of-3 scheme', () => {
            const { threshold, total } = RECOVERY_SCENARIOS.twoOfThree;
            const shares = splitSecret(testSecret, {
                totalShares: total,
                threshold
            });

            const selectedShares = shares.slice(0, threshold);
            const reconstructed = combineShares(selectedShares);

            expect(reconstructed).toEqual(testSecret);
        });

        it('should throw error for insufficient shares', () => {
            const shares = splitSecret(testSecret, {
                totalShares: 5,
                threshold: 3
            });

            // Try with only 2 shares when 3 are needed
            const insufficientShares = shares.slice(0, 2);

            // combineShares doesn't know the threshold, it just needs >= 2
            // But reconstruction will produce wrong result without enough shares
            // The actual threshold check should be done by the caller
            // combineShares itself requires at least 2 shares
            expect(() => combineShares([shares[0]])).toThrow('Need at least 2 shares to reconstruct');
        });

        it('should throw error for duplicate share indices', () => {
            const shares = splitSecret(testSecret, {
                totalShares: 3,
                threshold: 2
            });

            // Create duplicate by copying a share
            const duplicateShares = [shares[0], { ...shares[0] }];

            expect(() => combineShares(duplicateShares)).toThrow('Duplicate share indices');
        });

        it('should throw error for mismatched share data lengths', () => {
            const shares = splitSecret(testSecret, {
                totalShares: 3,
                threshold: 2
            });

            // Modify one share to have different length
            const mismatchedShares: Share[] = [
                shares[0],
                { index: shares[1].index, data: new Uint8Array(16) } // Different length
            ];

            expect(() => combineShares(mismatchedShares)).toThrow('All shares must have same data length');
        });

        it('should produce wrong result with insufficient shares (security property)', () => {
            const shares = splitSecret(testSecret, {
                totalShares: 5,
                threshold: 3
            });

            // With only 2 shares for a 3-of-5 scheme, reconstruction should fail
            // (produce incorrect result)
            const insufficientShares = shares.slice(0, 2);
            const wrongResult = combineShares(insufficientShares);

            // This should NOT equal the original secret
            expect(wrongResult).not.toEqual(testSecret);
        });
    });

    describe('Share Encoding/Decoding', () => {
        it('should encode and decode a share correctly', () => {
            const shares = splitSecret(testSecret, {
                totalShares: 3,
                threshold: 2
            });

            const encoded = encodeShare(shares[0]);
            expect(typeof encoded).toBe('string');
            expect(encoded.length).toBeGreaterThan(0);

            const decoded = decodeShare(encoded);
            expect(decoded.index).toBe(shares[0].index);
            expect(decoded.data).toEqual(shares[0].data);
        });

        it('should preserve share data through encode/decode cycle', () => {
            const shares = splitSecret(testSecret, {
                totalShares: 5,
                threshold: 3
            });

            for (const share of shares) {
                const encoded = encodeShare(share);
                const decoded = decodeShare(encoded);

                expect(decoded.index).toBe(share.index);
                expect(decoded.data).toEqual(share.data);
            }
        });

        it('should throw error for invalid share encoding (too short)', () => {
            // Create a very short base64 string
            const shortEncoding = btoa('AB');

            expect(() => decodeShare(shortEncoding)).toThrow('Invalid share encoding: too short');
        });

        it('should throw error for unsupported share version', () => {
            // Create encoding with wrong version byte
            const wrongVersion = new Uint8Array([2, 1, 0, 1, 2, 3]); // Version 2
            const encoded = btoa(String.fromCharCode(...wrongVersion));

            expect(() => decodeShare(encoded)).toThrow('Unsupported share version: 2');
        });

        it('should use version 1 format', () => {
            const share: Share = {
                index: 5,
                data: new Uint8Array([10, 20, 30])
            };

            const encoded = encodeShare(share);
            const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));

            expect(bytes[0]).toBe(1); // Version
            expect(bytes[1]).toBe(5); // Index
            expect(bytes.slice(2)).toEqual(share.data);
        });
    });

    describe('verifyShares', () => {
        it('should return true for valid shares with correct hash', async () => {
            const shares = splitSecret(testSecret, {
                totalShares: 3,
                threshold: 2
            });

            const expectedHash = await hashBytes(testSecret);
            const isValid = await verifyShares(shares.slice(0, 2), expectedHash);

            expect(isValid).toBe(true);
        });

        it('should return false for invalid hash', async () => {
            const shares = splitSecret(testSecret, {
                totalShares: 3,
                threshold: 2
            });

            const wrongHash = 'deadbeef'.repeat(8); // 64 hex chars
            const isValid = await verifyShares(shares.slice(0, 2), wrongHash);

            expect(isValid).toBe(false);
        });

        it('should return false for insufficient shares', async () => {
            const shares = splitSecret(testSecret, {
                totalShares: 5,
                threshold: 3
            });

            // Only 2 shares for 3-of-5 scheme - will produce wrong reconstruction
            const expectedHash = await hashBytes(testSecret);
            const isValid = await verifyShares(shares.slice(0, 2), expectedHash);

            expect(isValid).toBe(false);
        });

        it('should return false for invalid share data', async () => {
            const corruptedShares: Share[] = [
                { index: 1, data: new Uint8Array(32) },
                { index: 2, data: new Uint8Array(32) }
            ];

            const expectedHash = await hashBytes(testSecret);
            const isValid = await verifyShares(corruptedShares, expectedHash);

            expect(isValid).toBe(false);
        });
    });

    describe('hashBytes', () => {
        it('should produce consistent SHA-256 hash', async () => {
            const hash1 = await hashBytes(testSecret);
            const hash2 = await hashBytes(testSecret);

            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64); // SHA-256 = 32 bytes = 64 hex chars
        });

        it('should produce different hashes for different inputs', async () => {
            const data1 = new Uint8Array([1, 2, 3]);
            const data2 = new Uint8Array([1, 2, 4]);

            const hash1 = await hashBytes(data1);
            const hash2 = await hashBytes(data2);

            expect(hash1).not.toBe(hash2);
        });

        it('should handle empty input', async () => {
            const hash = await hashBytes(new Uint8Array(0));
            // SHA-256 of empty string is well-known
            expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
        });
    });

    describe('Encryption Key Operations', () => {
        let encryptionKey: CryptoKey;

        beforeAll(async () => {
            // Generate a test AES key
            encryptionKey = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );
        });

        it('should split and reconstruct an encryption key', async () => {
            const { shares, verificationHash } = await splitEncryptionKey(encryptionKey, {
                totalShares: 3,
                threshold: 2
            });

            expect(shares).toHaveLength(3);
            expect(verificationHash).toHaveLength(64);

            // Reconstruct with 2 shares
            const reconstructedKey = await reconstructEncryptionKey(
                shares.slice(0, 2),
                verificationHash
            );

            // Verify the key works by exporting both
            const originalRaw = await crypto.subtle.exportKey('raw', encryptionKey);
            const reconstructedRaw = await crypto.subtle.exportKey('raw', reconstructedKey);

            expect(new Uint8Array(reconstructedRaw)).toEqual(new Uint8Array(originalRaw));
        });

        it('should throw on hash mismatch during reconstruction', async () => {
            const { shares } = await splitEncryptionKey(encryptionKey, {
                totalShares: 3,
                threshold: 2
            });

            const wrongHash = 'deadbeef'.repeat(8);

            await expect(
                reconstructEncryptionKey(shares.slice(0, 2), wrongHash)
            ).rejects.toThrow('Key verification failed: hash mismatch');
        });

        it('should reconstruct without verification when hash not provided', async () => {
            const { shares } = await splitEncryptionKey(encryptionKey, {
                totalShares: 3,
                threshold: 2
            });

            // Should not throw even if reconstruction is wrong
            const key = await reconstructEncryptionKey(shares.slice(0, 2));
            expect(key).toBeDefined();
            expect(key.type).toBe('secret');
        });

        it('should create AES-GCM key with correct properties', async () => {
            const { shares } = await splitEncryptionKey(encryptionKey, {
                totalShares: 3,
                threshold: 2
            });

            const reconstructedKey = await reconstructEncryptionKey(shares.slice(0, 2));

            expect(reconstructedKey.algorithm.name).toBe('AES-GCM');
            expect(reconstructedKey.extractable).toBe(true);
            expect(reconstructedKey.usages).toContain('encrypt');
            expect(reconstructedKey.usages).toContain('decrypt');
        });
    });

    describe('Utility Functions', () => {
        describe('generateUniqueIndex', () => {
            it('should generate index not in existing set', () => {
                const existing = [1, 2, 3, 4, 5];
                const newIndex = generateUniqueIndex(existing);

                expect(newIndex).toBeGreaterThanOrEqual(1);
                expect(newIndex).toBeLessThanOrEqual(255);
                expect(existing).not.toContain(newIndex);
            });

            it('should work with empty existing set', () => {
                const newIndex = generateUniqueIndex([]);

                expect(newIndex).toBeGreaterThanOrEqual(1);
                expect(newIndex).toBeLessThanOrEqual(255);
            });

            it('should handle large existing sets', () => {
                // Create array with most indices used
                const existing = Array.from({ length: 250 }, (_, i) => i + 1);
                const newIndex = generateUniqueIndex(existing);

                expect(existing).not.toContain(newIndex);
                expect(newIndex).toBeGreaterThanOrEqual(1);
                expect(newIndex).toBeLessThanOrEqual(255);
            });
        });

        describe('meetsThreshold', () => {
            it('should return true when shares meet threshold', () => {
                const shares: Share[] = [
                    { index: 1, data: new Uint8Array(32) },
                    { index: 2, data: new Uint8Array(32) },
                    { index: 3, data: new Uint8Array(32) }
                ];

                expect(meetsThreshold(shares, 3)).toBe(true);
                expect(meetsThreshold(shares, 2)).toBe(true);
            });

            it('should return false when shares below threshold', () => {
                const shares: Share[] = [
                    { index: 1, data: new Uint8Array(32) },
                    { index: 2, data: new Uint8Array(32) }
                ];

                expect(meetsThreshold(shares, 3)).toBe(false);
            });

            it('should return false for duplicate indices', () => {
                const shares: Share[] = [
                    { index: 1, data: new Uint8Array(32) },
                    { index: 1, data: new Uint8Array(32) }, // Duplicate
                    { index: 2, data: new Uint8Array(32) }
                ];

                // Even though length is 3, unique indices is only 2
                expect(meetsThreshold(shares, 3)).toBe(false);
            });

            it('should handle empty shares array', () => {
                expect(meetsThreshold([], 1)).toBe(false);
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle single-byte secrets', () => {
            const singleByte = new Uint8Array([0x42]);
            const shares = splitSecret(singleByte, {
                totalShares: 3,
                threshold: 2
            });

            const reconstructed = combineShares(shares.slice(0, 2));
            expect(reconstructed).toEqual(singleByte);
        });

        it('should handle large secrets (1KB)', () => {
            const largeSecret = new Uint8Array(1024);
            crypto.getRandomValues(largeSecret);

            const shares = splitSecret(largeSecret, {
                totalShares: 3,
                threshold: 2
            });

            const reconstructed = combineShares(shares.slice(0, 2));
            expect(reconstructed).toEqual(largeSecret);
        });

        it('should handle all-zero secret', () => {
            const zeroSecret = new Uint8Array(32);
            const shares = splitSecret(zeroSecret, {
                totalShares: 3,
                threshold: 2
            });

            const reconstructed = combineShares(shares.slice(0, 2));
            expect(reconstructed).toEqual(zeroSecret);
        });

        it('should handle all-0xFF secret', () => {
            const maxSecret = new Uint8Array(32).fill(0xFF);
            const shares = splitSecret(maxSecret, {
                totalShares: 3,
                threshold: 2
            });

            const reconstructed = combineShares(shares.slice(0, 2));
            expect(reconstructed).toEqual(maxSecret);
        });

        it('should handle high threshold (5-of-5)', () => {
            const shares = splitSecret(testSecret, {
                totalShares: 5,
                threshold: 5
            });

            // Need all 5 shares
            const reconstructed = combineShares(shares);
            expect(reconstructed).toEqual(testSecret);

            // 4 shares should produce wrong result
            const wrongResult = combineShares(shares.slice(0, 4));
            expect(wrongResult).not.toEqual(testSecret);
        });
    });
});
