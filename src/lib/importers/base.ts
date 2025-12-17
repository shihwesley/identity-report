/**
 * Base Importer Interface
 * 
 * Abstract class for importing conversations from various AI providers.
 * Each provider (OpenAI, Claude, Gemini) has its own export format.
 */

import { Conversation, Message, MemoryFragment, AIProvider, Attachment, VoiceSession, DALLEGeneration, OpenAIUserProfile, MessageContentType } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export interface ImportResult {
    conversations: Conversation[];
    memories: MemoryFragment[];
    attachments: Attachment[];
    voiceSessions: VoiceSession[];
    dalleGenerations: DALLEGeneration[];
    userProfile?: OpenAIUserProfile;
    stats: {
        totalConversations: number;
        totalMessages: number;
        totalWords: number;
        totalAttachments: number;
        totalVoiceSessions: number;
        totalDALLEGenerations: number;
        contentTypeDistribution: Partial<Record<MessageContentType, number>>;
        dateRange: {
            earliest: number;
            latest: number;
        };
    };
    errors: string[];
}

export abstract class BaseImporter {
    protected provider: AIProvider;

    constructor(provider: AIProvider) {
        this.provider = provider;
    }

    /**
     * Parse raw export data from the provider.
     * Must be implemented by each provider-specific importer.
     */
    abstract parse(data: string): ImportResult;

    /**
     * Parse export data from a stream.
     * Useful for large files to avoid memory issues.
     * Default implementation falls back to reading entire stream to text.
     */
    async parseStream(stream: ReadableStream): Promise<ImportResult> {
        // Fallback: read stream to text and parse synchronously
        const response = new Response(stream);
        const text = await response.text();
        return this.parse(text);
    }

    /**
     * Generate a unique ID for imported items.
     */
    protected generateId(prefix: string = 'imp'): string {
        return `${prefix}_${this.provider}_${uuidv4().slice(0, 8)}`;
    }

    /**
     * Extract keywords from text for tagging.
     * Simple keyword extraction - no LLM required.
     */
    protected extractKeywords(text: string, maxKeywords: number = 5): string[] {
        // Common stop words to filter out
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
            'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'shall', 'can', 'could', 'this', 'that',
            'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what',
            'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
            'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
            'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
            'also', 'now', 'here', 'there', 'then', 'once', 'if', 'my', 'your'
        ]);

        // Extract words, filter, and count frequency
        const words = text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3 && !stopWords.has(w));

        const frequency: Record<string, number> = {};
        for (const word of words) {
            frequency[word] = (frequency[word] || 0) + 1;
        }

        // Sort by frequency and return top keywords
        return Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxKeywords)
            .map(([word]) => word);
    }

    /**
     * Count words in text.
     */
    protected countWords(text: string): number {
        return text.split(/\s+/).filter(w => w.length > 0).length;
    }

    /**
     * Create a memory fragment from a conversation.
     */
    protected createMemoryFromConversation(
        conversation: Conversation,
        content: string,
        tags: string[]
    ): MemoryFragment {
        return {
            id: this.generateId('mem'),
            timestamp: new Date(conversation.metadata.createdAt).toISOString(),
            content,
            tags: [...tags, 'imported', this.provider],
            type: 'technical', // Default - could be inferred later
            sourceModel: conversation.metadata.model,
            sourceProvider: this.provider,
            confidence: 0.8,
            conversationId: conversation.id
        };
    }

    /**
     * Generate a summary for a conversation based on its content.
     * Uses keyword extraction since we don't have LLM access.
     */
    protected generateSummary(messages: Message[]): string {
        const userMessages = messages
            .filter(m => m.role === 'user')
            .map(m => m.content)
            .join(' ');

        const keywords = this.extractKeywords(userMessages, 10);

        if (keywords.length === 0) {
            return 'Conversation with AI assistant';
        }

        return `Discussion about: ${keywords.slice(0, 5).join(', ')}`;
    }
}
