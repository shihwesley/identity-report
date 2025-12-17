/**
 * Storage Interface
 * 
 * Abstract interface for vault storage backends.
 * Allows swapping between IndexedDB, IPFS, or other storage systems.
 */

import { EncryptedProfile, PortableProfile, Conversation, MemoryFragment, UserInsight } from '@/lib/types';
import { WalletIdentity } from '@/lib/vault/identity';
import { EncryptedBlob } from '@/lib/vault/crypto';

export interface StorageBackend {
    // Identity operations
    saveIdentity(identity: WalletIdentity): Promise<void>;
    loadIdentity(): Promise<WalletIdentity | null>;
    deleteIdentity(): Promise<void>;

    // Encrypted vault operations  
    saveEncryptedVault(vault: EncryptedProfile): Promise<void>;
    loadEncryptedVault(): Promise<EncryptedProfile | null>;

    // Decrypted data operations (for active session)
    saveProfile(profile: PortableProfile): Promise<void>;
    loadProfile(): Promise<PortableProfile | null>;

    // Conversation-specific operations
    saveConversation(conversation: Conversation): Promise<void>;
    getConversation(id: string): Promise<Conversation | null>;
    getAllConversations(): Promise<Conversation[]>;
    deleteConversation(id: string): Promise<void>;

    // Memory operations  
    saveMemory(memory: MemoryFragment): Promise<void>;
    searchMemories(query: string): Promise<MemoryFragment[]>;
    getAllMemories(): Promise<MemoryFragment[]>;

    // Insight operations
    saveInsight(insight: UserInsight): Promise<void>;
    getAllInsights(): Promise<UserInsight[]>;

    // Blob operations (encrypted media files)
    saveBlob(blob: EncryptedBlob): Promise<void>;
    getBlob(id: string): Promise<EncryptedBlob | null>;
    getAllBlobs(): Promise<EncryptedBlob[]>;
    deleteBlob(id: string): Promise<void>;

    // Bulk operations
    exportAll(): Promise<string>; // JSON export
    importAll(data: string): Promise<void>;
    clearAll(): Promise<void>;
}

export type StorageType = 'indexeddb' | 'memory' | 'ipfs';

