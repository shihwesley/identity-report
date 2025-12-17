/**
 * OpenAI/ChatGPT Importer
 * 
 * Parses the full ChatGPT data export including:
 * - conversations.json with all content types
 * - User-uploaded images and attachments
 * - Voice session audio files
 * - DALL-E generations
 * - User profile data
 * 
 * Export can be obtained from: Settings > Data Controls > Export data
 */

import { BaseImporter, ImportResult } from './base';
import {
    Conversation,
    Message,
    Attachment,
    VoiceSession,
    DALLEGeneration,
    OpenAIUserProfile,
    MessageContentType,
    ThoughtItem
} from '@/lib/types';

// --- OpenAI Export Interfaces ---

interface OpenAIAttachment {
    id: string;
    name: string;
    mime_type: string;
    size: number;
    width?: number;
    height?: number;
}

interface ImageAssetPointer {
    content_type: 'image_asset_pointer';
    asset_pointer: string; // sediment://file_id
    size_bytes: number;
    width: number;
    height: number;
    metadata?: {
        dalle?: unknown;
        sanitized?: boolean;
    };
}

interface OpenAIMessageContent {
    content_type: string;
    parts?: (string | ImageAssetPointer)[];
    text?: string;           // For code content
    language?: string;       // For code content
    thoughts?: Array<{
        summary: string;
        content: string;
        finished: boolean;
    }>;
}

interface OpenAIMessage {
    id: string;
    content: OpenAIMessageContent;
    author: {
        role: 'user' | 'assistant' | 'system' | 'tool';
        metadata?: Record<string, unknown>;
    };
    create_time: number | null;
    metadata?: {
        model_slug?: string;
        attachments?: OpenAIAttachment[];
        voice_mode_message?: boolean;
    };
}

interface OpenAIConversation {
    id: string;
    conversation_id?: string;
    title: string;
    create_time: number;
    update_time: number;
    mapping: Record<string, {
        id: string;
        message: OpenAIMessage | null;
        parent: string | null;
        children: string[];
    }>;
    current_node?: string;
    voice?: string;
    gizmo_id?: string;
    default_model_slug?: string;
    is_archived?: boolean;
}

interface OpenAIUserJson {
    id: string;
    email: string;
    chatgpt_plus_user: boolean;
    phone_number?: string;
}

// --- Importer Implementation ---

export class OpenAIImporter extends BaseImporter {
    private attachmentMap: Map<string, Attachment> = new Map();
    private contentTypeCounts: Partial<Record<MessageContentType, number>> = {};

    constructor() {
        super('openai');
    }

    /**
     * Create an empty result with proper structure
     */
    private createEmptyResult(): ImportResult {
        return {
            conversations: [],
            memories: [],
            attachments: [],
            voiceSessions: [],
            dalleGenerations: [],
            stats: {
                totalConversations: 0,
                totalMessages: 0,
                totalWords: 0,
                totalAttachments: 0,
                totalVoiceSessions: 0,
                totalDALLEGenerations: 0,
                contentTypeDistribution: {},
                dateRange: { earliest: Infinity, latest: 0 }
            },
            errors: []
        };
    }

    /**
     * Parse conversations.json data
     */
    parse(data: string): ImportResult {
        const result = this.createEmptyResult();
        this.attachmentMap.clear();
        this.contentTypeCounts = {};

        let rawConversations: OpenAIConversation[];

        try {
            rawConversations = JSON.parse(data);
            if (!Array.isArray(rawConversations)) {
                throw new Error('Expected an array of conversations');
            }
        } catch (e) {
            result.errors.push(`Invalid JSON format: ${(e as Error).message}`);
            return result;
        }

        for (const raw of rawConversations) {
            try {
                const parseResult = this.parseConversation(raw);
                if (parseResult && parseResult.messages.length > 0) {
                    result.conversations.push(parseResult.conversation);
                    result.stats.totalConversations++;
                    result.stats.totalMessages += parseResult.conversation.messages.length;
                    result.stats.totalWords += parseResult.conversation.metadata.wordCount;

                    // Collect attachments
                    for (const att of parseResult.attachments) {
                        if (!this.attachmentMap.has(att.id)) {
                            this.attachmentMap.set(att.id, att);
                        }
                    }

                    // Track voice sessions
                    if (parseResult.voiceSession) {
                        result.voiceSessions.push(parseResult.voiceSession);
                    }

                    // Update date range
                    if (parseResult.conversation.metadata.createdAt < result.stats.dateRange.earliest) {
                        result.stats.dateRange.earliest = parseResult.conversation.metadata.createdAt;
                    }
                    if (parseResult.conversation.metadata.createdAt > result.stats.dateRange.latest) {
                        result.stats.dateRange.latest = parseResult.conversation.metadata.createdAt;
                    }

                    // Create memory fragment for significant conversations
                    if (parseResult.messages.length >= 4) {
                        const keywords = this.extractKeywords(
                            parseResult.messages.map(m => m.content).join(' ')
                        );
                        const memory = this.createMemoryFromConversation(
                            parseResult.conversation,
                            `ChatGPT conversation: "${parseResult.conversation.title}" - ${this.generateSummary(parseResult.messages)}`,
                            keywords
                        );
                        result.memories.push(memory);
                    }
                }
            } catch (e) {
                result.errors.push(`Error parsing conversation "${raw.title || raw.id}": ${(e as Error).message}`);
            }
        }

        // Finalize results
        result.attachments = Array.from(this.attachmentMap.values());
        result.stats.totalAttachments = result.attachments.length;
        result.stats.totalVoiceSessions = result.voiceSessions.length;
        result.stats.contentTypeDistribution = { ...this.contentTypeCounts };

        // Fix date range if no conversations
        if (result.stats.dateRange.earliest === Infinity) {
            result.stats.dateRange.earliest = Date.now();
            result.stats.dateRange.latest = Date.now();
        }

        return result;
        return result;
    }

    /**
     * Parse conversations.json data stream
     */
    async parseStream(stream: ReadableStream): Promise<ImportResult> {
        const result = this.createEmptyResult();
        this.attachmentMap.clear();
        this.contentTypeCounts = {};

        // Import the browser-compatible streaming parser
        const { JSONParser } = await import('@streamparser/json-whatwg');
        const parser = new JSONParser({ paths: ['$[*]'], keepStack: false });

        // Pipe the stream through decoder and parser
        // Stream -> TextDecoder -> JSONParser -> Output
        const outputStream = stream
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(parser);

        const reader = outputStream.getReader();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // value is { value: ..., key: ..., stack: ... }
                // We expect OpenAIConversation objects here
                try {
                    const rawConv = value.value as unknown as OpenAIConversation;
                    const parseResult = this.parseConversation(rawConv);

                    if (parseResult && parseResult.messages.length > 0) {
                        result.conversations.push(parseResult.conversation);
                        result.stats.totalConversations++;
                        result.stats.totalMessages += parseResult.conversation.messages.length;
                        result.stats.totalWords += parseResult.conversation.metadata.wordCount;

                        // Collect attachments
                        for (const att of parseResult.attachments) {
                            if (!this.attachmentMap.has(att.id)) {
                                this.attachmentMap.set(att.id, att);
                            }
                        }

                        // Track voice sessions
                        if (parseResult.voiceSession) {
                            result.voiceSessions.push(parseResult.voiceSession);
                        }

                        // Update date range
                        if (parseResult.conversation.metadata.createdAt < result.stats.dateRange.earliest) {
                            result.stats.dateRange.earliest = parseResult.conversation.metadata.createdAt;
                        }
                        if (parseResult.conversation.metadata.createdAt > result.stats.dateRange.latest) {
                            result.stats.dateRange.latest = parseResult.conversation.metadata.createdAt;
                        }

                        // Create memory fragment for significant conversations
                        if (parseResult.messages.length >= 4) {
                            const keywords = this.extractKeywords(
                                parseResult.messages.map(m => m.content).join(' ')
                            );
                            const memory = this.createMemoryFromConversation(
                                parseResult.conversation,
                                `ChatGPT conversation: "${parseResult.conversation.title}" - ${this.generateSummary(parseResult.messages)}`,
                                keywords
                            );
                            result.memories.push(memory);
                        }
                    }
                } catch (e) {
                    result.errors.push(`Error parsing conversation: ${(e as Error).message}`);
                }
            }
        } catch (e) {
            result.errors.push(`Stream parsing error: ${(e as Error).message}`);
        }

        // Finalize results
        result.attachments = Array.from(this.attachmentMap.values());
        result.stats.totalAttachments = result.attachments.length;
        result.stats.totalVoiceSessions = result.voiceSessions.length;
        result.stats.contentTypeDistribution = { ...this.contentTypeCounts };

        // Fix date range if no conversations
        if (result.stats.dateRange.earliest === Infinity) {
            result.stats.dateRange.earliest = Date.now();
            result.stats.dateRange.latest = Date.now();
        }

        return result;
    }

    /**
     * Parse user.json file content
     */
    parseUserProfile(data: string): OpenAIUserProfile | null {
        try {
            const user: OpenAIUserJson = JSON.parse(data);
            return {
                id: user.id,
                email: user.email,
                phoneNumber: user.phone_number,
                isPlusUser: user.chatgpt_plus_user
            };
        } catch {
            return null;
        }
    }

    /**
     * Parse a single conversation with all content types
     */
    private parseConversation(raw: OpenAIConversation): {
        conversation: Conversation;
        messages: Message[];
        attachments: Attachment[];
        voiceSession: VoiceSession | null;
    } | null {
        let modelUsed = raw.default_model_slug || 'gpt-4';

        // 1. Traverse tree to get messages and attachments
        const { messages, attachments, lastModel } = this.traverseConversationTree(raw);

        if (lastModel) modelUsed = lastModel;

        if (messages.length === 0) {
            return null;
        }

        // 2. Calculate stats
        const wordCount = messages.reduce((sum, m) => sum + this.countWords(m.content), 0);

        // 3. Create Conversation object
        const conversation: Conversation = {
            id: this.generateId('conv'),
            title: raw.title || 'Untitled Conversation',
            messages,
            metadata: {
                provider: 'openai',
                model: modelUsed,
                createdAt: raw.create_time * 1000,
                updatedAt: raw.update_time * 1000,
                importedAt: Date.now(),
                messageCount: messages.length,
                wordCount
            },
            tags: this.extractKeywords(messages.map(m => m.content).join(' '))
        };

        // 4. Handle Voice Session
        const voiceSession = this.createVoiceSession(raw, conversation.id);

        return { conversation, messages, attachments, voiceSession };
    }

    /**
     * Traverse the conversation tree (BFS) to collect messages
     */
    private traverseConversationTree(raw: OpenAIConversation): {
        messages: Message[],
        attachments: Attachment[],
        lastModel?: string
    } {
        const messages: Message[] = [];
        const attachments: Attachment[] = [];
        let lastModel: string | undefined;

        const visited = new Set<string>();
        const queue: string[] = [];

        // Find root nodes
        for (const nodeId of Object.keys(raw.mapping)) {
            const node = raw.mapping[nodeId];
            if (!node.parent) {
                queue.push(nodeId);
            }
        }

        while (queue.length > 0) {
            const nodeId = queue.shift()!;
            if (visited.has(nodeId)) continue;
            visited.add(nodeId);

            const node = raw.mapping[nodeId];
            if (!node) continue;

            // Add children
            if (node.children) {
                queue.push(...node.children);
            }

            // Extract message
            if (node.message) {
                const parsedMessage = this.parseMessage(node.message, raw.create_time);
                if (parsedMessage) {
                    messages.push(parsedMessage.message);
                    attachments.push(...parsedMessage.attachments);

                    if (node.message.metadata?.model_slug) {
                        lastModel = node.message.metadata.model_slug;
                    }
                }
            }
        }

        // Sort by timestamp
        messages.sort((a, b) => a.timestamp - b.timestamp);

        return { messages, attachments, lastModel };
    }

    /**
     * Create a voice session object if applicable
     */
    private createVoiceSession(raw: OpenAIConversation, conversationId: string): VoiceSession | null {
        if (!raw.voice) return null;

        return {
            id: this.generateId('voice'),
            conversationId: conversationId,
            voice: raw.voice,
            audioFiles: [], // Will be populated from folder import
            createdAt: raw.create_time * 1000
        };
    }

    /**
     * Parse a single message with all content types
     */
    private parseMessage(msg: OpenAIMessage, fallbackTime: number): {
        message: Message;
        attachments: Attachment[];
    } | null {
        const contentType = this.mapContentType(msg.content.content_type);
        const attachments: Attachment[] = [];
        let content = '';
        let codeLanguage: string | undefined;
        let thoughts: ThoughtItem[] | undefined;

        // Track content type
        this.contentTypeCounts[contentType] = (this.contentTypeCounts[contentType] || 0) + 1;

        // Parse based on content type
        switch (msg.content.content_type) {
            case 'text':
            case 'tether_quote':
            case 'sonic_webpage':
                content = this.extractTextFromParts(msg.content.parts);
                break;

            case 'multimodal_text':
                // Extract text and image pointers
                if (msg.content.parts) {
                    const textParts: string[] = [];
                    for (const part of msg.content.parts) {
                        if (typeof part === 'string') {
                            textParts.push(part);
                        } else if (typeof part === 'object' && part.content_type === 'image_asset_pointer') {
                            const imageAtt = this.parseImageAssetPointer(part);
                            if (imageAtt) {
                                attachments.push(imageAtt);
                            }
                        }
                    }
                    content = textParts.join('\n').trim();
                }
                break;

            case 'code':
                content = msg.content.text || '';
                codeLanguage = msg.content.language || 'unknown';
                break;

            case 'execution_output':
                content = this.extractTextFromParts(msg.content.parts);
                break;

            case 'thoughts':
            case 'reasoning_recap':
                // Extract reasoning/thought content
                if (msg.content.thoughts) {
                    thoughts = msg.content.thoughts.map(t => ({
                        summary: t.summary,
                        content: t.content,
                        finished: t.finished
                    }));
                    content = thoughts.map(t => `[${t.summary}] ${t.content}`).join('\n');
                }
                break;

            case 'tether_browsing_display':
                content = this.extractTextFromParts(msg.content.parts);
                break;

            case 'system_error':
                content = this.extractTextFromParts(msg.content.parts);
                break;

            default:
                content = this.extractTextFromParts(msg.content.parts);
        }

        // Skip empty messages
        if (content.length === 0 && attachments.length === 0) {
            return null;
        }

        // Extract attachments from message metadata
        if (msg.metadata?.attachments) {
            for (const att of msg.metadata.attachments) {
                attachments.push({
                    id: att.id,
                    type: this.getAttachmentType(att.mime_type),
                    name: att.name,
                    mimeType: att.mime_type,
                    size: att.size,
                    width: att.width,
                    height: att.height
                });
            }
        }

        const message: Message = {
            id: msg.id || this.generateId('msg'),
            role: msg.author.role,
            content,
            timestamp: (msg.create_time || fallbackTime) * 1000,
            contentType,
            attachments: attachments.length > 0 ? attachments : undefined,
            codeLanguage,
            thoughts,
            metadata: {
                model: msg.metadata?.model_slug
            }
        };

        return { message, attachments };
    }

    /**
     * Map OpenAI content type to our standard type
     */
    private mapContentType(openaiType: string): MessageContentType {
        const mapping: Record<string, MessageContentType> = {
            'text': 'text',
            'multimodal_text': 'multimodal_text',
            'code': 'code',
            'execution_output': 'execution_output',
            'thoughts': 'thoughts',
            'reasoning_recap': 'reasoning_recap',
            'tether_browsing_display': 'browsing',
            'tether_quote': 'tether_quote',
            'sonic_webpage': 'browsing',
            'system_error': 'system_error'
        };
        return mapping[openaiType] || 'text';
    }

    /**
     * Extract text from content parts array
     */
    private extractTextFromParts(parts?: (string | ImageAssetPointer)[]): string {
        if (!parts) return '';
        return parts
            .filter((p): p is string => typeof p === 'string')
            .join('\n')
            .trim();
    }

    /**
     * Parse image asset pointer to Attachment
     */
    private parseImageAssetPointer(pointer: ImageAssetPointer): Attachment | null {
        // Extract file ID from sediment://file_id
        const match = pointer.asset_pointer?.match(/sediment:\/\/(.+)/);
        if (!match) return null;

        const fileId = match[1];
        return {
            id: fileId,
            type: 'image',
            name: fileId,
            mimeType: 'image/jpeg', // Default, actual format may vary
            size: pointer.size_bytes,
            width: pointer.width,
            height: pointer.height,
            assetPointer: pointer.asset_pointer
        };
    }

    /**
     * Get attachment type from MIME type
     */
    private getAttachmentType(mimeType: string): 'image' | 'file' | 'audio' | 'video' {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType.startsWith('video/')) return 'video';
        return 'file';
    }
}

// Export singleton for convenience
export const openaiImporter = new OpenAIImporter();
