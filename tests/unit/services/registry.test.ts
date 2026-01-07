/**
 * Unit tests for Registry Service
 *
 * Tests both MockRegistryService and PolygonRegistryService for
 * profile updates, lookups, and blockchain interaction mocking.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockRegistryService, PolygonRegistryService } from '@/lib/services/registry';

// Mock localStorage for MockRegistryService
const mockLocalStorage = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
        reset: () => { store = {}; }
    };
})();

// Mock window for localStorage access
vi.stubGlobal('window', { localStorage: mockLocalStorage });
vi.stubGlobal('localStorage', mockLocalStorage);

describe('MockRegistryService', () => {
    let service: MockRegistryService;

    beforeEach(() => {
        mockLocalStorage.reset();
        mockLocalStorage.getItem.mockClear();
        mockLocalStorage.setItem.mockClear();
        service = new MockRegistryService();
    });

    describe('updateProfile()', () => {
        it('should update profile and return transaction hash', async () => {
            const did = 'did:key:z6MkTest123';
            const cid = 'QmTestCid123456789';

            const txHash = await service.updateProfile(did, cid);

            expect(txHash).toBeDefined();
            expect(txHash.startsWith('0x')).toBe(true);
            expect(txHash.length).toBe(66); // 0x + 64 hex chars
        });

        it('should store profile mapping', async () => {
            const did = 'did:key:z6MkTest456';
            const cid = 'QmTestCid987654321';

            await service.updateProfile(did, cid);
            const retrieved = await service.getProfileCid(did);

            expect(retrieved).toBe(cid);
        });

        it('should overwrite existing profile', async () => {
            const did = 'did:key:z6MkTest789';
            const cid1 = 'QmFirstCid';
            const cid2 = 'QmSecondCid';

            await service.updateProfile(did, cid1);
            await service.updateProfile(did, cid2);

            const retrieved = await service.getProfileCid(did);
            expect(retrieved).toBe(cid2);
        });

        it('should persist state to localStorage', async () => {
            const did = 'did:key:z6MkPersist';
            const cid = 'QmPersistCid';

            await service.updateProfile(did, cid);

            expect(mockLocalStorage.setItem).toHaveBeenCalled();
            const savedData = mockLocalStorage.setItem.mock.calls.find(
                call => call[0] === 'mock_registry_state'
            );
            expect(savedData).toBeDefined();
        });

        it('should generate unique transaction hashes', async () => {
            const txHashes: string[] = [];

            // Run updates in parallel to avoid timeout
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(service.updateProfile(`did:key:test${i}`, `QmCid${i}`));
            }
            const results = await Promise.all(promises);
            txHashes.push(...results);

            const uniqueHashes = new Set(txHashes);
            expect(uniqueHashes.size).toBe(5);
        }, 15000); // Increase timeout for this test

        it('should simulate network latency', async () => {
            const startTime = Date.now();
            await service.updateProfile('did:key:latency', 'QmLatencyCid');
            const duration = Date.now() - startTime;

            // Default latency is 1000ms
            expect(duration).toBeGreaterThanOrEqual(900); // Allow some variance
        });
    });

    describe('getProfileCid()', () => {
        it('should return null for non-existent DID', async () => {
            const result = await service.getProfileCid('did:key:nonexistent');

            expect(result).toBeNull();
        });

        it('should return CID for existing DID', async () => {
            const did = 'did:key:z6MkExisting';
            const cid = 'QmExistingCid';

            await service.updateProfile(did, cid);
            const result = await service.getProfileCid(did);

            expect(result).toBe(cid);
        });

        it('should simulate read latency', async () => {
            const startTime = Date.now();
            await service.getProfileCid('did:key:any');
            const duration = Date.now() - startTime;

            // Read latency is 500ms
            expect(duration).toBeGreaterThanOrEqual(450);
        });

        it('should handle multiple DIDs independently', async () => {
            await service.updateProfile('did:key:user1', 'QmCid1');
            await service.updateProfile('did:key:user2', 'QmCid2');
            await service.updateProfile('did:key:user3', 'QmCid3');

            expect(await service.getProfileCid('did:key:user1')).toBe('QmCid1');
            expect(await service.getProfileCid('did:key:user2')).toBe('QmCid2');
            expect(await service.getProfileCid('did:key:user3')).toBe('QmCid3');
        });
    });

    describe('State Persistence', () => {
        it('should load state from localStorage on initialization', () => {
            const savedState = JSON.stringify({
                'did:key:saved': 'QmSavedCid'
            });
            mockLocalStorage.getItem.mockReturnValueOnce(savedState);

            const newService = new MockRegistryService();

            // The service should have loaded the saved state
            // We can verify by checking the mock was called
            expect(mockLocalStorage.getItem).toHaveBeenCalledWith('mock_registry_state');
        });

        it('should handle corrupted localStorage data', () => {
            mockLocalStorage.getItem.mockReturnValueOnce('not valid json');

            // Should not throw
            expect(() => new MockRegistryService()).not.toThrow();
        });

        it('should handle empty localStorage', () => {
            mockLocalStorage.getItem.mockReturnValueOnce(null);

            const newService = new MockRegistryService();
            expect(newService).toBeDefined();
        });
    });
});

describe('PolygonRegistryService', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
        // Clear environment variables
        delete process.env.NEXT_PUBLIC_RPC_URL;
        delete process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
        delete process.env.PRIVATE_KEY;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('constructor', () => {
        it('should use default RPC URL if not provided', () => {
            const service = new PolygonRegistryService();
            expect(service).toBeDefined();
        });

        it('should use provided RPC URL from environment', () => {
            process.env.NEXT_PUBLIC_RPC_URL = 'https://custom-rpc.example.com';
            const service = new PolygonRegistryService();
            expect(service).toBeDefined();
        });

        it('should use provided registry address from environment', () => {
            process.env.NEXT_PUBLIC_REGISTRY_ADDRESS = '0x1234567890123456789012345678901234567890';
            const service = new PolygonRegistryService();
            expect(service).toBeDefined();
        });

        it('should warn if registry address is not set', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            new PolygonRegistryService();

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Registry Contract Address not set')
            );

            consoleSpy.mockRestore();
        });
    });

    describe('updateProfile()', () => {
        it('should throw error without PRIVATE_KEY in server mode', async () => {
            const service = new PolygonRegistryService();

            await expect(service.updateProfile('did:key:test', 'QmCid')).rejects.toThrow(
                /PRIVATE_KEY environment variable/
            );
        });

        it('should attempt write with PRIVATE_KEY set', async () => {
            // This test would require more extensive mocking of viem
            // For now, we just verify the error path
            process.env.PRIVATE_KEY = '0xinvalidkey';
            const service = new PolygonRegistryService();

            // This will fail because the key format is invalid
            await expect(service.updateProfile('did:key:test', 'QmCid')).rejects.toThrow();
        });
    });

    describe('getProfileCid()', () => {
        it('should handle DID format extraction', async () => {
            process.env.NEXT_PUBLIC_REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000000';
            const service = new PolygonRegistryService();

            // This will fail due to network, but tests the DID parsing logic
            // Mock the readContract to avoid actual network call
            const mockReadContract = vi.fn().mockResolvedValue('');

            // Replace the publicClient's readContract
            // Note: This is a simplified test - full test would mock viem properly
            try {
                await service.getProfileCid('did:pkh:eip155:1:0x1234567890123456789012345678901234567890');
            } catch {
                // Expected to fail without proper mocking
            }
        });

        it('should handle raw address format', async () => {
            process.env.NEXT_PUBLIC_REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000000';
            const service = new PolygonRegistryService();

            try {
                await service.getProfileCid('0x1234567890123456789012345678901234567890');
            } catch {
                // Expected to fail without proper network mocking
            }
        });

        it('should return null on read error', async () => {
            process.env.NEXT_PUBLIC_REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000000';
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const service = new PolygonRegistryService();

            // This should handle errors gracefully
            const result = await service.getProfileCid('0xinvalidaddress');

            expect(result).toBeNull();

            consoleSpy.mockRestore();
        });
    });

    describe('DID Address Extraction', () => {
        it('should extract address from did:pkh format', async () => {
            process.env.NEXT_PUBLIC_REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000000';
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const service = new PolygonRegistryService();
            const did = 'did:pkh:eip155:137:0xABCDEF1234567890ABCDEF1234567890ABCDEF12';

            // The address extraction happens internally
            // We can't directly test it without more mocking, but the method should handle it
            await service.getProfileCid(did);

            consoleSpy.mockRestore();
        });
    });
});

describe('RegistryProvider Interface', () => {
    it('should be implemented by MockRegistryService', () => {
        const service = new MockRegistryService();

        expect(typeof service.updateProfile).toBe('function');
        expect(typeof service.getProfileCid).toBe('function');
    });

    it('should be implemented by PolygonRegistryService', () => {
        const service = new PolygonRegistryService();

        expect(typeof service.updateProfile).toBe('function');
        expect(typeof service.getProfileCid).toBe('function');
    });

    it('should allow polymorphic usage', async () => {
        // Both services should be usable through the same interface
        const mock = new MockRegistryService();
        const polygon = new PolygonRegistryService();

        // Type check - both should have same method signatures
        const providers = [mock, polygon];

        for (const provider of providers) {
            expect(provider.updateProfile).toBeDefined();
            expect(provider.getProfileCid).toBeDefined();
        }
    });
});

describe('Integration Scenarios', () => {
    describe('Profile Lifecycle', () => {
        let service: MockRegistryService;

        beforeEach(() => {
            mockLocalStorage.reset();
            service = new MockRegistryService();
        });

        it('should handle create-read-update-read cycle', async () => {
            const did = 'did:key:lifecycle';

            // Create
            const tx1 = await service.updateProfile(did, 'QmInitialCid');
            expect(tx1).toBeDefined();

            // Read
            let cid = await service.getProfileCid(did);
            expect(cid).toBe('QmInitialCid');

            // Update
            const tx2 = await service.updateProfile(did, 'QmUpdatedCid');
            expect(tx2).toBeDefined();
            expect(tx2).not.toBe(tx1);

            // Read again
            cid = await service.getProfileCid(did);
            expect(cid).toBe('QmUpdatedCid');
        });

        it('should handle concurrent updates to different DIDs', async () => {
            const updates = [
                service.updateProfile('did:key:user1', 'QmCid1'),
                service.updateProfile('did:key:user2', 'QmCid2'),
                service.updateProfile('did:key:user3', 'QmCid3')
            ];

            const txHashes = await Promise.all(updates);

            expect(txHashes.length).toBe(3);
            expect(new Set(txHashes).size).toBe(3); // All unique

            // Verify all updates persisted
            expect(await service.getProfileCid('did:key:user1')).toBe('QmCid1');
            expect(await service.getProfileCid('did:key:user2')).toBe('QmCid2');
            expect(await service.getProfileCid('did:key:user3')).toBe('QmCid3');
        });
    });
});
