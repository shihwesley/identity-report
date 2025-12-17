/**
 * IndexedDB Storage Backend
 * 
 * Stores the encrypted vault and decrypted session data in the browser's IndexedDB.
 * This is the primary storage method for the wallet - similar to how MetaMask stores data.
 */

import { StorageBackend } from './interface';
import { EncryptedProfile, PortableProfile, Conversation, MemoryFragment, UserInsight } from '@/lib/types';
import { WalletIdentity } from '@/lib/vault/identity';
import { EncryptedBlob } from '@/lib/vault/crypto';

const DB_NAME = 'profile-vault';
const DB_VERSION = 2; // Bumped version for new BLOBS store

// Store names
const STORES = {
    IDENTITY: 'identity',
    VAULT: 'vault',
    CONVERSATIONS: 'conversations',
    MEMORIES: 'memories',
    INSIGHTS: 'insights',
    SESSION: 'session',
    BLOBS: 'blobs'
} as const;

class IndexedDBStorage implements StorageBackend {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;

    private async getDB(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        if (!this.initPromise) {
            this.initPromise = this.initDB();
        }

        await this.initPromise;
        return this.db!;
    }

    private initDB(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Identity store (single record)
                if (!db.objectStoreNames.contains(STORES.IDENTITY)) {
                    db.createObjectStore(STORES.IDENTITY, { keyPath: 'did' });
                }

                // Encrypted vault store (single record)
                if (!db.objectStoreNames.contains(STORES.VAULT)) {
                    db.createObjectStore(STORES.VAULT, { keyPath: 'metadata.ownerDid' });
                }

                // Conversations store
                if (!db.objectStoreNames.contains(STORES.CONVERSATIONS)) {
                    const convStore = db.createObjectStore(STORES.CONVERSATIONS, { keyPath: 'id' });
                    convStore.createIndex('provider', 'metadata.provider', { unique: false });
                    convStore.createIndex('createdAt', 'metadata.createdAt', { unique: false });
                }

                // Memories store with full-text search index
                if (!db.objectStoreNames.contains(STORES.MEMORIES)) {
                    const memStore = db.createObjectStore(STORES.MEMORIES, { keyPath: 'id' });
                    memStore.createIndex('type', 'type', { unique: false });
                    memStore.createIndex('timestamp', 'timestamp', { unique: false });
                    memStore.createIndex('conversationId', 'conversationId', { unique: false });
                }

                // Insights store
                if (!db.objectStoreNames.contains(STORES.INSIGHTS)) {
                    const insightStore = db.createObjectStore(STORES.INSIGHTS, { keyPath: 'id' });
                    insightStore.createIndex('category', 'category', { unique: false });
                }

                // Session store (for decrypted profile during active session)
                if (!db.objectStoreNames.contains(STORES.SESSION)) {
                    db.createObjectStore(STORES.SESSION, { keyPath: 'key' });
                }

                // Blobs store (for encrypted media files)
                if (!db.objectStoreNames.contains(STORES.BLOBS)) {
                    const blobStore = db.createObjectStore(STORES.BLOBS, { keyPath: 'id' });
                    blobStore.createIndex('type', 'type', { unique: false });
                }
            };
        });
    }

    // --- Identity Operations ---

    async saveIdentity(identity: WalletIdentity): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.IDENTITY, 'readwrite');
            tx.objectStore(STORES.IDENTITY).put(identity);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async loadIdentity(): Promise<WalletIdentity | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.IDENTITY, 'readonly');
            const request = tx.objectStore(STORES.IDENTITY).getAll();
            request.onsuccess = () => resolve(request.result[0] || null);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteIdentity(): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.IDENTITY, 'readwrite');
            tx.objectStore(STORES.IDENTITY).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // --- Encrypted Vault Operations ---

    async saveEncryptedVault(vault: EncryptedProfile): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.VAULT, 'readwrite');
            tx.objectStore(STORES.VAULT).put(vault);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async loadEncryptedVault(): Promise<EncryptedProfile | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.VAULT, 'readonly');
            const request = tx.objectStore(STORES.VAULT).getAll();
            request.onsuccess = () => resolve(request.result[0] || null);
            request.onerror = () => reject(request.error);
        });
    }

    // --- Session Profile Operations ---

    async saveProfile(profile: PortableProfile): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.SESSION, 'readwrite');
            tx.objectStore(STORES.SESSION).put({ key: 'profile', data: profile });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async loadProfile(): Promise<PortableProfile | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.SESSION, 'readonly');
            const request = tx.objectStore(STORES.SESSION).get('profile');
            request.onsuccess = () => resolve(request.result?.data || null);
            request.onerror = () => reject(request.error);
        });
    }

    // --- Conversation Operations ---

    async saveConversation(conversation: Conversation): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.CONVERSATIONS, 'readwrite');
            tx.objectStore(STORES.CONVERSATIONS).put(conversation);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getConversation(id: string): Promise<Conversation | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.CONVERSATIONS, 'readonly');
            const request = tx.objectStore(STORES.CONVERSATIONS).get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllConversations(): Promise<Conversation[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.CONVERSATIONS, 'readonly');
            const request = tx.objectStore(STORES.CONVERSATIONS).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteConversation(id: string): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.CONVERSATIONS, 'readwrite');
            tx.objectStore(STORES.CONVERSATIONS).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // --- Memory Operations ---

    async saveMemory(memory: MemoryFragment): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.MEMORIES, 'readwrite');
            tx.objectStore(STORES.MEMORIES).put(memory);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async searchMemories(query: string): Promise<MemoryFragment[]> {
        const all = await this.getAllMemories();
        const lowerQuery = query.toLowerCase();

        // Simple keyword search - production would use a proper full-text index
        return all.filter(memory =>
            memory.content.toLowerCase().includes(lowerQuery) ||
            memory.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }

    async getAllMemories(): Promise<MemoryFragment[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.MEMORIES, 'readonly');
            const request = tx.objectStore(STORES.MEMORIES).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // --- Insight Operations ---

    async saveInsight(insight: UserInsight): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.INSIGHTS, 'readwrite');
            tx.objectStore(STORES.INSIGHTS).put(insight);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getAllInsights(): Promise<UserInsight[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.INSIGHTS, 'readonly');
            const request = tx.objectStore(STORES.INSIGHTS).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // --- Blob Operations ---

    async saveBlob(blob: EncryptedBlob): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.BLOBS, 'readwrite');
            tx.objectStore(STORES.BLOBS).put(blob);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getBlob(id: string): Promise<EncryptedBlob | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.BLOBS, 'readonly');
            const request = tx.objectStore(STORES.BLOBS).get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllBlobs(): Promise<EncryptedBlob[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.BLOBS, 'readonly');
            const request = tx.objectStore(STORES.BLOBS).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteBlob(id: string): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.BLOBS, 'readwrite');
            tx.objectStore(STORES.BLOBS).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // --- Bulk Operations ---

    async exportAll(): Promise<string> {
        const [conversations, memories, insights, identity, vault, blobs] = await Promise.all([
            this.getAllConversations(),
            this.getAllMemories(),
            this.getAllInsights(),
            this.loadIdentity(),
            this.loadEncryptedVault(),
            this.getAllBlobs()
        ]);

        return JSON.stringify({
            version: 2,
            exportedAt: Date.now(),
            identity,
            vault,
            conversations,
            memories,
            insights,
            blobs
        }, null, 2);
    }

    async importAll(data: string): Promise<void> {
        const parsed = JSON.parse(data);

        if (parsed.identity) {
            await this.saveIdentity(parsed.identity);
        }

        if (parsed.vault) {
            await this.saveEncryptedVault(parsed.vault);
        }

        if (parsed.conversations) {
            for (const conv of parsed.conversations) {
                await this.saveConversation(conv);
            }
        }

        if (parsed.memories) {
            for (const mem of parsed.memories) {
                await this.saveMemory(mem);
            }
        }

        if (parsed.insights) {
            for (const insight of parsed.insights) {
                await this.saveInsight(insight);
            }
        }

        if (parsed.blobs) {
            for (const blob of parsed.blobs) {
                await this.saveBlob(blob);
            }
        }
    }

    async clearAll(): Promise<void> {
        const db = await this.getDB();
        const storeNames = Object.values(STORES);

        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeNames, 'readwrite');
            for (const store of storeNames) {
                tx.objectStore(store).clear();
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
}

// Singleton instance
export const storage = new IndexedDBStorage();
