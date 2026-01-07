/**
 * Unit tests for IPFS/Pinata Service
 *
 * Tests upload operations, gateway URL generation, authentication handling,
 * and error scenarios for the IPFS storage service.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockPinataAPI, MOCK_IPFS, configureIPFSMock } from '../../mocks/ipfs';

// Mock logger - must be defined inline in vi.mock factory
vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        audit: vi.fn()
    }
}));

// Import after mocking
import { PinataService, StorageProvider } from '@/lib/services/ipfs';
import { logger } from '@/lib/logger';

// Cast logger to get mocked functions
const mockLogger = logger as {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    audit: ReturnType<typeof vi.fn>;
};

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock FormData
class MockFormData {
    private data: Map<string, unknown> = new Map();

    append(key: string, value: unknown) {
        this.data.set(key, value);
    }

    get(key: string) {
        return this.data.get(key);
    }

    has(key: string) {
        return this.data.has(key);
    }

    entries() {
        return this.data.entries();
    }
}
vi.stubGlobal('FormData', MockFormData);

describe('PinataService', () => {
    let service: PinataService;

    beforeEach(() => {
        mockFetch.mockReset();
        mockPinataAPI.reset();
        configureIPFSMock({ delay: 0, shouldFail: false, failureRate: 0 });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with JWT token', () => {
            service = new PinataService({ jwt: 'test-jwt-token' });
            expect(service).toBeDefined();
        });

        it('should initialize with API key and secret', () => {
            service = new PinataService({
                apiKey: 'test-api-key',
                apiSecret: 'test-api-secret'
            });
            expect(service).toBeDefined();
        });

        it('should warn when initialized without credentials', () => {
            mockLogger.warn.mockClear();
            service = new PinataService({});

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('without credentials')
            );
        });

        it('should not warn when JWT is provided', () => {
            mockLogger.warn.mockClear();

            service = new PinataService({ jwt: 'valid-jwt' });

            expect(mockLogger.warn).not.toHaveBeenCalled();
        });
    });

    describe('upload()', () => {
        beforeEach(() => {
            service = new PinataService({ jwt: 'test-jwt' });
        });

        it('should upload file successfully and return CID', async () => {
            const mockCid = 'QmTestCid123456789012345678901234567890';
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    IpfsHash: mockCid,
                    PinSize: 1000,
                    Timestamp: new Date().toISOString()
                })
            });

            const blob = new Blob(['test content'], { type: 'text/plain' });
            const cid = await service.upload(blob, 'test-file.txt');

            expect(cid).toBe(mockCid);
        });

        it('should use correct Pinata API endpoint', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ IpfsHash: 'QmTest' })
            });

            const blob = new Blob(['content']);
            await service.upload(blob, 'file.txt');

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.pinata.cloud/pinning/pinFileToIPFS',
                expect.any(Object)
            );
        });

        it('should include Authorization header with JWT', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ IpfsHash: 'QmTest' })
            });

            const blob = new Blob(['content']);
            await service.upload(blob, 'file.txt');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-jwt'
                    })
                })
            );
        });

        it('should use API key headers when no JWT', async () => {
            service = new PinataService({
                apiKey: 'my-api-key',
                apiSecret: 'my-api-secret'
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ IpfsHash: 'QmTest' })
            });

            const blob = new Blob(['content']);
            await service.upload(blob, 'file.txt');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        pinata_api_key: 'my-api-key',
                        pinata_secret_api_key: 'my-api-secret'
                    })
                })
            );
        });

        it('should include file metadata in request', async () => {
            mockFetch.mockImplementation(async (url: string, options: { body: MockFormData }) => {
                const formData = options.body;
                expect(formData.has('file')).toBe(true);
                expect(formData.has('pinataMetadata')).toBe(true);
                expect(formData.has('pinataOptions')).toBe(true);

                return {
                    ok: true,
                    json: async () => ({ IpfsHash: 'QmTest' })
                };
            });

            const blob = new Blob(['content']);
            await service.upload(blob, 'my-file.json');
        });

        it('should throw error on upload failure', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                statusText: 'Unauthorized',
                json: async () => ({ error: 'Invalid API key' })
            });

            const blob = new Blob(['content']);

            await expect(service.upload(blob, 'file.txt')).rejects.toThrow(
                'Pinata upload failed'
            );
        });

        it('should log successful upload', async () => {
            mockLogger.info.mockClear();
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ IpfsHash: 'QmSuccessfulUpload' })
            });

            const blob = new Blob(['content']);
            await service.upload(blob, 'logged-file.txt');

            expect(mockLogger.info).toHaveBeenCalledWith(
                'IPFS upload successful',
                expect.objectContaining({
                    name: 'logged-file.txt',
                    cid: 'QmSuccessfulUpload'
                })
            );
        });

        it('should log upload errors', async () => {
            mockLogger.error.mockClear();
            mockFetch.mockResolvedValueOnce({
                ok: false,
                statusText: 'Error',
                json: async () => ({ error: 'Network error' })
            });

            const blob = new Blob(['content']);

            try {
                await service.upload(blob, 'error-file.txt');
            } catch {
                // Expected to throw
            }

            expect(mockLogger.error).toHaveBeenCalledWith(
                'IPFS upload error',
                expect.objectContaining({
                    name: 'error-file.txt'
                })
            );
        });

        it('should handle network errors', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network unavailable'));

            const blob = new Blob(['content']);

            await expect(service.upload(blob, 'file.txt')).rejects.toThrow(
                'Network unavailable'
            );
        });

        it('should handle large file uploads', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ IpfsHash: 'QmLargeFile' })
            });

            // 10MB blob
            const largeContent = new Array(10 * 1024 * 1024).fill('a').join('');
            const blob = new Blob([largeContent], { type: 'application/octet-stream' });

            const cid = await service.upload(blob, 'large-file.bin');

            expect(cid).toBe('QmLargeFile');
        });
    });

    describe('getGatewayUrl()', () => {
        beforeEach(() => {
            service = new PinataService({ jwt: 'test-jwt' });
        });

        it('should return correct gateway URL format', () => {
            const cid = 'QmTestCid123456789';
            const url = service.getGatewayUrl(cid);

            expect(url).toBe(`https://gateway.pinata.cloud/ipfs/${cid}`);
        });

        it('should handle CIDv0 format', () => {
            const cidV0 = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
            const url = service.getGatewayUrl(cidV0);

            expect(url).toContain(cidV0);
            expect(url.startsWith('https://gateway.pinata.cloud/ipfs/')).toBe(true);
        });

        it('should handle CIDv1 format', () => {
            const cidV1 = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
            const url = service.getGatewayUrl(cidV1);

            expect(url).toContain(cidV1);
        });

        it('should handle empty CID gracefully', () => {
            const url = service.getGatewayUrl('');

            expect(url).toBe('https://gateway.pinata.cloud/ipfs/');
        });
    });

    describe('StorageProvider Interface', () => {
        it('should implement StorageProvider interface', () => {
            service = new PinataService({ jwt: 'test' });

            // Check interface compliance
            expect(typeof service.upload).toBe('function');
            expect(typeof service.getGatewayUrl).toBe('function');
        });

        it('should be usable as StorageProvider type', async () => {
            const provider: StorageProvider = new PinataService({ jwt: 'test' });

            // Type check - these methods should exist
            expect(provider.upload).toBeDefined();
            expect(provider.getGatewayUrl).toBeDefined();
        });
    });

    describe('Error Scenarios', () => {
        beforeEach(() => {
            service = new PinataService({ jwt: 'test-jwt' });
        });

        it('should handle rate limiting (429)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                json: async () => ({ error: 'Rate limit exceeded' })
            });

            const blob = new Blob(['content']);

            await expect(service.upload(blob, 'file.txt')).rejects.toThrow();
        });

        it('should handle server errors (500)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: async () => ({ error: 'Server error' })
            });

            const blob = new Blob(['content']);

            await expect(service.upload(blob, 'file.txt')).rejects.toThrow();
        });

        it('should handle authentication errors (401)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                json: async () => ({ error: 'Invalid credentials' })
            });

            const blob = new Blob(['content']);

            await expect(service.upload(blob, 'file.txt')).rejects.toThrow(
                /Invalid credentials|Pinata upload failed/
            );
        });

        it('should handle timeout errors', async () => {
            mockFetch.mockImplementation(() =>
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), 100)
                )
            );

            const blob = new Blob(['content']);

            await expect(service.upload(blob, 'file.txt')).rejects.toThrow('timeout');
        });

        it('should handle JSON parse errors in error response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                statusText: 'Bad Request',
                json: async () => { throw new Error('Invalid JSON'); }
            });

            const blob = new Blob(['content']);

            // Should still throw, even if error JSON is invalid
            await expect(service.upload(blob, 'file.txt')).rejects.toThrow();
        });
    });

    describe('Metadata Handling', () => {
        beforeEach(() => {
            service = new PinataService({ jwt: 'test-jwt' });
        });

        it('should include app identifier in metadata', async () => {
            let capturedMetadata: string | undefined;

            mockFetch.mockImplementation(async (url: string, options: { body: MockFormData }) => {
                const formData = options.body;
                capturedMetadata = formData.get('pinataMetadata') as string;

                return {
                    ok: true,
                    json: async () => ({ IpfsHash: 'QmTest' })
                };
            });

            const blob = new Blob(['content']);
            await service.upload(blob, 'file.txt');

            expect(capturedMetadata).toBeDefined();
            const metadata = JSON.parse(capturedMetadata!);
            expect(metadata.keyvalues.app).toBe('profile-vault');
        });

        it('should include timestamp in metadata', async () => {
            let capturedMetadata: string | undefined;
            const beforeUpload = Date.now();

            mockFetch.mockImplementation(async (url: string, options: { body: MockFormData }) => {
                const formData = options.body;
                capturedMetadata = formData.get('pinataMetadata') as string;

                return {
                    ok: true,
                    json: async () => ({ IpfsHash: 'QmTest' })
                };
            });

            const blob = new Blob(['content']);
            await service.upload(blob, 'file.txt');

            const metadata = JSON.parse(capturedMetadata!);
            expect(metadata.keyvalues.timestamp).toBeGreaterThanOrEqual(beforeUpload);
        });

        it('should use CIDv1 format', async () => {
            let capturedOptions: string | undefined;

            mockFetch.mockImplementation(async (url: string, options: { body: MockFormData }) => {
                const formData = options.body;
                capturedOptions = formData.get('pinataOptions') as string;

                return {
                    ok: true,
                    json: async () => ({ IpfsHash: 'QmTest' })
                };
            });

            const blob = new Blob(['content']);
            await service.upload(blob, 'file.txt');

            const options = JSON.parse(capturedOptions!);
            expect(options.cidVersion).toBe(1);
        });
    });
});

describe('IPFS Mock Utilities', () => {
    beforeEach(() => {
        mockPinataAPI.reset();
    });

    describe('mockPinataAPI', () => {
        it('should track uploaded content', async () => {
            const content = { test: 'data' };
            await mockPinataAPI.pinJSONToIPFS(content);

            expect(MOCK_IPFS.uploads.length).toBe(1);
            expect(MOCK_IPFS.uploads[0].content).toEqual(content);
        });

        it('should generate unique CIDs', async () => {
            const result1 = await mockPinataAPI.pinJSONToIPFS({ data: 1 });
            const result2 = await mockPinataAPI.pinJSONToIPFS({ data: 2 });

            expect(result1.IpfsHash).not.toBe(result2.IpfsHash);
        });

        it('should store content retrievably', async () => {
            const content = { key: 'value' };
            const result = await mockPinataAPI.pinJSONToIPFS(content);

            expect(MOCK_IPFS.cids.get(result.IpfsHash)).toEqual(content);
        });

        it('should track pins', async () => {
            const result = await mockPinataAPI.pinJSONToIPFS({ data: 'test' });

            expect(MOCK_IPFS.pins.has(result.IpfsHash)).toBe(true);
        });

        it('should support unpin operation', async () => {
            const result = await mockPinataAPI.pinJSONToIPFS({ data: 'test' });
            await mockPinataAPI.unpin(result.IpfsHash);

            expect(MOCK_IPFS.pins.has(result.IpfsHash)).toBe(false);
        });

        it('should list pinned items', async () => {
            await mockPinataAPI.pinJSONToIPFS({ data: 1 });
            await mockPinataAPI.pinJSONToIPFS({ data: 2 });

            const list = await mockPinataAPI.pinList();

            expect(list.rows.length).toBe(2);
        });
    });

    describe('configureIPFSMock', () => {
        it('should configure network delay', async () => {
            configureIPFSMock({ delay: 100 });

            const start = Date.now();
            await mockPinataAPI.pinJSONToIPFS({ data: 'test' });
            const duration = Date.now() - start;

            expect(duration).toBeGreaterThanOrEqual(100);
        });

        it('should configure failure mode', async () => {
            configureIPFSMock({ shouldFail: true });

            await expect(mockPinataAPI.pinJSONToIPFS({ data: 'test' })).rejects.toThrow(
                'Pinata upload failed'
            );
        });

        it('should configure failure rate', async () => {
            configureIPFSMock({ failureRate: 0.5 });

            // With 50% failure rate, running multiple times should see some failures
            let failures = 0;
            let successes = 0;

            for (let i = 0; i < 20; i++) {
                try {
                    await mockPinataAPI.pinJSONToIPFS({ data: i });
                    successes++;
                } catch {
                    failures++;
                }
            }

            // With 50% rate, we should see both successes and failures
            // (statistically, this could fail but is very unlikely with 20 tries)
            expect(failures).toBeGreaterThan(0);
            expect(successes).toBeGreaterThan(0);
        });
    });
});
