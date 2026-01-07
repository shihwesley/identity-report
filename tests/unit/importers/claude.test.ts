/**
 * Unit tests for Claude/Anthropic Importer
 *
 * Tests parsing of Claude conversation exports, handling of both
 * array and object formats, attachment processing, and error recovery.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ClaudeImporter } from '@/lib/importers/claude';
import { CLAUDE_EXPORT } from '../../fixtures/test-vectors';

describe('ClaudeImporter', () => {
    let importer: ClaudeImporter;

    beforeEach(() => {
        importer = new ClaudeImporter();
    });

    describe('parse()', () => {
        it('should parse valid Claude export with conversations property', () => {
            const data = JSON.stringify(CLAUDE_EXPORT);
            const result = importer.parse(data);

            expect(result.errors).toHaveLength(0);
            expect(result.conversations.length).toBeGreaterThan(0);
            expect(result.stats.totalConversations).toBe(1);
        });

        it('should parse Claude export as direct array', () => {
            const data = JSON.stringify(CLAUDE_EXPORT.conversations);
            const result = importer.parse(data);

            expect(result.errors).toHaveLength(0);
            expect(result.conversations.length).toBeGreaterThan(0);
        });

        it('should extract conversation title correctly', () => {
            const data = JSON.stringify(CLAUDE_EXPORT);
            const result = importer.parse(data);

            expect(result.conversations[0].title).toBe('Architecture Discussion');
        });

        it('should map sender roles correctly', () => {
            const data = JSON.stringify(CLAUDE_EXPORT);
            const result = importer.parse(data);

            const messages = result.conversations[0].messages;
            expect(messages[0].role).toBe('user');
            expect(messages[1].role).toBe('assistant');
        });

        it('should correctly set provider metadata', () => {
            const data = JSON.stringify(CLAUDE_EXPORT);
            const result = importer.parse(data);

            expect(result.conversations[0].metadata.provider).toBe('anthropic');
        });

        it('should parse message timestamps from ISO strings', () => {
            const data = JSON.stringify(CLAUDE_EXPORT);
            const result = importer.parse(data);

            const messages = result.conversations[0].messages;
            expect(messages[0].timestamp).toBeGreaterThan(0);
            expect(typeof messages[0].timestamp).toBe('number');
        });

        it('should sort messages by timestamp', () => {
            const unsortedExport = {
                conversations: [{
                    uuid: 'test-1',
                    name: 'Unsorted Test',
                    created_at: '2024-01-01T10:00:00Z',
                    updated_at: '2024-01-01T11:00:00Z',
                    chat_messages: [
                        {
                            uuid: 'msg-2',
                            sender: 'assistant',
                            text: 'Second message',
                            created_at: '2024-01-01T10:05:00Z'
                        },
                        {
                            uuid: 'msg-1',
                            sender: 'human',
                            text: 'First message',
                            created_at: '2024-01-01T10:00:00Z'
                        }
                    ]
                }]
            };
            const result = importer.parse(JSON.stringify(unsortedExport));

            expect(result.conversations[0].messages[0].content).toBe('First message');
            expect(result.conversations[0].messages[1].content).toBe('Second message');
        });

        it('should calculate word count correctly', () => {
            const data = JSON.stringify(CLAUDE_EXPORT);
            const result = importer.parse(data);

            expect(result.stats.totalWords).toBeGreaterThan(0);
            expect(result.conversations[0].metadata.wordCount).toBeGreaterThan(0);
        });

        it('should track date range correctly', () => {
            const data = JSON.stringify(CLAUDE_EXPORT);
            const result = importer.parse(data);

            expect(result.stats.dateRange.earliest).toBeLessThanOrEqual(result.stats.dateRange.latest);
            expect(result.stats.dateRange.earliest).toBeGreaterThan(0);
        });

        it('should extract tags/keywords from conversations', () => {
            const data = JSON.stringify(CLAUDE_EXPORT);
            const result = importer.parse(data);

            expect(result.conversations[0].tags).toBeDefined();
            expect(Array.isArray(result.conversations[0].tags)).toBe(true);
        });
    });

    describe('parse() - Error Handling', () => {
        it('should handle invalid JSON gracefully', () => {
            const result = importer.parse('not valid json { }');

            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Invalid JSON format');
            expect(result.conversations).toHaveLength(0);
        });

        it('should handle unrecognized export format', () => {
            const result = importer.parse('{"unrecognized": "format"}');

            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Unrecognized Claude export format');
        });

        it('should handle empty conversations array', () => {
            const result = importer.parse('{"conversations": []}');

            expect(result.errors).toHaveLength(0);
            expect(result.conversations).toHaveLength(0);
            expect(result.stats.totalConversations).toBe(0);
        });

        it('should handle empty direct array', () => {
            const result = importer.parse('[]');

            expect(result.errors).toHaveLength(0);
            expect(result.conversations).toHaveLength(0);
        });

        it('should handle conversation with no chat_messages', () => {
            const noMessages = {
                conversations: [{
                    uuid: 'empty-1',
                    name: 'Empty Conversation',
                    created_at: '2024-01-01T10:00:00Z',
                    updated_at: '2024-01-01T11:00:00Z',
                    chat_messages: []
                }]
            };
            const result = importer.parse(JSON.stringify(noMessages));

            expect(result.conversations).toHaveLength(0);
        });

        it('should handle conversation with null chat_messages', () => {
            const nullMessages = {
                conversations: [{
                    uuid: 'null-1',
                    name: 'Null Messages',
                    created_at: '2024-01-01T10:00:00Z',
                    updated_at: '2024-01-01T11:00:00Z'
                    // chat_messages is undefined
                }]
            };
            const result = importer.parse(JSON.stringify(nullMessages));

            expect(result.conversations).toHaveLength(0);
        });

        it('should handle malformed conversation and continue processing others', () => {
            const mixedConv = {
                conversations: [
                    {
                        // Malformed - missing required fields
                        uuid: 'bad-1'
                    },
                    {
                        uuid: 'good-1',
                        name: 'Good Conversation',
                        created_at: '2024-01-01T10:00:00Z',
                        updated_at: '2024-01-01T11:00:00Z',
                        chat_messages: [
                            {
                                uuid: 'msg-1',
                                sender: 'human',
                                text: 'Hello',
                                created_at: '2024-01-01T10:00:00Z'
                            }
                        ]
                    }
                ]
            };
            const result = importer.parse(JSON.stringify(mixedConv));

            // Should have processed the good conversation
            expect(result.conversations.length).toBe(1);
            expect(result.conversations[0].title).toBe('Good Conversation');
        });
    });

    describe('parse() - Attachments', () => {
        it('should include attachment content in message', () => {
            const withAttachments = {
                conversations: [{
                    uuid: 'attach-1',
                    name: 'Attachment Test',
                    created_at: '2024-01-01T10:00:00Z',
                    updated_at: '2024-01-01T11:00:00Z',
                    chat_messages: [
                        {
                            uuid: 'msg-1',
                            sender: 'human',
                            text: 'Here is my document',
                            created_at: '2024-01-01T10:00:00Z',
                            attachments: [
                                {
                                    file_name: 'notes.txt',
                                    file_type: 'text/plain',
                                    extracted_content: 'These are my notes about the project.'
                                }
                            ]
                        }
                    ]
                }]
            };
            const result = importer.parse(JSON.stringify(withAttachments));

            expect(result.conversations[0].messages[0].content).toContain('Here is my document');
            expect(result.conversations[0].messages[0].content).toContain('[Attachment: notes.txt]');
            expect(result.conversations[0].messages[0].content).toContain('These are my notes');
        });

        it('should handle attachments without extracted content', () => {
            const noContent = {
                conversations: [{
                    uuid: 'attach-2',
                    name: 'No Content Attachment',
                    created_at: '2024-01-01T10:00:00Z',
                    updated_at: '2024-01-01T11:00:00Z',
                    chat_messages: [
                        {
                            uuid: 'msg-1',
                            sender: 'human',
                            text: 'Check this image',
                            created_at: '2024-01-01T10:00:00Z',
                            attachments: [
                                {
                                    file_name: 'image.png',
                                    file_type: 'image/png'
                                    // No extracted_content
                                }
                            ]
                        }
                    ]
                }]
            };
            const result = importer.parse(JSON.stringify(noContent));

            // Should not include attachment marker if no content
            expect(result.conversations[0].messages[0].content).toBe('Check this image');
        });

        it('should handle multiple attachments', () => {
            const multipleAttach = {
                conversations: [{
                    uuid: 'multi-attach-1',
                    name: 'Multiple Attachments',
                    created_at: '2024-01-01T10:00:00Z',
                    updated_at: '2024-01-01T11:00:00Z',
                    chat_messages: [
                        {
                            uuid: 'msg-1',
                            sender: 'human',
                            text: 'Here are my files',
                            created_at: '2024-01-01T10:00:00Z',
                            attachments: [
                                {
                                    file_name: 'file1.txt',
                                    file_type: 'text/plain',
                                    extracted_content: 'Content of file 1'
                                },
                                {
                                    file_name: 'file2.txt',
                                    file_type: 'text/plain',
                                    extracted_content: 'Content of file 2'
                                }
                            ]
                        }
                    ]
                }]
            };
            const result = importer.parse(JSON.stringify(multipleAttach));

            const content = result.conversations[0].messages[0].content;
            expect(content).toContain('file1.txt');
            expect(content).toContain('file2.txt');
            expect(content).toContain('Content of file 1');
            expect(content).toContain('Content of file 2');
        });
    });

    describe('parse() - Memory Fragments', () => {
        it('should create memory fragments for significant conversations', () => {
            const significantConv = {
                conversations: [{
                    uuid: 'sig-1',
                    name: 'In-depth Discussion',
                    created_at: '2024-01-01T10:00:00Z',
                    updated_at: '2024-01-01T11:00:00Z',
                    chat_messages: [
                        { uuid: 'msg-1', sender: 'human', text: 'Question 1', created_at: '2024-01-01T10:00:00Z' },
                        { uuid: 'msg-2', sender: 'assistant', text: 'Answer 1', created_at: '2024-01-01T10:01:00Z' },
                        { uuid: 'msg-3', sender: 'human', text: 'Question 2', created_at: '2024-01-01T10:02:00Z' },
                        { uuid: 'msg-4', sender: 'assistant', text: 'Answer 2', created_at: '2024-01-01T10:03:00Z' }
                    ]
                }]
            };
            const result = importer.parse(JSON.stringify(significantConv));

            expect(result.memories.length).toBeGreaterThan(0);
            expect(result.memories[0].content).toContain('Claude conversation');
            expect(result.memories[0].sourceProvider).toBe('anthropic');
        });

        it('should not create memory for short conversations', () => {
            const shortConv = {
                conversations: [{
                    uuid: 'short-1',
                    name: 'Quick Question',
                    created_at: '2024-01-01T10:00:00Z',
                    updated_at: '2024-01-01T10:01:00Z',
                    chat_messages: [
                        { uuid: 'msg-1', sender: 'human', text: 'Hi', created_at: '2024-01-01T10:00:00Z' }
                    ]
                }]
            };
            const result = importer.parse(JSON.stringify(shortConv));

            expect(result.memories.length).toBe(0);
        });
    });

    describe('parse() - Model Detection', () => {
        it('should use model from conversation if provided', () => {
            const withModel = {
                conversations: [{
                    uuid: 'model-1',
                    name: 'Model Test',
                    created_at: '2024-01-01T10:00:00Z',
                    updated_at: '2024-01-01T11:00:00Z',
                    model: 'claude-3-opus',
                    chat_messages: [
                        { uuid: 'msg-1', sender: 'human', text: 'Hello', created_at: '2024-01-01T10:00:00Z' }
                    ]
                }]
            };
            const result = importer.parse(JSON.stringify(withModel));

            expect(result.conversations[0].metadata.model).toBe('claude-3-opus');
        });

        it('should use default model if not provided', () => {
            const data = JSON.stringify(CLAUDE_EXPORT);
            const result = importer.parse(data);

            expect(result.conversations[0].metadata.model).toBe('claude-3');
        });
    });

    describe('parse() - Date Handling', () => {
        it('should handle invalid date strings gracefully', () => {
            const invalidDates = {
                conversations: [{
                    uuid: 'date-1',
                    name: 'Invalid Date Test',
                    created_at: 'not-a-date',
                    updated_at: 'also-not-a-date',
                    chat_messages: [
                        {
                            uuid: 'msg-1',
                            sender: 'human',
                            text: 'Hello',
                            created_at: 'invalid-date'
                        }
                    ]
                }]
            };
            const result = importer.parse(JSON.stringify(invalidDates));

            // Should use Date.now() as fallback
            expect(result.conversations[0].metadata.createdAt).toBeGreaterThan(0);
        });

        it('should handle various ISO date formats', () => {
            const variousDates = {
                conversations: [{
                    uuid: 'date-2',
                    name: 'Date Format Test',
                    created_at: '2024-01-01T10:00:00.000Z',
                    updated_at: '2024-01-01',
                    chat_messages: [
                        {
                            uuid: 'msg-1',
                            sender: 'human',
                            text: 'Hello',
                            created_at: '2024-01-01T10:00:00+05:00'
                        }
                    ]
                }]
            };
            const result = importer.parse(JSON.stringify(variousDates));

            expect(result.conversations.length).toBe(1);
            expect(result.conversations[0].metadata.createdAt).toBeGreaterThan(0);
        });
    });

    describe('parse() - Conversation Naming', () => {
        it('should use name field for title', () => {
            const data = JSON.stringify(CLAUDE_EXPORT);
            const result = importer.parse(data);

            expect(result.conversations[0].title).toBe('Architecture Discussion');
        });

        it('should use default title if name is missing', () => {
            const noName = {
                conversations: [{
                    uuid: 'no-name-1',
                    created_at: '2024-01-01T10:00:00Z',
                    updated_at: '2024-01-01T11:00:00Z',
                    chat_messages: [
                        { uuid: 'msg-1', sender: 'human', text: 'Hello', created_at: '2024-01-01T10:00:00Z' }
                    ]
                }]
            };
            const result = importer.parse(JSON.stringify(noName));

            expect(result.conversations[0].title).toBe('Claude Conversation');
        });
    });

    describe('Large File Handling', () => {
        it('should handle large number of conversations efficiently', () => {
            const conversations = [];
            for (let i = 0; i < 100; i++) {
                conversations.push({
                    uuid: `conv-${i}`,
                    name: `Conversation ${i}`,
                    created_at: new Date(Date.now() - i * 86400000).toISOString(),
                    updated_at: new Date(Date.now() - i * 86400000 + 3600000).toISOString(),
                    chat_messages: [
                        {
                            uuid: `msg-${i}`,
                            sender: 'human',
                            text: `Message for conversation ${i} with some meaningful content about various topics`,
                            created_at: new Date(Date.now() - i * 86400000).toISOString()
                        }
                    ]
                });
            }

            const startTime = Date.now();
            const result = importer.parse(JSON.stringify({ conversations }));
            const duration = Date.now() - startTime;

            expect(result.conversations.length).toBe(100);
            expect(result.stats.totalConversations).toBe(100);
            // Should complete in reasonable time (less than 5 seconds)
            expect(duration).toBeLessThan(5000);
        });

        it('should handle conversations with many messages', () => {
            const longConversation = {
                conversations: [{
                    uuid: 'long-1',
                    name: 'Long Conversation',
                    created_at: '2024-01-01T10:00:00Z',
                    updated_at: '2024-01-01T20:00:00Z',
                    chat_messages: Array.from({ length: 500 }, (_, i) => ({
                        uuid: `msg-${i}`,
                        sender: i % 2 === 0 ? 'human' : 'assistant',
                        text: `Message ${i} with some content that represents a typical message length.`,
                        created_at: new Date(Date.now() - (500 - i) * 60000).toISOString()
                    }))
                }]
            };

            const result = importer.parse(JSON.stringify(longConversation));

            expect(result.conversations[0].messages.length).toBe(500);
            expect(result.stats.totalMessages).toBe(500);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty message text', () => {
            const emptyText = {
                conversations: [{
                    uuid: 'empty-1',
                    name: 'Empty Text',
                    created_at: '2024-01-01T10:00:00Z',
                    updated_at: '2024-01-01T11:00:00Z',
                    chat_messages: [
                        { uuid: 'msg-1', sender: 'human', text: '', created_at: '2024-01-01T10:00:00Z' }
                    ]
                }]
            };
            const result = importer.parse(JSON.stringify(emptyText));

            expect(result.conversations[0].messages[0].content).toBe('');
        });

        it('should handle null message text', () => {
            const nullText = {
                conversations: [{
                    uuid: 'null-1',
                    name: 'Null Text',
                    created_at: '2024-01-01T10:00:00Z',
                    updated_at: '2024-01-01T11:00:00Z',
                    chat_messages: [
                        { uuid: 'msg-1', sender: 'human', text: null, created_at: '2024-01-01T10:00:00Z' }
                    ]
                }]
            };
            const result = importer.parse(JSON.stringify(nullText));

            // Should handle null text gracefully
            expect(result).toBeDefined();
        });

        it('should handle missing uuid in message', () => {
            const noUuid = {
                conversations: [{
                    uuid: 'conv-1',
                    name: 'No UUID Message',
                    created_at: '2024-01-01T10:00:00Z',
                    updated_at: '2024-01-01T11:00:00Z',
                    chat_messages: [
                        { sender: 'human', text: 'Hello', created_at: '2024-01-01T10:00:00Z' }
                    ]
                }]
            };
            const result = importer.parse(JSON.stringify(noUuid));

            // Should generate an ID
            expect(result.conversations[0].messages[0].id).toBeDefined();
            expect(result.conversations[0].messages[0].id.length).toBeGreaterThan(0);
        });

        it('should handle special characters in content', () => {
            const specialChars = {
                conversations: [{
                    uuid: 'special-1',
                    name: 'Special Characters',
                    created_at: '2024-01-01T10:00:00Z',
                    updated_at: '2024-01-01T11:00:00Z',
                    chat_messages: [
                        {
                            uuid: 'msg-1',
                            sender: 'human',
                            text: 'Code: `const x = "hello"` and emoji and unicode ',
                            created_at: '2024-01-01T10:00:00Z'
                        }
                    ]
                }]
            };
            const result = importer.parse(JSON.stringify(specialChars));

            expect(result.conversations[0].messages[0].content).toContain('`const x = "hello"`');
            expect(result.conversations[0].messages[0].content).toContain('');
        });

        it('should handle very long message content', () => {
            const longContent = 'A'.repeat(100000);
            const longMessage = {
                conversations: [{
                    uuid: 'long-content-1',
                    name: 'Long Content',
                    created_at: '2024-01-01T10:00:00Z',
                    updated_at: '2024-01-01T11:00:00Z',
                    chat_messages: [
                        { uuid: 'msg-1', sender: 'human', text: longContent, created_at: '2024-01-01T10:00:00Z' }
                    ]
                }]
            };
            const result = importer.parse(JSON.stringify(longMessage));

            expect(result.conversations[0].messages[0].content.length).toBe(100000);
        });
    });
});
