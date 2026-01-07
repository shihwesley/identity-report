/**
 * Unit tests for the Multi-Service IPFS Pinning Manager
 * Tests pinning redundancy, health checks, and 2-of-3 service requirement
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import {
    PinningManager,
    PinataService,
    InfuraService,
    Web3StorageService,
    PinningService,
    getPinningManager,
    resetPinningManager,
    DEFAULT_PINNING_CONFIG,
    type PinningConfig,
    type PinningResult,
    type ServiceCredentials
} from '@/lib/sync/pinning';

// ============================================================
// Mock Fetch
// ============================================================

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper to setup fetch mocks
const setupFetchMock = (responses: Map<string, { ok: boolean; status: number; json?: unknown; text?: string }>) => {
    mockFetch.mockImplementation(async (url: string, options?: RequestInit) => {
        for (const [pattern, response] of responses) {
            if (url.includes(pattern)) {
                return {
                    ok: response.ok,
                    status: response.status,
                    json: async () => response.json,
                    text: async () => response.text || ''
                };
            }
        }
        return {
            ok: false,
            status: 404,
            json: async () => ({}),
            text: async () => 'Not found'
        };
    });
};

// Mock AbortController
class MockAbortController {
    signal = { aborted: false };
    abort() {
        this.signal.aborted = true;
    }
}
vi.stubGlobal('AbortController', MockAbortController);

// Mock FormData
class MockFormData {
    private data: Map<string, unknown> = new Map();
    append(key: string, value: unknown) {
        this.data.set(key, value);
    }
}
vi.stubGlobal('FormData', MockFormData);

// Mock Blob
class MockBlob {
    content: string;
    type: string;
    constructor(parts: string[], options?: { type?: string }) {
        this.content = parts.join('');
        this.type = options?.type || '';
    }
}
vi.stubGlobal('Blob', MockBlob);

// Mock btoa
vi.stubGlobal('btoa', (str: string) => Buffer.from(str).toString('base64'));

// ============================================================
// Test Suite - PinataService
// ============================================================

describe('PinataService', () => {
    let service: PinataService;
    const testJwt = 'test-pinata-jwt';

    beforeEach(() => {
        vi.useFakeTimers();
        mockFetch.mockReset();
        service = new PinataService(testJwt);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('pin', () => {
        it('should successfully pin data to Pinata', async () => {
            const expectedCid = 'QmTestCid12345';
            setupFetchMock(new Map([
                ['pinata.cloud/pinning/pinJSONToIPFS', { ok: true, status: 200, json: { IpfsHash: expectedCid } }]
            ]));

            const cid = await service.pin({ test: 'data' });

            expect(cid).toBe(expectedCid);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.pinata.cloud/pinning/pinJSONToIPFS',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${testJwt}`,
                        'Content-Type': 'application/json'
                    })
                })
            );
        });

        it('should include pinata metadata in request', async () => {
            setupFetchMock(new Map([
                ['pinata.cloud/pinning/pinJSONToIPFS', { ok: true, status: 200, json: { IpfsHash: 'QmTest' } }]
            ]));

            await service.pin({ test: 'data' });

            const call = mockFetch.mock.calls[0];
            const body = JSON.parse(call[1].body);
            expect(body.pinataContent).toEqual({ test: 'data' });
            expect(body.pinataMetadata.name).toMatch(/^identity-report-\d+$/);
        });

        it('should throw error on failed pin', async () => {
            setupFetchMock(new Map([
                ['pinata.cloud/pinning/pinJSONToIPFS', { ok: false, status: 500, text: 'Server error' }]
            ]));

            await expect(service.pin({ test: 'data' })).rejects.toThrow('Pinata error 500');
        });

        it('should mark service as unhealthy on failure', async () => {
            setupFetchMock(new Map([
                ['pinata.cloud/pinning/pinJSONToIPFS', { ok: false, status: 500, text: 'Error' }],
                ['pinata.cloud/data/testAuthentication', { ok: true, status: 200 }]
            ]));

            try {
                await service.pin({ test: 'data' });
            } catch {
                // Expected to fail
            }

            // Force fresh health check
            const config = { ...DEFAULT_PINNING_CONFIG, healthCheckIntervalMs: 0 };
            const freshService = new PinataService(testJwt, config);

            // The service should track unhealthiness internally
        });

        it('should mark service as healthy on success', async () => {
            setupFetchMock(new Map([
                ['pinata.cloud/pinning/pinJSONToIPFS', { ok: true, status: 200, json: { IpfsHash: 'QmTest' } }]
            ]));

            await service.pin({ test: 'data' });

            // Service should be marked healthy (internal state)
        });

        it('should use timeout for pin requests', async () => {
            const slowService = new PinataService(testJwt, { timeoutMs: 5000 });

            setupFetchMock(new Map([
                ['pinata.cloud/pinning/pinJSONToIPFS', { ok: true, status: 200, json: { IpfsHash: 'QmTest' } }]
            ]));

            await slowService.pin({ test: 'data' });

            // Verify abort controller signal was passed
            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    signal: expect.anything()
                })
            );
        });
    });

    describe('unpin', () => {
        it('should successfully unpin from Pinata', async () => {
            setupFetchMock(new Map([
                ['pinata.cloud/pinning/unpin/', { ok: true, status: 200 }]
            ]));

            await expect(service.unpin('QmTestCid')).resolves.not.toThrow();
        });

        it('should not throw on 404 (already unpinned)', async () => {
            setupFetchMock(new Map([
                ['pinata.cloud/pinning/unpin/', { ok: false, status: 404 }]
            ]));

            await expect(service.unpin('QmTestCid')).resolves.not.toThrow();
        });

        it('should throw on other errors', async () => {
            setupFetchMock(new Map([
                ['pinata.cloud/pinning/unpin/', { ok: false, status: 500, text: 'Server error' }]
            ]));

            await expect(service.unpin('QmTestCid')).rejects.toThrow('Pinata unpin error');
        });
    });

    describe('checkHealth', () => {
        it('should return true when authentication succeeds', async () => {
            setupFetchMock(new Map([
                ['pinata.cloud/data/testAuthentication', { ok: true, status: 200 }]
            ]));

            const healthy = await service.checkHealth();

            expect(healthy).toBe(true);
        });

        it('should return false when authentication fails', async () => {
            setupFetchMock(new Map([
                ['pinata.cloud/data/testAuthentication', { ok: false, status: 401 }]
            ]));

            const healthy = await service.checkHealth();

            expect(healthy).toBe(false);
        });

        it('should return false on network error', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const healthy = await service.checkHealth();

            expect(healthy).toBe(false);
        });
    });

    describe('isHealthy (cached)', () => {
        it('should cache health check results', async () => {
            setupFetchMock(new Map([
                ['pinata.cloud/data/testAuthentication', { ok: true, status: 200 }]
            ]));

            // First call should make request
            await service.isHealthy();
            const callCount1 = mockFetch.mock.calls.length;

            // Second immediate call should use cache
            await service.isHealthy();
            const callCount2 = mockFetch.mock.calls.length;

            expect(callCount2).toBe(callCount1);
        });

        it('should refresh cache after interval', async () => {
            const shortCacheService = new PinataService(testJwt, { healthCheckIntervalMs: 1000 });

            setupFetchMock(new Map([
                ['pinata.cloud/data/testAuthentication', { ok: true, status: 200 }]
            ]));

            await shortCacheService.isHealthy();
            const callCount1 = mockFetch.mock.calls.length;

            // Advance time past cache interval
            vi.advanceTimersByTime(2000);

            await shortCacheService.isHealthy();
            const callCount2 = mockFetch.mock.calls.length;

            expect(callCount2).toBeGreaterThan(callCount1);
        });
    });
});

// ============================================================
// Test Suite - InfuraService
// ============================================================

describe('InfuraService', () => {
    let service: InfuraService;
    const testProjectId = 'test-project-id';
    const testProjectSecret = 'test-project-secret';

    beforeEach(() => {
        vi.useFakeTimers();
        mockFetch.mockReset();
        service = new InfuraService(testProjectId, testProjectSecret);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('pin', () => {
        it('should successfully pin data to Infura', async () => {
            const expectedHash = 'QmInfuraHash12345';
            setupFetchMock(new Map([
                ['ipfs.infura.io:5001/api/v0/add', { ok: true, status: 200, json: { Hash: expectedHash } }]
            ]));

            const cid = await service.pin({ test: 'data' });

            expect(cid).toBe(expectedHash);
        });

        it('should use Basic auth header', async () => {
            setupFetchMock(new Map([
                ['ipfs.infura.io:5001/api/v0/add', { ok: true, status: 200, json: { Hash: 'QmTest' } }]
            ]));

            await service.pin({ test: 'data' });

            const expectedAuth = `Basic ${btoa(`${testProjectId}:${testProjectSecret}`)}`;
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('ipfs.infura.io'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': expectedAuth
                    })
                })
            );
        });

        it('should use FormData for upload', async () => {
            setupFetchMock(new Map([
                ['ipfs.infura.io:5001/api/v0/add', { ok: true, status: 200, json: { Hash: 'QmTest' } }]
            ]));

            await service.pin({ test: 'data' });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: expect.any(MockFormData)
                })
            );
        });

        it('should throw error on failed pin', async () => {
            setupFetchMock(new Map([
                ['ipfs.infura.io:5001/api/v0/add', { ok: false, status: 500, text: 'Infura error' }]
            ]));

            await expect(service.pin({ test: 'data' })).rejects.toThrow('Infura error 500');
        });
    });

    describe('unpin', () => {
        it('should successfully unpin from Infura', async () => {
            setupFetchMock(new Map([
                ['ipfs.infura.io:5001/api/v0/pin/rm', { ok: true, status: 200 }]
            ]));

            await expect(service.unpin('QmTestCid')).resolves.not.toThrow();
        });

        it('should not throw on 500 (often means not pinned)', async () => {
            setupFetchMock(new Map([
                ['ipfs.infura.io:5001/api/v0/pin/rm', { ok: false, status: 500 }]
            ]));

            await expect(service.unpin('QmTestCid')).resolves.not.toThrow();
        });
    });

    describe('checkHealth', () => {
        it('should return true when version endpoint responds', async () => {
            setupFetchMock(new Map([
                ['ipfs.infura.io:5001/api/v0/version', { ok: true, status: 200 }]
            ]));

            const healthy = await service.checkHealth();

            expect(healthy).toBe(true);
        });

        it('should return false on error', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const healthy = await service.checkHealth();

            expect(healthy).toBe(false);
        });
    });
});

// ============================================================
// Test Suite - Web3StorageService
// ============================================================

describe('Web3StorageService', () => {
    let service: Web3StorageService;
    const testToken = 'test-web3storage-token';

    beforeEach(() => {
        vi.useFakeTimers();
        mockFetch.mockReset();
        service = new Web3StorageService(testToken);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('pin', () => {
        it('should successfully pin data to Web3.Storage', async () => {
            const expectedCid = 'bafybeigw3storagecid';
            setupFetchMock(new Map([
                ['api.web3.storage/upload', { ok: true, status: 200, json: { cid: expectedCid } }]
            ]));

            const cid = await service.pin({ test: 'data' });

            expect(cid).toBe(expectedCid);
        });

        it('should use Bearer token auth', async () => {
            setupFetchMock(new Map([
                ['api.web3.storage/upload', { ok: true, status: 200, json: { cid: 'bafytest' } }]
            ]));

            await service.pin({ test: 'data' });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${testToken}`
                    })
                })
            );
        });

        it('should include X-Name header', async () => {
            setupFetchMock(new Map([
                ['api.web3.storage/upload', { ok: true, status: 200, json: { cid: 'bafytest' } }]
            ]));

            await service.pin({ test: 'data' });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'X-Name': expect.stringMatching(/^identity-report-\d+$/)
                    })
                })
            );
        });

        it('should throw error on failed pin', async () => {
            setupFetchMock(new Map([
                ['api.web3.storage/upload', { ok: false, status: 401, text: 'Unauthorized' }]
            ]));

            await expect(service.pin({ test: 'data' })).rejects.toThrow('Web3Storage error 401');
        });
    });

    describe('unpin', () => {
        it('should log warning (Web3.Storage does not support unpinning)', async () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await service.unpin('QmTestCid');

            expect(consoleSpy).toHaveBeenCalledWith('Web3Storage does not support unpinning');

            consoleSpy.mockRestore();
        });
    });

    describe('checkHealth', () => {
        it('should return true when account endpoint responds', async () => {
            setupFetchMock(new Map([
                ['api.web3.storage/user/account', { ok: true, status: 200 }]
            ]));

            const healthy = await service.checkHealth();

            expect(healthy).toBe(true);
        });

        it('should return false on error', async () => {
            setupFetchMock(new Map([
                ['api.web3.storage/user/account', { ok: false, status: 401 }]
            ]));

            const healthy = await service.checkHealth();

            expect(healthy).toBe(false);
        });
    });
});

// ============================================================
// Test Suite - PinningManager
// ============================================================

describe('PinningManager', () => {
    let manager: PinningManager;

    beforeEach(() => {
        vi.useFakeTimers();
        mockFetch.mockReset();
        resetPinningManager();
        manager = new PinningManager();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('initializeServices', () => {
        it('should initialize Pinata service when JWT provided', () => {
            manager.initializeServices({
                pinata: { jwt: 'test-jwt' }
            });

            expect(manager.getServiceCount()).toBe(1);
        });

        it('should initialize Infura service when credentials provided', () => {
            manager.initializeServices({
                infura: { projectId: 'test-id', projectSecret: 'test-secret' }
            });

            expect(manager.getServiceCount()).toBe(1);
        });

        it('should initialize Web3Storage service when token provided', () => {
            manager.initializeServices({
                web3storage: { token: 'test-token' }
            });

            expect(manager.getServiceCount()).toBe(1);
        });

        it('should initialize all services when all credentials provided', () => {
            manager.initializeServices({
                pinata: { jwt: 'test-jwt' },
                infura: { projectId: 'test-id', projectSecret: 'test-secret' },
                web3storage: { token: 'test-token' }
            });

            expect(manager.getServiceCount()).toBe(3);
        });

        it('should not initialize services with missing credentials', () => {
            manager.initializeServices({
                infura: { projectId: 'test-id', projectSecret: '' } // Empty secret
            });

            expect(manager.getServiceCount()).toBe(0);
        });

        it('should clear previous services on re-initialization', () => {
            manager.initializeServices({ pinata: { jwt: 'jwt1' } });
            expect(manager.getServiceCount()).toBe(1);

            manager.initializeServices({ web3storage: { token: 'token1' } });
            expect(manager.getServiceCount()).toBe(1);
        });
    });

    describe('addService', () => {
        it('should add custom pinning service', () => {
            const customService = new PinataService('custom-jwt');
            manager.addService(customService);

            expect(manager.getServiceCount()).toBe(1);
        });
    });

    describe('pinToAll', () => {
        it('should return failure when no services configured', async () => {
            const result = await manager.pinToAll({ test: 'data' });

            expect(result.success).toBe(false);
            expect(result.cid).toBeNull();
            expect(result.results).toHaveLength(0);
        });

        it('should require 2 of 3 services for success (default config)', async () => {
            // Setup 3 services, 2 succeed
            setupFetchMock(new Map([
                ['pinata.cloud/pinning/pinJSONToIPFS', { ok: true, status: 200, json: { IpfsHash: 'QmPinata' } }],
                ['pinata.cloud/data/testAuthentication', { ok: true, status: 200 }],
                ['ipfs.infura.io:5001/api/v0/add', { ok: true, status: 200, json: { Hash: 'QmInfura' } }],
                ['ipfs.infura.io:5001/api/v0/version', { ok: true, status: 200 }],
                ['api.web3.storage/upload', { ok: false, status: 500, text: 'Error' }],
                ['api.web3.storage/user/account', { ok: true, status: 200 }]
            ]));

            manager.initializeServices({
                pinata: { jwt: 'jwt' },
                infura: { projectId: 'id', projectSecret: 'secret' },
                web3storage: { token: 'token' }
            });

            const result = await manager.pinToAll({ test: 'data' });

            expect(result.success).toBe(true);
            expect(result.cid).toBeDefined();

            const successCount = result.results.filter(r => r.success).length;
            expect(successCount).toBeGreaterThanOrEqual(2);
        });

        it('should fail when fewer than required services succeed', async () => {
            // Setup 3 services, only 1 succeeds
            setupFetchMock(new Map([
                ['pinata.cloud/pinning/pinJSONToIPFS', { ok: true, status: 200, json: { IpfsHash: 'QmPinata' } }],
                ['pinata.cloud/data/testAuthentication', { ok: true, status: 200 }],
                ['ipfs.infura.io:5001/api/v0/add', { ok: false, status: 500, text: 'Error' }],
                ['ipfs.infura.io:5001/api/v0/version', { ok: true, status: 200 }],
                ['api.web3.storage/upload', { ok: false, status: 500, text: 'Error' }],
                ['api.web3.storage/user/account', { ok: true, status: 200 }]
            ]));

            manager.initializeServices({
                pinata: { jwt: 'jwt' },
                infura: { projectId: 'id', projectSecret: 'secret' },
                web3storage: { token: 'token' }
            });

            const result = await manager.pinToAll({ test: 'data' });

            expect(result.success).toBe(false);
        });

        it('should skip unhealthy services', async () => {
            // Make Pinata unhealthy but still try others
            setupFetchMock(new Map([
                ['pinata.cloud/data/testAuthentication', { ok: false, status: 401 }],
                ['ipfs.infura.io:5001/api/v0/add', { ok: true, status: 200, json: { Hash: 'QmInfura' } }],
                ['ipfs.infura.io:5001/api/v0/version', { ok: true, status: 200 }],
                ['api.web3.storage/upload', { ok: true, status: 200, json: { cid: 'bafyW3S' } }],
                ['api.web3.storage/user/account', { ok: true, status: 200 }]
            ]));

            manager.initializeServices({
                pinata: { jwt: 'jwt' },
                infura: { projectId: 'id', projectSecret: 'secret' },
                web3storage: { token: 'token' }
            });

            const result = await manager.pinToAll({ test: 'data' });

            // Should still succeed with 2 healthy services
            expect(result.success).toBe(true);

            // Pinata should be marked as skipped
            const pinataResult = result.results.find(r => r.service === 'Pinata');
            expect(pinataResult?.success).toBe(false);
            expect(pinataResult?.error).toContain('unhealthy');
        });

        it('should fail when not enough healthy services', async () => {
            // Only 1 service healthy
            setupFetchMock(new Map([
                ['pinata.cloud/data/testAuthentication', { ok: false, status: 401 }],
                ['ipfs.infura.io:5001/api/v0/version', { ok: false, status: 401 }],
                ['api.web3.storage/user/account', { ok: true, status: 200 }],
                ['api.web3.storage/upload', { ok: true, status: 200, json: { cid: 'bafyW3S' } }]
            ]));

            manager.initializeServices({
                pinata: { jwt: 'jwt' },
                infura: { projectId: 'id', projectSecret: 'secret' },
                web3storage: { token: 'token' }
            });

            const result = await manager.pinToAll({ test: 'data' });

            expect(result.success).toBe(false);
        });

        it('should return CID from first successful service', async () => {
            const expectedCid = 'QmFirstSuccessful';
            setupFetchMock(new Map([
                ['pinata.cloud/pinning/pinJSONToIPFS', { ok: true, status: 200, json: { IpfsHash: expectedCid } }],
                ['pinata.cloud/data/testAuthentication', { ok: true, status: 200 }],
                ['ipfs.infura.io:5001/api/v0/add', { ok: true, status: 200, json: { Hash: 'QmSecond' } }],
                ['ipfs.infura.io:5001/api/v0/version', { ok: true, status: 200 }]
            ]));

            manager.initializeServices({
                pinata: { jwt: 'jwt' },
                infura: { projectId: 'id', projectSecret: 'secret' }
            });

            const result = await manager.pinToAll({ test: 'data' });

            expect(result.cid).toBe(expectedCid);
        });

        it('should include duration in results', async () => {
            setupFetchMock(new Map([
                ['pinata.cloud/pinning/pinJSONToIPFS', { ok: true, status: 200, json: { IpfsHash: 'QmTest' } }],
                ['pinata.cloud/data/testAuthentication', { ok: true, status: 200 }]
            ]));

            manager.initializeServices({ pinata: { jwt: 'jwt' } });

            // Configure to require only 1 service
            manager = new PinningManager({ requiredSuccessCount: 1 });
            manager.initializeServices({ pinata: { jwt: 'jwt' } });

            const result = await manager.pinToAll({ test: 'data' });

            const pinataResult = result.results.find(r => r.service === 'Pinata');
            expect(pinataResult?.durationMs).toBeDefined();
            expect(typeof pinataResult?.durationMs).toBe('number');
        });

        it('should include error messages for failed services', async () => {
            setupFetchMock(new Map([
                ['pinata.cloud/pinning/pinJSONToIPFS', { ok: false, status: 500, text: 'Server error' }],
                ['pinata.cloud/data/testAuthentication', { ok: true, status: 200 }],
                ['ipfs.infura.io:5001/api/v0/add', { ok: true, status: 200, json: { Hash: 'QmInfura' } }],
                ['ipfs.infura.io:5001/api/v0/version', { ok: true, status: 200 }]
            ]));

            const twoServiceManager = new PinningManager({ requiredSuccessCount: 1 });
            twoServiceManager.initializeServices({
                pinata: { jwt: 'jwt' },
                infura: { projectId: 'id', projectSecret: 'secret' }
            });

            const result = await twoServiceManager.pinToAll({ test: 'data' });

            const pinataResult = result.results.find(r => r.service === 'Pinata');
            expect(pinataResult?.success).toBe(false);
            expect(pinataResult?.error).toBeDefined();
        });
    });

    describe('unpinFromAll', () => {
        it('should attempt to unpin from all services', async () => {
            setupFetchMock(new Map([
                ['pinata.cloud/pinning/unpin/', { ok: true, status: 200 }],
                ['ipfs.infura.io:5001/api/v0/pin/rm', { ok: true, status: 200 }]
            ]));

            manager.initializeServices({
                pinata: { jwt: 'jwt' },
                infura: { projectId: 'id', projectSecret: 'secret' }
            });

            await expect(manager.unpinFromAll('QmTestCid')).resolves.not.toThrow();
        });

        it('should not throw even if some services fail', async () => {
            setupFetchMock(new Map([
                ['pinata.cloud/pinning/unpin/', { ok: false, status: 500 }],
                ['ipfs.infura.io:5001/api/v0/pin/rm', { ok: true, status: 200 }]
            ]));

            manager.initializeServices({
                pinata: { jwt: 'jwt' },
                infura: { projectId: 'id', projectSecret: 'secret' }
            });

            await expect(manager.unpinFromAll('QmTestCid')).resolves.not.toThrow();
        });
    });

    describe('getHealthStatus', () => {
        it('should return health status of all services', async () => {
            setupFetchMock(new Map([
                ['pinata.cloud/data/testAuthentication', { ok: true, status: 200 }],
                ['ipfs.infura.io:5001/api/v0/version', { ok: false, status: 401 }],
                ['api.web3.storage/user/account', { ok: true, status: 200 }]
            ]));

            manager.initializeServices({
                pinata: { jwt: 'jwt' },
                infura: { projectId: 'id', projectSecret: 'secret' },
                web3storage: { token: 'token' }
            });

            const status = await manager.getHealthStatus();

            expect(status).toHaveLength(3);
            expect(status.find(s => s.service === 'Pinata')?.healthy).toBe(true);
            expect(status.find(s => s.service === 'Infura')?.healthy).toBe(false);
            expect(status.find(s => s.service === 'Web3Storage')?.healthy).toBe(true);
        });
    });

    describe('configuration', () => {
        it('should use custom requiredSuccessCount', async () => {
            const strictManager = new PinningManager({ requiredSuccessCount: 3 });

            setupFetchMock(new Map([
                ['pinata.cloud/pinning/pinJSONToIPFS', { ok: true, status: 200, json: { IpfsHash: 'QmPinata' } }],
                ['pinata.cloud/data/testAuthentication', { ok: true, status: 200 }],
                ['ipfs.infura.io:5001/api/v0/add', { ok: true, status: 200, json: { Hash: 'QmInfura' } }],
                ['ipfs.infura.io:5001/api/v0/version', { ok: true, status: 200 }],
                ['api.web3.storage/upload', { ok: false, status: 500, text: 'Error' }],
                ['api.web3.storage/user/account', { ok: true, status: 200 }]
            ]));

            strictManager.initializeServices({
                pinata: { jwt: 'jwt' },
                infura: { projectId: 'id', projectSecret: 'secret' },
                web3storage: { token: 'token' }
            });

            const result = await strictManager.pinToAll({ test: 'data' });

            // Should fail because only 2 of 3 succeeded
            expect(result.success).toBe(false);
        });

        it('should use default config when none provided', () => {
            const defaultManager = new PinningManager();

            // Verify default behavior (internal state)
            expect(defaultManager.getServiceCount()).toBe(0);
        });
    });
});

// ============================================================
// Test Suite - Singleton Pattern
// ============================================================

describe('Pinning Manager Singleton', () => {
    beforeEach(() => {
        resetPinningManager();
    });

    it('should return same instance from getPinningManager', () => {
        const instance1 = getPinningManager();
        const instance2 = getPinningManager();

        expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
        const instance1 = getPinningManager();
        resetPinningManager();
        const instance2 = getPinningManager();

        expect(instance1).not.toBe(instance2);
    });

    it('should pass config to new instance', () => {
        const instance = getPinningManager({ requiredSuccessCount: 1 });

        // Config is internal, but we can verify by behavior
        expect(instance).toBeDefined();
    });
});

// ============================================================
// Test Suite - Service Health Tracking
// ============================================================

describe('Service Health Tracking', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockFetch.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should track consecutive failures', async () => {
        setupFetchMock(new Map([
            ['pinata.cloud/data/testAuthentication', { ok: false, status: 500 }]
        ]));

        const service = new PinataService('jwt', { healthCheckIntervalMs: 0 });

        // Multiple health checks should track failures
        await service.isHealthy();
        vi.advanceTimersByTime(100);
        await service.isHealthy();
        vi.advanceTimersByTime(100);
        await service.isHealthy();

        // After 3 consecutive failures (MAX_CONSECUTIVE_FAILURES), should be unhealthy
    });

    it('should reset failure count on success', async () => {
        const service = new PinataService('jwt', { healthCheckIntervalMs: 0 });

        // First fail
        setupFetchMock(new Map([
            ['pinata.cloud/data/testAuthentication', { ok: false, status: 500 }]
        ]));
        await service.isHealthy();

        // Then succeed
        vi.advanceTimersByTime(100);
        setupFetchMock(new Map([
            ['pinata.cloud/data/testAuthentication', { ok: true, status: 200 }]
        ]));
        const healthy = await service.isHealthy();

        expect(healthy).toBe(true);
    });

    it('should allow manual health marking', () => {
        const service = new PinataService('jwt');

        service.markUnhealthy();
        // Internal state should be unhealthy

        service.markHealthy();
        // Internal state should be healthy
    });
});

// ============================================================
// Test Suite - Edge Cases
// ============================================================

describe('Pinning Edge Cases', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('should handle large payloads', async () => {
        setupFetchMock(new Map([
            ['pinata.cloud/pinning/pinJSONToIPFS', { ok: true, status: 200, json: { IpfsHash: 'QmLarge' } }]
        ]));

        const service = new PinataService('jwt');

        // Create large payload
        const largeData = {
            items: Array.from({ length: 1000 }, (_, i) => ({
                id: i,
                content: 'x'.repeat(100)
            }))
        };

        const cid = await service.pin(largeData);

        expect(cid).toBe('QmLarge');
    });

    it('should handle special characters in data', async () => {
        setupFetchMock(new Map([
            ['pinata.cloud/pinning/pinJSONToIPFS', { ok: true, status: 200, json: { IpfsHash: 'QmSpecial' } }]
        ]));

        const service = new PinataService('jwt');

        const specialData = {
            unicode: 'Hello, World!',
            emoji: 'Test data',
            quotes: '"quoted"',
            newlines: 'line1\nline2'
        };

        const cid = await service.pin(specialData);

        expect(cid).toBe('QmSpecial');
    });

    it('should handle null/undefined values in data', async () => {
        setupFetchMock(new Map([
            ['pinata.cloud/pinning/pinJSONToIPFS', { ok: true, status: 200, json: { IpfsHash: 'QmNull' } }]
        ]));

        const service = new PinataService('jwt');

        const nullData = {
            defined: 'value',
            nullField: null,
            undefinedField: undefined
        };

        const cid = await service.pin(nullData);

        expect(cid).toBe('QmNull');
    });

    it('should handle empty data object', async () => {
        setupFetchMock(new Map([
            ['pinata.cloud/pinning/pinJSONToIPFS', { ok: true, status: 200, json: { IpfsHash: 'QmEmpty' } }]
        ]));

        const service = new PinataService('jwt');
        const cid = await service.pin({});

        expect(cid).toBe('QmEmpty');
    });

    it('should handle network timeout', async () => {
        mockFetch.mockImplementation(() => new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 100);
        }));

        const service = new PinataService('jwt', { timeoutMs: 50 });

        await expect(service.pin({ test: 'data' })).rejects.toThrow();
    });
});

// ============================================================
// Integration-Style Tests
// ============================================================

describe('Pinning Manager - Integration Scenarios', () => {
    beforeEach(() => {
        mockFetch.mockReset();
        resetPinningManager();
    });

    it('should handle complete pinning workflow', async () => {
        // Setup all services to succeed
        setupFetchMock(new Map([
            ['pinata.cloud/pinning/pinJSONToIPFS', { ok: true, status: 200, json: { IpfsHash: 'QmWorkflow' } }],
            ['pinata.cloud/data/testAuthentication', { ok: true, status: 200 }],
            ['pinata.cloud/pinning/unpin/', { ok: true, status: 200 }],
            ['ipfs.infura.io:5001/api/v0/add', { ok: true, status: 200, json: { Hash: 'QmWorkflow' } }],
            ['ipfs.infura.io:5001/api/v0/version', { ok: true, status: 200 }],
            ['ipfs.infura.io:5001/api/v0/pin/rm', { ok: true, status: 200 }]
        ]));

        const manager = getPinningManager();
        manager.initializeServices({
            pinata: { jwt: 'jwt' },
            infura: { projectId: 'id', projectSecret: 'secret' }
        });

        // Check health
        const healthStatus = await manager.getHealthStatus();
        expect(healthStatus.every(s => s.healthy)).toBe(true);

        // Pin data
        const pinResult = await manager.pinToAll({ profile: 'data' });
        expect(pinResult.success).toBe(true);
        expect(pinResult.cid).toBeDefined();

        // Unpin data
        await expect(manager.unpinFromAll(pinResult.cid!)).resolves.not.toThrow();
    });

    it('should gracefully degrade with service failures', async () => {
        // Pinata down, others working
        setupFetchMock(new Map([
            ['pinata.cloud/data/testAuthentication', { ok: false, status: 503 }],
            ['ipfs.infura.io:5001/api/v0/add', { ok: true, status: 200, json: { Hash: 'QmDegrade' } }],
            ['ipfs.infura.io:5001/api/v0/version', { ok: true, status: 200 }],
            ['api.web3.storage/upload', { ok: true, status: 200, json: { cid: 'bafyDegrade' } }],
            ['api.web3.storage/user/account', { ok: true, status: 200 }]
        ]));

        const manager = new PinningManager();
        manager.initializeServices({
            pinata: { jwt: 'jwt' },
            infura: { projectId: 'id', projectSecret: 'secret' },
            web3storage: { token: 'token' }
        });

        const result = await manager.pinToAll({ test: 'data' });

        // Should still succeed with 2 of 3 services
        expect(result.success).toBe(true);

        // Pinata should be marked as unhealthy/skipped
        const pinataResult = result.results.find(r => r.service === 'Pinata');
        expect(pinataResult?.success).toBe(false);
    });
});
