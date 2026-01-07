/**
 * Multi-Service IPFS Pinning
 *
 * Pins content to multiple IPFS pinning services for redundancy.
 * Requires 2 of 3 services to succeed for a successful sync.
 */

// ============================================================
// Types
// ============================================================

export interface PinningResult {
    service: string;
    success: boolean;
    cid?: string;
    error?: string;
    durationMs?: number;
}

export interface PinningConfig {
    requiredSuccessCount: number;
    timeoutMs: number;
    healthCheckIntervalMs: number;
}

export interface ServiceCredentials {
    pinata?: {
        jwt: string;
    };
    infura?: {
        projectId: string;
        projectSecret: string;
    };
    web3storage?: {
        token: string;
    };
}

interface ServiceHealth {
    isHealthy: boolean;
    lastCheck: number;
    consecutiveFailures: number;
}

// ============================================================
// Constants
// ============================================================

export const DEFAULT_PINNING_CONFIG: PinningConfig = {
    requiredSuccessCount: 2,
    timeoutMs: 30000,
    healthCheckIntervalMs: 60000
};

const MAX_CONSECUTIVE_FAILURES = 3;

// ============================================================
// Base Pinning Service
// ============================================================

export abstract class PinningService {
    abstract readonly name: string;
    protected health: ServiceHealth = {
        isHealthy: true,
        lastCheck: 0,
        consecutiveFailures: 0
    };
    protected config: PinningConfig;

    constructor(config: Partial<PinningConfig> = {}) {
        this.config = { ...DEFAULT_PINNING_CONFIG, ...config };
    }

    async isHealthy(): Promise<boolean> {
        const now = Date.now();

        // Use cached health if recent
        if (now - this.health.lastCheck < this.config.healthCheckIntervalMs) {
            return this.health.isHealthy;
        }

        // Perform health check
        try {
            const healthy = await this.checkHealth();
            this.health = {
                isHealthy: healthy,
                lastCheck: now,
                consecutiveFailures: healthy ? 0 : this.health.consecutiveFailures + 1
            };
            return healthy;
        } catch {
            this.health.consecutiveFailures++;
            this.health.isHealthy = this.health.consecutiveFailures < MAX_CONSECUTIVE_FAILURES;
            this.health.lastCheck = now;
            return this.health.isHealthy;
        }
    }

    markUnhealthy(): void {
        this.health.consecutiveFailures++;
        this.health.isHealthy = false;
    }

    markHealthy(): void {
        this.health.consecutiveFailures = 0;
        this.health.isHealthy = true;
    }

    abstract pin(data: unknown): Promise<string>;
    abstract unpin(cid: string): Promise<void>;
    abstract checkHealth(): Promise<boolean>;
}

// ============================================================
// Pinata Service
// ============================================================

export class PinataService extends PinningService {
    readonly name = 'Pinata';
    private jwt: string;

    constructor(jwt: string, config?: Partial<PinningConfig>) {
        super(config);
        this.jwt = jwt;
    }

    async pin(data: unknown): Promise<string> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

        try {
            const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.jwt}`
                },
                body: JSON.stringify({
                    pinataContent: data,
                    pinataMetadata: {
                        name: `identity-report-${Date.now()}`
                    }
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Pinata error ${response.status}: ${error}`);
            }

            const result = await response.json();
            this.markHealthy();
            return result.IpfsHash;
        } catch (error) {
            this.markUnhealthy();
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    async unpin(cid: string): Promise<void> {
        const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.jwt}`
            }
        });

        if (!response.ok && response.status !== 404) {
            throw new Error(`Pinata unpin error: ${response.status}`);
        }
    }

    async checkHealth(): Promise<boolean> {
        try {
            const response = await fetch('https://api.pinata.cloud/data/testAuthentication', {
                headers: {
                    'Authorization': `Bearer ${this.jwt}`
                }
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}

// ============================================================
// Infura IPFS Service
// ============================================================

export class InfuraService extends PinningService {
    readonly name = 'Infura';
    private projectId: string;
    private projectSecret: string;

    constructor(projectId: string, projectSecret: string, config?: Partial<PinningConfig>) {
        super(config);
        this.projectId = projectId;
        this.projectSecret = projectSecret;
    }

    private get authHeader(): string {
        const auth = btoa(`${this.projectId}:${this.projectSecret}`);
        return `Basic ${auth}`;
    }

    async pin(data: unknown): Promise<string> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

        try {
            // Infura uses form data
            const formData = new FormData();
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            formData.append('file', blob, 'data.json');

            const response = await fetch('https://ipfs.infura.io:5001/api/v0/add?pin=true', {
                method: 'POST',
                headers: {
                    'Authorization': this.authHeader
                },
                body: formData,
                signal: controller.signal
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Infura error ${response.status}: ${error}`);
            }

            const result = await response.json();
            this.markHealthy();
            return result.Hash;
        } catch (error) {
            this.markUnhealthy();
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    async unpin(cid: string): Promise<void> {
        const response = await fetch(`https://ipfs.infura.io:5001/api/v0/pin/rm?arg=${cid}`, {
            method: 'POST',
            headers: {
                'Authorization': this.authHeader
            }
        });

        if (!response.ok && response.status !== 500) {
            // 500 often means "not pinned" which is fine
            throw new Error(`Infura unpin error: ${response.status}`);
        }
    }

    async checkHealth(): Promise<boolean> {
        try {
            const response = await fetch('https://ipfs.infura.io:5001/api/v0/version', {
                method: 'POST',
                headers: {
                    'Authorization': this.authHeader
                }
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}

// ============================================================
// Web3.Storage Service
// ============================================================

export class Web3StorageService extends PinningService {
    readonly name = 'Web3Storage';
    private token: string;

    constructor(token: string, config?: Partial<PinningConfig>) {
        super(config);
        this.token = token;
    }

    async pin(data: unknown): Promise<string> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

        try {
            // Web3.Storage expects files
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });

            const response = await fetch('https://api.web3.storage/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'X-Name': `identity-report-${Date.now()}`
                },
                body: blob,
                signal: controller.signal
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Web3Storage error ${response.status}: ${error}`);
            }

            const result = await response.json();
            this.markHealthy();
            return result.cid;
        } catch (error) {
            this.markUnhealthy();
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    async unpin(_cid: string): Promise<void> {
        // Web3.Storage doesn't support unpinning in the same way
        // Content is stored permanently
        console.warn('Web3Storage does not support unpinning');
    }

    async checkHealth(): Promise<boolean> {
        try {
            const response = await fetch('https://api.web3.storage/user/account', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}

// ============================================================
// Multi-Service Pinning Manager
// ============================================================

export class PinningManager {
    private services: PinningService[] = [];
    private config: PinningConfig;

    constructor(config: Partial<PinningConfig> = {}) {
        this.config = { ...DEFAULT_PINNING_CONFIG, ...config };
    }

    /**
     * Initialize services from credentials.
     */
    initializeServices(credentials: ServiceCredentials): void {
        this.services = [];

        if (credentials.pinata?.jwt) {
            this.services.push(new PinataService(credentials.pinata.jwt, this.config));
        }

        if (credentials.infura?.projectId && credentials.infura?.projectSecret) {
            this.services.push(new InfuraService(
                credentials.infura.projectId,
                credentials.infura.projectSecret,
                this.config
            ));
        }

        if (credentials.web3storage?.token) {
            this.services.push(new Web3StorageService(credentials.web3storage.token, this.config));
        }
    }

    /**
     * Add a custom pinning service.
     */
    addService(service: PinningService): void {
        this.services.push(service);
    }

    /**
     * Get count of configured services.
     */
    getServiceCount(): number {
        return this.services.length;
    }

    /**
     * Pin data to multiple services.
     * Returns results from all services.
     */
    async pinToAll(data: unknown): Promise<{
        results: PinningResult[];
        cid: string | null;
        success: boolean;
    }> {
        if (this.services.length === 0) {
            return {
                results: [],
                cid: null,
                success: false
            };
        }

        // Check health first and filter healthy services
        const healthChecks = await Promise.all(
            this.services.map(async service => ({
                service,
                healthy: await service.isHealthy()
            }))
        );

        const healthyServices = healthChecks
            .filter(h => h.healthy)
            .map(h => h.service);

        if (healthyServices.length < this.config.requiredSuccessCount) {
            return {
                results: healthChecks.map(h => ({
                    service: h.service.name,
                    success: false,
                    error: h.healthy ? 'Not attempted' : 'Service unhealthy'
                })),
                cid: null,
                success: false
            };
        }

        // Pin to all healthy services in parallel
        const results = await Promise.all(
            healthyServices.map(async service => {
                const startTime = Date.now();
                try {
                    const cid = await service.pin(data);
                    return {
                        service: service.name,
                        success: true,
                        cid,
                        durationMs: Date.now() - startTime
                    };
                } catch (error) {
                    return {
                        service: service.name,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        durationMs: Date.now() - startTime
                    };
                }
            })
        );

        // Add results for skipped unhealthy services
        for (const check of healthChecks) {
            if (!check.healthy) {
                results.push({
                    service: check.service.name,
                    success: false,
                    error: 'Service unhealthy - skipped',
                    durationMs: 0
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const success = successCount >= this.config.requiredSuccessCount;

        // Get CID from first successful pin
        const cid = results.find(r => r.success)?.cid ?? null;

        return { results, cid, success };
    }

    /**
     * Unpin from all services (best effort).
     */
    async unpinFromAll(cid: string): Promise<void> {
        await Promise.allSettled(
            this.services.map(service => service.unpin(cid))
        );
    }

    /**
     * Get health status of all services.
     */
    async getHealthStatus(): Promise<Array<{ service: string; healthy: boolean }>> {
        const results = await Promise.all(
            this.services.map(async service => ({
                service: service.name,
                healthy: await service.isHealthy()
            }))
        );
        return results;
    }
}

// ============================================================
// Singleton Instance
// ============================================================

let pinningManagerInstance: PinningManager | null = null;

export function getPinningManager(config?: Partial<PinningConfig>): PinningManager {
    if (!pinningManagerInstance) {
        pinningManagerInstance = new PinningManager(config);
    }
    return pinningManagerInstance;
}

export function resetPinningManager(): void {
    pinningManagerInstance = null;
}
