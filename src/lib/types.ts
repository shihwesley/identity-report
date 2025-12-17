
export type EntityType = 'technical' | 'personal' | 'preference' | 'fact';
export type VaultStatus = 'locked' | 'unlocked' | 'syncing';
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'local' | 'other';

// Content types supported by various AI providers
export type MessageContentType =
    | 'text'
    | 'multimodal_text'
    | 'code'
    | 'execution_output'
    | 'thoughts'
    | 'reasoning_recap'
    | 'browsing'
    | 'tether_quote'
    | 'system_error';

// --- Media & Attachment Types ---

export interface Attachment {
    id: string;
    type: 'image' | 'file' | 'audio' | 'video';
    name: string;
    mimeType: string;
    size: number;
    width?: number;
    height?: number;
    localPath?: string;      // Path in export folder
    storedPath?: string;     // Path in vault storage
    assetPointer?: string;   // OpenAI sediment:// reference
}

export interface VoiceSession {
    id: string;
    conversationId: string;
    voice: string;           // e.g., "juniper", "breeze"
    audioFiles: Attachment[];
    totalDuration?: number;  // seconds
    createdAt: number;
}

export interface DALLEGeneration {
    id: string;
    prompt?: string;
    revisedPrompt?: string;
    imagePath: string;
    storedPath?: string;
    createdAt: number;
    conversationId?: string;
}

export interface ThoughtItem {
    summary: string;
    content: string;
    finished: boolean;
}

export interface OpenAIUserProfile {
    id: string;
    email: string;
    phoneNumber?: string;
    isPlusUser: boolean;
}

export interface VaultMetadata {
    ownerDid: string; // Decentralized ID (e.g., did:key:z...)
    createdAt: number;
    lastModified: number;
    version: number;
}

export interface EncryptedProfile {
    metadata: VaultMetadata;
    ciphertext: string; // The encrypted JSON blob
    iv: string; // Initialization Vector for the encryption
    salt: string; // Salt used for key derivation
}

export interface AccessGrant {
    id: string;
    grantee: string; // e.g., "Gemini 1.5 Pro"
    permissions: ('read_identity' | 'read_memory' | 'write_memory')[];
    expiresAt: number;
    signature: string; // User signed this grant
}

export interface MemoryFragment {
    id: string;
    timestamp: string;
    content: string;
    tags: string[];
    type: EntityType;
    sourceModel: string;
    sourceProvider: AIProvider;
    confidence: number;
    conversationId?: string; // Link back to source conversation
}

export interface UserIdentity {
    displayName: string;
    fullName: string;
    email: string;
    location: string;
    role: string;
    avatarUrl?: string;
}

export interface SystemPreference {
    id: string;
    key: string;
    value: string;
    category: 'output_style' | 'coding_style' | 'communication';
    isEnabled: boolean;
}

export interface ProjectContext {
    id: string;
    name: string;
    description: string;
    techStack: string[];
    relatedMemories: string[]; // IDs of MemoryFragments
}

// --- Conversation Types (Multi-Provider Support) ---

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: number;
    contentType?: MessageContentType;
    attachments?: Attachment[];
    codeLanguage?: string;       // For code content type
    thoughts?: ThoughtItem[];     // For reasoning/thoughts content
    metadata?: {
        model?: string;
        tokens?: number;
        artifacts?: string[];
    };
}

export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    metadata: {
        provider: AIProvider;
        model: string;
        createdAt: number;
        updatedAt: number;
        importedAt: number;
        messageCount: number;
        wordCount: number;
    };
    tags: string[]; // Auto-extracted topics
    summary?: string; // LLM-generated summary (when available)
}

export interface UserInsight {
    id: string;
    category: 'preference' | 'expertise' | 'style' | 'project' | 'interest';
    content: string;
    confidence: number;
    derivedFrom: string[]; // conversation IDs
    createdAt: number;
    updatedAt: number;
}

// --- Portable Profile (Full Export) ---

export interface PortableProfile {
    identity: UserIdentity;
    preferences: SystemPreference[];
    shortTermMemory: MemoryFragment[]; // Last 10-20 interactions
    longTermMemory: MemoryFragment[]; // All stored memories
    projects: ProjectContext[];
    conversations: Conversation[];
    insights: UserInsight[];
    activeGrants: AccessGrant[];
}

// --- Vault State ---

export interface VaultState {
    status: VaultStatus;
    did: string | null;
    profile: PortableProfile | null;
    lastSynced: number | null;
    stats: {
        totalConversations: number;
        totalMemories: number;
        totalInsights: number;
        providers: AIProvider[];
    };
}

