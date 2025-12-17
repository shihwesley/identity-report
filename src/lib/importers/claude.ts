/**
 * Claude/Anthropic Importer
 * 
 * Parses conversation exports from Claude.ai.
 * Export can be obtained from: Settings > Export Conversations
 * 
 * Claude exports conversations as a JSON file with a different structure than OpenAI.
 */

import { BaseImporter, ImportResult } from './base';
import { Conversation, Message } from '@/lib/types';

interface ClaudeMessage {
    uuid: string;
    text: string;
    sender: 'human' | 'assistant';
    created_at: string; // ISO date string
    attachments?: Array<{
        file_name: string;
        file_type: string;
        extracted_content?: string;
    }>;
}

interface ClaudeConversation {
    uuid: string;
    name: string;
    created_at: string;
    updated_at: string;
    chat_messages: ClaudeMessage[];
    model?: string;
}

interface ClaudeExport {
    conversations?: ClaudeConversation[];
    // Alternative format - array at root
    [index: number]: ClaudeConversation;
}

export class ClaudeImporter extends BaseImporter {
    constructor() {
        super('anthropic');
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

        let rawData: ClaudeExport | ClaudeConversation[];

        try {
            rawData = JSON.parse(data);
        } catch (e) {
            result.errors.push(`Invalid JSON format: ${(e as Error).message}`);
            return result;
        }

        // Handle both array format and object with conversations property
        let rawConversations: ClaudeConversation[];
        if (Array.isArray(rawData)) {
            rawConversations = rawData;
        } else if (rawData.conversations && Array.isArray(rawData.conversations)) {
            rawConversations = rawData.conversations;
        } else {
            result.errors.push('Unrecognized Claude export format');
            return result;
        }

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
                            `Claude conversation: "${conversation.title}" - ${this.generateSummary(conversation.messages)}`,
                            keywords
                        );
                        result.memories.push(memory);
                    }
                }
            } catch (e) {
                result.errors.push(`Error parsing conversation "${raw.name || raw.uuid}": ${(e as Error).message}`);
            }
        }

        // Fix date range if no conversations
        if (result.stats.dateRange.earliest === Infinity) {
            result.stats.dateRange.earliest = Date.now();
            result.stats.dateRange.latest = Date.now();
        }

        return result;
    }

    private parseConversation(raw: ClaudeConversation): Conversation | null {
        if (!raw.chat_messages || raw.chat_messages.length === 0) {
            return null;
        }

        const messages: Message[] = raw.chat_messages.map(msg => {
            let content = msg.text || '';

            // Include attachment content if present
            if (msg.attachments && msg.attachments.length > 0) {
                const attachmentContent = msg.attachments
                    .filter(a => a.extracted_content)
                    .map(a => `[Attachment: ${a.file_name}]\n${a.extracted_content}`)
                    .join('\n\n');

                if (attachmentContent) {
                    content = content + '\n\n' + attachmentContent;
                }
            }

            return {
                id: msg.uuid || this.generateId('msg'),
                role: msg.sender === 'human' ? 'user' as const : 'assistant' as const,
                content: content.trim(),
                timestamp: new Date(msg.created_at).getTime(),
                metadata: {}
            };
        });

        // Sort messages by timestamp
        messages.sort((a, b) => a.timestamp - b.timestamp);

        // Calculate word count
        const wordCount = messages.reduce((sum, m) => sum + this.countWords(m.content), 0);

        const createdAt = new Date(raw.created_at).getTime();
        const updatedAt = new Date(raw.updated_at).getTime();

        return {
            id: this.generateId('conv'),
            title: raw.name || 'Claude Conversation',
            messages,
            metadata: {
                provider: 'anthropic',
                model: raw.model || 'claude-3',
                createdAt: isNaN(createdAt) ? Date.now() : createdAt,
                updatedAt: isNaN(updatedAt) ? Date.now() : updatedAt,
                importedAt: Date.now(),
                messageCount: messages.length,
                wordCount
            },
            tags: this.extractKeywords(messages.map(m => m.content).join(' '))
        };
    }
}

// Export singleton for convenience
export const claudeImporter = new ClaudeImporter();
