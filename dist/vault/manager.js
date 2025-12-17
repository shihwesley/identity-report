/**
 * Vault Manager
 *
 * High-level manager for the user's Profile Vault.
 * Integrates identity, encryption, and storage systems.
 */
import { generateMnemonic, validateMnemonic, createWalletIdentity, deriveEncryptionKey, signAccessGrant } from './identity';
import { encryptData, decryptData } from './crypto';
import { storage } from '@/lib/storage/indexeddb';
export class VaultManager {
    constructor() {
        this.keys = null;
        this.encryptionKey = null;
        this._state = {
            status: 'locked',
            did: null,
            profile: null,
            lastSynced: null,
            stats: {
                totalConversations: 0,
                totalMemories: 0,
                totalInsights: 0,
                providers: []
            }
        };
    }
    /**
     * Initialize with valid keys for demo purposes so interaction works immediately.
     */
    async initializeDemoMode() {
        if (this.keys)
            return; // Already initialized
        console.log('Initializing Vault Demo Mode...');
        const mnemonic = generateMnemonic();
        const { identity, keys } = await createWalletIdentity(mnemonic);
        this.keys = keys;
        this._state.did = identity.did;
        // Mock profile if needed, or keeping existing structure
        if (!this._state.profile) {
            this._state.profile = this.createEmptyProfile(identity.did);
        }
        this._state.status = 'unlocked';
    }
    get state() {
        return this._state;
    }
    get isUnlocked() {
        return this._state.status === 'unlocked';
    }
    get did() {
        return this._state.did;
    }
    // --- Wallet Creation & Recovery ---
    /**
     * Create a new wallet with a fresh mnemonic.
     * Returns the mnemonic which user MUST save for recovery.
     */
    async createNewWallet() {
        const mnemonic = generateMnemonic();
        const { identity, keys } = await createWalletIdentity(mnemonic);
        this.keys = keys;
        this._state.did = identity.did;
        // Save identity to storage
        await storage.saveIdentity(identity);
        return mnemonic;
    }
    /**
     * Restore wallet from mnemonic phrase.
     */
    async restoreFromMnemonic(mnemonic) {
        if (!validateMnemonic(mnemonic)) {
            throw new Error('Invalid mnemonic phrase');
        }
        const { identity, keys } = await createWalletIdentity(mnemonic);
        this.keys = keys;
        this._state.did = identity.did;
        // Save identity
        await storage.saveIdentity(identity);
        return true;
    }
    /**
     * Check if a wallet already exists.
     */
    async hasExistingWallet() {
        const identity = await storage.loadIdentity();
        return identity !== null;
    }
    /**
     * Load existing wallet identity (without unlocking).
     */
    async loadIdentity() {
        const identity = await storage.loadIdentity();
        if (identity) {
            this._state.did = identity.did;
        }
        return identity;
    }
    // --- Vault Lock/Unlock ---
    /**
     * Unlock the vault with password.
     * Password + mnemonic-derived key = full encryption key.
     */
    async unlock(mnemonic, password) {
        if (!validateMnemonic(mnemonic)) {
            throw new Error('Invalid mnemonic phrase');
        }
        this._state.status = 'syncing';
        try {
            // Derive keys from mnemonic
            const { identity, keys } = await createWalletIdentity(mnemonic);
            this.keys = keys;
            this._state.did = identity.did;
            // Derive encryption key from private key + password
            this.encryptionKey = await deriveEncryptionKey(keys.privateKey, password);
            // Try to load and decrypt existing vault
            const encryptedVault = await storage.loadEncryptedVault();
            if (encryptedVault) {
                // Decrypt existing profile
                const decryptedJson = await decryptData(encryptedVault.ciphertext, encryptedVault.iv, this.encryptionKey);
                this._state.profile = JSON.parse(decryptedJson);
            }
            else {
                // Create new empty profile
                this._state.profile = this.createEmptyProfile(identity.did);
            }
            // Load additional data from storage
            await this.loadFromStorage();
            this._state.status = 'unlocked';
            this._state.lastSynced = Date.now();
            this.updateStats();
            return this._state.profile;
        }
        catch (error) {
            this._state.status = 'locked';
            throw error;
        }
    }
    /**
     * Lock the vault (encrypt and save).
     */
    async lock() {
        if (!this.encryptionKey || !this._state.profile) {
            throw new Error('Vault is not unlocked');
        }
        this._state.status = 'syncing';
        try {
            // Encrypt the profile
            const profileJson = JSON.stringify(this._state.profile);
            const { ciphertext, iv } = await encryptData(profileJson, this.encryptionKey);
            const encryptedProfile = {
                metadata: {
                    ownerDid: this._state.did,
                    createdAt: Date.now(),
                    lastModified: Date.now(),
                    version: 1
                },
                ciphertext,
                iv,
                salt: '' // Salt is derived from private key in our implementation
            };
            // Save to storage
            await storage.saveEncryptedVault(encryptedProfile);
            // Clear sensitive data from memory
            this.keys = null;
            this.encryptionKey = null;
            this._state.profile = null;
            this._state.status = 'locked';
        }
        catch (error) {
            this._state.status = 'unlocked';
            throw error;
        }
    }
    // --- Data Operations ---
    /**
     * Import conversations from a provider.
     */
    async importConversations(conversations, memories) {
        if (!this._state.profile) {
            throw new Error('Vault is not unlocked');
        }
        // Add conversations
        for (const conv of conversations) {
            // Check for duplicates by title + provider + date
            const exists = this._state.profile.conversations.some(c => c.title === conv.title &&
                c.metadata.provider === conv.metadata.provider &&
                Math.abs(c.metadata.createdAt - conv.metadata.createdAt) < 60000);
            if (!exists) {
                this._state.profile.conversations.push(conv);
                await storage.saveConversation(conv);
            }
        }
        // Add memories
        for (const memory of memories) {
            this._state.profile.longTermMemory.push(memory);
            await storage.saveMemory(memory);
        }
        this.updateStats();
    }
    /**
     * Add a single memory fragment.
     */
    async addMemory(memory) {
        if (!this._state.profile) {
            throw new Error('Vault is not unlocked');
        }
        this._state.profile.shortTermMemory.push(memory);
        await storage.saveMemory(memory);
        // Rotate to long-term if needed
        if (this._state.profile.shortTermMemory.length > 50) {
            const toMove = this._state.profile.shortTermMemory.splice(0, 30);
            this._state.profile.longTermMemory.push(...toMove);
        }
        this.updateStats();
    }
    /**
     * Search memories.
     */
    async searchMemories(query) {
        return storage.searchMemories(query);
    }
    /**
     * Get all conversations.
     */
    async getConversations() {
        if (this._state.profile) {
            return this._state.profile.conversations;
        }
        return storage.getAllConversations();
    }
    /**
     * Export vault as portable JSON.
     */
    async exportPortable() {
        if (!this._state.profile) {
            throw new Error('Vault is not unlocked');
        }
        return JSON.stringify({
            version: 1,
            exportedAt: new Date().toISOString(),
            did: this._state.did,
            profile: this._state.profile
        }, null, 2);
    }
    /**
     * Export encrypted vault for backup (legacy JSON string).
     */
    async exportEncrypted() {
        return storage.exportAll();
    }
    /**
     * Export complete vault as downloadable .pvault file.
     * This is the main portable backup that can be taken anywhere.
     * The file is already encrypted - safe to store in cloud/email.
     */
    async exportVaultBackup() {
        const data = await storage.exportAll();
        const blob = new Blob([data], { type: 'application/json' });
        const date = new Date().toISOString().slice(0, 10);
        const filename = `profile-vault-${date}.pvault`;
        return { blob, filename };
    }
    /**
     * Trigger download of vault backup in browser.
     */
    async downloadVaultBackup() {
        const { blob, filename } = await this.exportVaultBackup();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    /**
     * Import vault from a .pvault backup file.
     * After import, user still needs to unlock with mnemonic + password.
     */
    async importVaultBackup(file) {
        const data = await file.text();
        try {
            const parsed = JSON.parse(data);
            // Validate it's a vault backup
            if (!parsed.version || !parsed.identity) {
                throw new Error('Invalid vault backup file');
            }
            await storage.importAll(data);
            return {
                success: true,
                stats: {
                    conversations: parsed.conversations?.length || 0,
                    memories: parsed.memories?.length || 0,
                    blobs: parsed.blobs?.length || 0
                }
            };
        }
        catch (e) {
            throw new Error(`Failed to import vault: ${e.message}`);
        }
    }
    // --- Cloud Sync (IPFS + Blockchain) ---
    /**
     * Sync the current vault to Decentralized Storage.
     * 1. Export encrypted vault
     * 2. Upload to IPFS (Pinata)
     * 3. Update DID Registry (Blockchain)
     */
    async syncToCloud(config) {
        if (!this._state.profile || !this._state.did) {
            throw new Error('Vault is not unlocked or missing DID');
        }
        const { PinataService } = await import('@/lib/services/ipfs');
        const { MockRegistryService } = await import('@/lib/services/registry');
        const ipfs = new PinataService({ jwt: config.pinataJwt });
        const registry = new MockRegistryService(); // Using Mock for now
        // 1. Get Encrypted Blob
        const { blob, filename } = await this.exportVaultBackup();
        // 2. Upload to IPFS
        console.log('Uploading vault to IPFS...');
        const cid = await ipfs.upload(blob, filename);
        console.log('Vault uploaded. CID:', cid);
        // 3. Update Registry
        console.log('Updating Blockchain Registry...');
        const txHash = await registry.updateProfile(this._state.did, cid);
        console.log('Registry updated. Tx:', txHash);
        return { cid, txHash };
    }
    /**
     * Restore vault from Decentralized Storage.
     */
    async restoreFromCloud(did) {
        const { MockRegistryService } = await import('@/lib/services/registry');
        const { PinataService } = await import('@/lib/services/ipfs');
        const registry = new MockRegistryService();
        const ipfs = new PinataService({}); // No auth needed for reading gateway usually
        // 1. Resolve DID to CID
        const cid = await registry.getProfileCid(did);
        if (!cid) {
            throw new Error('No profile found for this DID');
        }
        // 2. Download from IPFS
        const url = ipfs.getGatewayUrl(cid);
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error('Failed to fetch vault from IPFS');
        }
        // 3. Import
        const blob = await res.blob();
        const file = new File([blob], 'restored.pvault', { type: 'application/json' });
        const result = await this.importVaultBackup(file);
        return result.success;
    }
    // --- Access Control ---
    /**
     * Create a cryptographically signed access grant.
     */
    async grantAccess(grantee, permissions, durationSeconds) {
        if (!this.keys || !this._state.profile) {
            throw new Error('Vault is not unlocked');
        }
        const grant = {
            id: `grant_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            grantee,
            permissions,
            expiresAt: Date.now() + (durationSeconds * 1000),
        };
        const signedGrant = await signAccessGrant(grant, this.keys.privateKey);
        // Persist the grant
        this._state.profile.activeGrants.push(signedGrant);
        // We need a way to save just the profile or grants part.
        // For now, we will rely on the fact that 'lock()' saves everything, 
        // OR we should add a specific save method. 
        // Given existing methods, 'lock()' is too heavy (locks it).
        // Let's assume we implement a specific save, or just keep in memory until lock/export for this demo.
        // Actually, storage.saveEncryptedVault saves the WHOLE profile encrypted.
        // We probably won't re-encrypt automatically on every grant for performance in this demo.
        // So in-memory update is fine until the user clicks "Lock" or "Export".
        return signedGrant;
    }
    // --- Private Methods ---
    createEmptyProfile(did) {
        return {
            identity: {
                displayName: 'User',
                fullName: '',
                email: '',
                location: '',
                role: ''
            },
            preferences: [],
            shortTermMemory: [],
            longTermMemory: [],
            projects: [],
            conversations: [],
            insights: [],
            activeGrants: []
        };
    }
    async loadFromStorage() {
        if (!this._state.profile)
            return;
        // Load conversations from storage
        const conversations = await storage.getAllConversations();
        this._state.profile.conversations = conversations;
        // Load memories
        const memories = await storage.getAllMemories();
        // Distribute between short-term and long-term
        this._state.profile.shortTermMemory = memories.slice(-50);
        this._state.profile.longTermMemory = memories.slice(0, -50);
        // Load insights
        const insights = await storage.getAllInsights();
        this._state.profile.insights = insights;
    }
    updateStats() {
        if (!this._state.profile)
            return;
        const providers = new Set();
        for (const conv of this._state.profile.conversations) {
            if (conv.metadata.provider) {
                providers.add(conv.metadata.provider);
            }
        }
        this._state.stats = {
            totalConversations: this._state.profile.conversations.length,
            totalMemories: this._state.profile.shortTermMemory.length + this._state.profile.longTermMemory.length,
            totalInsights: this._state.profile.insights.length,
            providers: Array.from(providers)
        };
    }
}
// Singleton instance
export const vault = new VaultManager();
