import { createPublicClient, http, type Address } from 'viem';
import { polygon } from 'viem/chains';

export interface RegistryProvider {
    updateProfile(did: string, cid: string): Promise<string>; // Returns TxHash
    getProfileCid(did: string): Promise<string | null>;
}

/**
 * Mock Registry Service
 * Simulates blockchain interactions for development without gas fees.
 */
export class MockRegistryService implements RegistryProvider {
    private storage: Map<string, string> = new Map();
    private latency: number = 1000;

    constructor() {
        // Hydrate from localStorage if available (Mock persistence)
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('mock_registry_state');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    this.storage = new Map(Object.entries(parsed));
                } catch (e) {
                    console.error('Failed to load mock registry state', e);
                }
            }
        }
    }

    private saveState() {
        if (typeof window !== 'undefined') {
            const obj = Object.fromEntries(this.storage.entries());
            localStorage.setItem('mock_registry_state', JSON.stringify(obj));
        }
    }

    async updateProfile(did: string, cid: string): Promise<string> {
        console.log(`[Blockchain Mock] Sending transaction to update DID ${did} -> CID ${cid}`);

        await new Promise(resolve => setTimeout(resolve, this.latency));

        this.storage.set(did, cid);
        this.saveState();

        const fakeTxHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
        console.log(`[Blockchain Mock] Transaction confirmed: ${fakeTxHash}`);

        return fakeTxHash;
    }

    async getProfileCid(did: string): Promise<string | null> {
        await new Promise(resolve => setTimeout(resolve, 500));
        return this.storage.get(did) || null;
    }
}

// --- ABI for ProfileRegistry ---
const REGISTRY_ABI = [
    {
        "inputs": [{ "internalType": "string", "name": "cid", "type": "string" }],
        "name": "updateProfile",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
        "name": "getProfile",
        "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
            { "indexed": false, "internalType": "string", "name": "cid", "type": "string" }
        ],
        "name": "ProfileUpdated",
        "type": "event"
    }
] as const;

import { createWalletClient, custom } from 'viem';

/**
 * Real Registry Service using Polygon (Amoy Testnet)
 */
export class PolygonRegistryService implements RegistryProvider {
    private publicClient: ReturnType<typeof createPublicClient>;
    private contractAddress: Address;

    constructor() {
        const chain = polygon; // Default to Polygon Mainnet structure, override RPC for Amoy
        const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc-amoy.polygon.technology';
        const contractAddr = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;

        if (!contractAddr) {
            console.warn('⚠️ Registry Contract Address not set. Registry lookups will fail.');
        }

        this.contractAddress = (contractAddr as Address) || '0x0000000000000000000000000000000000000000';

        this.publicClient = createPublicClient({
            chain: chain,
            transport: http(rpcUrl)
        });
    }

    async updateProfile(did: string, cid: string): Promise<string> {
        // For writing, we need a wallet (e.g., window.ethereum or a local private key)
        // Since this is running in an MCP environment (Node.js), we might not have window.ethereum.
        // We'll support PRIVATE_KEY env var for server-side updates, or throw if client-side.

        const privateKey = process.env.PRIVATE_KEY;

        if (privateKey) {
            // Server-side write
            const { privateKeyToAccount } = await import('viem/accounts');
            const account = privateKeyToAccount(privateKey as `0x${string}`);
            const { createWalletClient, http } = await import('viem');

            const wallet = createWalletClient({
                account,
                chain: polygon,
                transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc-amoy.polygon.technology')
            });

            console.log(`[Registry] Updating profile for ${account.address} to CID: ${cid}`);
            const hash = await wallet.writeContract({
                address: this.contractAddress,
                abi: REGISTRY_ABI,
                functionName: 'updateProfile',
                args: [cid]
            });

            return hash;
        } else {
            throw new Error("Writing to registry requires PRIVATE_KEY environment variable (Server Mode) or Wallet Connection (Client Mode - Not implemented for Node.js MCP).");
        }
    }

    async getProfileCid(did: string): Promise<string | null> {
        // did is expected to be an EVM address here (e.g. 0x123...)
        // If it's a DID (did:pkh:eip155:1:0x...), we extract the address.
        const address = did.startsWith('did:') ? did.split(':').pop() as Address : did as Address;

        try {
            const cid = await this.publicClient.readContract({
                address: this.contractAddress,
                abi: REGISTRY_ABI,
                functionName: 'getProfile',
                args: [address]
            });

            return cid ? cid : null;
        } catch (error) {
            console.error('[Registry] Read Error:', error);
            return null;
        }
    }
}
