/**
 * Google Gemini/Bard Importer
 * 
 * Parses conversation exports from Google Takeout for Bard/Gemini.
 * Export can be obtained from: takeout.google.com > Select Bard/Gemini
 * 
 * Google exports as individual HTML or JSON files per conversation.
 */

import { BaseImporter, ImportResult } from './base';
import { Conversation, Message } from '@/lib/types';

interface GeminiMessage {
    text: string;
    author?: 'user' | 'model';
    role?: 'user' | 'model'; // Alternative field name
    timestamp?: string;
    createTime?: string;
}

interface GeminiConversation {
    title?: string;
    name?: string;
    messages?: GeminiMessage[];
    turns?: Array<{
        userInput?: { text: string };
        modelResponse?: { text: string };
        timestamp?: string;
    }>;
    createTime?: string;
    updateTime?: string;
}

export class GeminiImporter extends BaseImporter {
    constructor() {
        super('google');
    }

    parse(data: string): ImportResult {
        const result: ImportResult = {
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

        let rawData: GeminiConversation | GeminiConversation[];

        try {
            rawData = JSON.parse(data);
        } catch (e) {
            // Maybe it's HTML from Google Takeout?
            if (data.includes('<html') || data.includes('<!DOCTYPE')) {
                return this.parseHTML(data, result);
            }
            result.errors.push(`Invalid JSON format: ${(e as Error).message}`);
            return result;
        }

        // Handle single conversation or array
        const rawConversations = Array.isArray(rawData) ? rawData : [rawData];

        for (const raw of rawConversations) {
            try {
                const conversation = this.parseConversation(raw);
                if (conversation && conversation.messages.length > 0) {
                    result.conversations.push(conversation);
                    result.stats.totalConversations++;
                    result.stats.totalMessages += conversation.messages.length;
                    result.stats.totalWords += conversation.metadata.wordCount;

                    // Update date range
                    if (conversation.metadata.createdAt < result.stats.dateRange.earliest) {
                        result.stats.dateRange.earliest = conversation.metadata.createdAt;
                    }
                    if (conversation.metadata.createdAt > result.stats.dateRange.latest) {
                        result.stats.dateRange.latest = conversation.metadata.createdAt;
                    }

                    // Create memory fragment for significant conversations
                    if (conversation.messages.length >= 4) {
                        const keywords = this.extractKeywords(
                            conversation.messages.map(m => m.content).join(' ')
                        );
                        const memory = this.createMemoryFromConversation(
                            conversation,
                            `Gemini conversation: "${conversation.title}" - ${this.generateSummary(conversation.messages)}`,
                            keywords
                        );
                        result.memories.push(memory);
                    }
                }
            } catch (e) {
                result.errors.push(`Error parsing Gemini conversation: ${(e as Error).message}`);
            }
        }

        // Fix date range if no conversations
        if (result.stats.dateRange.earliest === Infinity) {
            result.stats.dateRange.earliest = Date.now();
            result.stats.dateRange.latest = Date.now();
        }

        return result;
    }

    private parseConversation(raw: GeminiConversation): Conversation | null {
        const messages: Message[] = [];
        let baseTimestamp = Date.now();

        if (raw.createTime) {
            baseTimestamp = new Date(raw.createTime).getTime();
        }

        // Handle "messages" format
        if (raw.messages && raw.messages.length > 0) {
            for (let i = 0; i < raw.messages.length; i++) {
                const msg = raw.messages[i];
                const role = msg.author || msg.role;

                messages.push({
                    id: this.generateId('msg'),
                    role: role === 'user' ? 'user' : 'assistant',
                    content: msg.text || '',
                    timestamp: msg.timestamp || msg.createTime
                        ? new Date(msg.timestamp || msg.createTime!).getTime()
                        : baseTimestamp + (i * 1000),
                    metadata: {}
                });
            }
        }

        // Handle "turns" format (older Bard exports)
        if (raw.turns && raw.turns.length > 0) {
            for (let i = 0; i < raw.turns.length; i++) {
                const turn = raw.turns[i];
                const turnTime = turn.timestamp
                    ? new Date(turn.timestamp).getTime()
                    : baseTimestamp + (i * 2000);

                if (turn.userInput?.text) {
                    messages.push({
                        id: this.generateId('msg'),
                        role: 'user',
                        content: turn.userInput.text,
                        timestamp: turnTime,
                        metadata: {}
                    });
                }

                if (turn.modelResponse?.text) {
                    messages.push({
                        id: this.generateId('msg'),
                        role: 'assistant',
                        content: turn.modelResponse.text,
                        timestamp: turnTime + 500,
                        metadata: {}
                    });
                }
            }
        }

        if (messages.length === 0) {
            return null;
        }

        // Sort messages by timestamp
        messages.sort((a, b) => a.timestamp - b.timestamp);

        // Calculate word count
        const wordCount = messages.reduce((sum, m) => sum + this.countWords(m.content), 0);

        const createdAt = raw.createTime ? new Date(raw.createTime).getTime() : messages[0].timestamp;
        const updatedAt = raw.updateTime ? new Date(raw.updateTime).getTime() : messages[messages.length - 1].timestamp;

        return {
            id: this.generateId('conv'),
            title: raw.title || raw.name || 'Gemini Conversation',
            messages,
            metadata: {
                provider: 'google',
                model: 'gemini',
                createdAt: isNaN(createdAt) ? Date.now() : createdAt,
                updatedAt: isNaN(updatedAt) ? Date.now() : updatedAt,
                importedAt: Date.now(),
                messageCount: messages.length,
                wordCount
            },
            tags: this.extractKeywords(messages.map(m => m.content).join(' '))
        };
    }

    /**
     * Parse HTML format from Google Takeout.
     * This is a basic implementation - real exports may vary.
     */
    private parseHTML(html: string, result: ImportResult): ImportResult {
        result.errors.push('HTML parsing not fully implemented. Please export as JSON if possible.');

        // Basic extraction attempt
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : 'Imported Conversation';

        // Try to extract text content (very basic)
        const textContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, '\n')
            .replace(/\s+/g, ' ')
            .trim();

        if (textContent.length > 100) {
            const conversation: Conversation = {
                id: this.generateId('conv'),
                title,
                messages: [{
                    id: this.generateId('msg'),
                    role: 'user',
                    content: textContent.slice(0, 10000), // Limit content
                    timestamp: Date.now(),
                    metadata: {}
                }],
                metadata: {
                    provider: 'google',
                    model: 'gemini',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    importedAt: Date.now(),
                    messageCount: 1,
                    wordCount: this.countWords(textContent)
                },
                tags: this.extractKeywords(textContent)
            };

            result.conversations.push(conversation);
            result.stats.totalConversations = 1;
            result.stats.totalMessages = 1;
            result.stats.dateRange = { earliest: Date.now(), latest: Date.now() };
        }

        return result;
    }
}

// Export singleton for convenience
export const geminiImporter = new GeminiImporter();
