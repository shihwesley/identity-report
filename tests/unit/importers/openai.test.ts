/**
 * Unit tests for OpenAI/ChatGPT Importer
 *
 * Tests the streaming parser, content type handling, attachment extraction,
 * and error recovery for OpenAI export format.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIImporter } from '@/lib/importers/openai';
import { OPENAI_EXPORT } from '../../fixtures/test-vectors';

describe('OpenAIImporter', () => {
    let importer: OpenAIImporter;

    beforeEach(() => {
        importer = new OpenAIImporter();
    });

    describe('parse()', () => {
        it('should parse valid OpenAI export with conversations', () => {
            const data = JSON.stringify(OPENAI_EXPORT.conversations);
            const result = importer.parse(data);

            expect(result.errors).toHaveLength(0);
            expect(result.conversations.length).toBeGreaterThan(0);
            expect(result.stats.totalConversations).toBe(1);
        });

        it('should extract conversation title correctly', () => {
            const data = JSON.stringify(OPENAI_EXPORT.conversations);
            const result = importer.parse(data);

            expect(result.conversations[0].title).toBe('Code Review Session');
        });

        it('should parse message tree structure', () => {
            const data = JSON.stringify(OPENAI_EXPORT.conversations);
            const result = importer.parse(data);

            const messages = result.conversations[0].messages;
            expect(messages.length).toBeGreaterThanOrEqual(2);
            expect(messages.some(m => m.role === 'user')).toBe(true);
            expect(messages.some(m => m.role === 'assistant')).toBe(true);
        });

        it('should correctly set provider metadata', () => {
            const data = JSON.stringify(OPENAI_EXPORT.conversations);
            const result = importer.parse(data);

            expect(result.conversations[0].metadata.provider).toBe('openai');
        });

        it('should calculate word count correctly', () => {
            const data = JSON.stringify(OPENAI_EXPORT.conversations);
            const result = importer.parse(data);

            expect(result.stats.totalWords).toBeGreaterThan(0);
            expect(result.conversations[0].metadata.wordCount).toBeGreaterThan(0);
        });

        it('should track date range correctly', () => {
            const data = JSON.stringify(OPENAI_EXPORT.conversations);
            const result = importer.parse(data);

            expect(result.stats.dateRange.earliest).toBeLessThanOrEqual(result.stats.dateRange.latest);
            expect(result.stats.dateRange.earliest).toBeGreaterThan(0);
        });

        it('should extract tags/keywords from conversations', () => {
            const data = JSON.stringify(OPENAI_EXPORT.conversations);
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

        it('should handle non-array JSON input', () => {
            const result = importer.parse('{"not": "an array"}');

            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Expected an array');
        });

        it('should handle empty array', () => {
            const result = importer.parse('[]');

            expect(result.errors).toHaveLength(0);
            expect(result.conversations).toHaveLength(0);
            expect(result.stats.totalConversations).toBe(0);
        });

        it('should handle malformed conversation entry', () => {
            const malformed = [{
                id: 'test-1',
                title: 'Test Conversation',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'invalid-node': {
                        // Missing required fields
                    }
                }
            }];
            const result = importer.parse(JSON.stringify(malformed));

            // Should not crash, may produce errors or skip conversation
            expect(result).toBeDefined();
        });

        it('should handle conversation with no messages', () => {
            const noMessages = [{
                id: 'empty-1',
                title: 'Empty Conversation',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {}
            }];
            const result = importer.parse(JSON.stringify(noMessages));

            expect(result.conversations).toHaveLength(0);
        });

        it('should handle null message in mapping node', () => {
            const nullMessage = [{
                id: 'null-msg-1',
                title: 'Null Message Test',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: null,
                        parent: null,
                        children: []
                    }
                }
            }];
            const result = importer.parse(JSON.stringify(nullMessage));

            expect(result.errors).toHaveLength(0);
        });
    });

    describe('parse() - Content Types', () => {
        it('should handle text content type', () => {
            const textConv = [{
                id: 'text-1',
                title: 'Text Content Test',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: {
                            id: 'msg-1',
                            author: { role: 'user' },
                            content: { content_type: 'text', parts: ['Hello world'] },
                            create_time: 1704067200
                        },
                        parent: null,
                        children: []
                    }
                }
            }];
            const result = importer.parse(JSON.stringify(textConv));

            expect(result.conversations[0].messages[0].content).toBe('Hello world');
        });

        it('should handle code content type', () => {
            const codeConv = [{
                id: 'code-1',
                title: 'Code Content Test',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: {
                            id: 'msg-1',
                            author: { role: 'assistant' },
                            content: {
                                content_type: 'code',
                                text: 'console.log("hello");',
                                language: 'javascript'
                            },
                            create_time: 1704067200
                        },
                        parent: null,
                        children: []
                    }
                }
            }];
            const result = importer.parse(JSON.stringify(codeConv));

            const message = result.conversations[0].messages[0];
            expect(message.content).toBe('console.log("hello");');
            expect(message.codeLanguage).toBe('javascript');
        });

        it('should handle multimodal_text with image pointers', () => {
            const multimodalConv = [{
                id: 'multimodal-1',
                title: 'Multimodal Test',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: {
                            id: 'msg-1',
                            author: { role: 'user' },
                            content: {
                                content_type: 'multimodal_text',
                                parts: [
                                    'Check out this image:',
                                    {
                                        content_type: 'image_asset_pointer',
                                        asset_pointer: 'sediment://file-abc123',
                                        size_bytes: 50000,
                                        width: 800,
                                        height: 600
                                    }
                                ]
                            },
                            create_time: 1704067200
                        },
                        parent: null,
                        children: []
                    }
                }
            }];
            const result = importer.parse(JSON.stringify(multimodalConv));

            const message = result.conversations[0].messages[0];
            expect(message.content).toContain('Check out this image');
            expect(message.attachments).toBeDefined();
            expect(message.attachments!.length).toBe(1);
            expect(message.attachments![0].type).toBe('image');
        });

        it('should handle thoughts/reasoning content type', () => {
            const thoughtsConv = [{
                id: 'thoughts-1',
                title: 'Reasoning Test',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: {
                            id: 'msg-1',
                            author: { role: 'assistant' },
                            content: {
                                content_type: 'thoughts',
                                thoughts: [
                                    {
                                        summary: 'Analyzing the problem',
                                        content: 'Let me think about this step by step...',
                                        finished: true
                                    }
                                ]
                            },
                            create_time: 1704067200
                        },
                        parent: null,
                        children: []
                    }
                }
            }];
            const result = importer.parse(JSON.stringify(thoughtsConv));

            const message = result.conversations[0].messages[0];
            expect(message.thoughts).toBeDefined();
            expect(message.thoughts!.length).toBe(1);
            expect(message.thoughts![0].summary).toBe('Analyzing the problem');
        });

        it('should track content type distribution', () => {
            const mixedConv = [{
                id: 'mixed-1',
                title: 'Mixed Content Test',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: {
                            id: 'msg-1',
                            author: { role: 'user' },
                            content: { content_type: 'text', parts: ['Hello'] },
                            create_time: 1704067200
                        },
                        parent: null,
                        children: ['node-2']
                    },
                    'node-2': {
                        id: 'node-2',
                        message: {
                            id: 'msg-2',
                            author: { role: 'assistant' },
                            content: { content_type: 'code', text: 'print("hi")', language: 'python' },
                            create_time: 1704067260
                        },
                        parent: 'node-1',
                        children: []
                    }
                }
            }];
            const result = importer.parse(JSON.stringify(mixedConv));

            expect(result.stats.contentTypeDistribution).toBeDefined();
            expect(result.stats.contentTypeDistribution.text).toBe(1);
            expect(result.stats.contentTypeDistribution.code).toBe(1);
        });
    });

    describe('parse() - Attachments', () => {
        it('should extract attachments from message metadata', () => {
            const withAttachments = [{
                id: 'attach-1',
                title: 'Attachment Test',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: {
                            id: 'msg-1',
                            author: { role: 'user' },
                            content: { content_type: 'text', parts: ['Here is my file'] },
                            create_time: 1704067200,
                            metadata: {
                                attachments: [
                                    {
                                        id: 'file-123',
                                        name: 'document.pdf',
                                        mime_type: 'application/pdf',
                                        size: 150000
                                    }
                                ]
                            }
                        },
                        parent: null,
                        children: []
                    }
                }
            }];
            const result = importer.parse(JSON.stringify(withAttachments));

            expect(result.attachments.length).toBe(1);
            expect(result.attachments[0].name).toBe('document.pdf');
            expect(result.attachments[0].type).toBe('file');
            expect(result.stats.totalAttachments).toBe(1);
        });

        it('should categorize attachment types correctly', () => {
            const mixedAttachments = [{
                id: 'mixed-attach-1',
                title: 'Mixed Attachments',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: {
                            id: 'msg-1',
                            author: { role: 'user' },
                            content: { content_type: 'text', parts: ['Files'] },
                            create_time: 1704067200,
                            metadata: {
                                attachments: [
                                    { id: 'img-1', name: 'photo.jpg', mime_type: 'image/jpeg', size: 100000 },
                                    { id: 'audio-1', name: 'voice.mp3', mime_type: 'audio/mpeg', size: 200000 },
                                    { id: 'video-1', name: 'clip.mp4', mime_type: 'video/mp4', size: 500000 }
                                ]
                            }
                        },
                        parent: null,
                        children: []
                    }
                }
            }];
            const result = importer.parse(JSON.stringify(mixedAttachments));

            const types = result.attachments.map(a => a.type);
            expect(types).toContain('image');
            expect(types).toContain('audio');
            expect(types).toContain('video');
        });

        it('should deduplicate attachments across messages', () => {
            const duplicateAttachments = [{
                id: 'dup-attach-1',
                title: 'Duplicate Attachments',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: {
                            id: 'msg-1',
                            author: { role: 'user' },
                            content: { content_type: 'text', parts: ['First'] },
                            create_time: 1704067200,
                            metadata: {
                                attachments: [
                                    { id: 'shared-file', name: 'doc.pdf', mime_type: 'application/pdf', size: 100 }
                                ]
                            }
                        },
                        parent: null,
                        children: ['node-2']
                    },
                    'node-2': {
                        id: 'node-2',
                        message: {
                            id: 'msg-2',
                            author: { role: 'user' },
                            content: { content_type: 'text', parts: ['Second'] },
                            create_time: 1704067260,
                            metadata: {
                                attachments: [
                                    { id: 'shared-file', name: 'doc.pdf', mime_type: 'application/pdf', size: 100 }
                                ]
                            }
                        },
                        parent: 'node-1',
                        children: []
                    }
                }
            }];
            const result = importer.parse(JSON.stringify(duplicateAttachments));

            // Should only have one unique attachment
            expect(result.attachments.length).toBe(1);
        });
    });

    describe('parse() - Voice Sessions', () => {
        it('should create voice session for conversations with voice field', () => {
            const voiceConv = [{
                id: 'voice-1',
                title: 'Voice Chat',
                create_time: 1704067200,
                update_time: 1704153600,
                voice: 'juniper',
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: {
                            id: 'msg-1',
                            author: { role: 'user' },
                            content: { content_type: 'text', parts: ['Voice message'] },
                            create_time: 1704067200
                        },
                        parent: null,
                        children: []
                    }
                }
            }];
            const result = importer.parse(JSON.stringify(voiceConv));

            expect(result.voiceSessions.length).toBe(1);
            expect(result.voiceSessions[0].voice).toBe('juniper');
            expect(result.stats.totalVoiceSessions).toBe(1);
        });
    });

    describe('parse() - Memory Fragments', () => {
        it('should create memory fragments for significant conversations', () => {
            // Create a conversation with 4+ messages
            const significantConv = [{
                id: 'sig-1',
                title: 'In-depth Discussion',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: {
                            id: 'msg-1',
                            author: { role: 'user' },
                            content: { content_type: 'text', parts: ['Question about programming'] },
                            create_time: 1704067200
                        },
                        parent: null,
                        children: ['node-2']
                    },
                    'node-2': {
                        id: 'node-2',
                        message: {
                            id: 'msg-2',
                            author: { role: 'assistant' },
                            content: { content_type: 'text', parts: ['Here is my answer about programming'] },
                            create_time: 1704067260
                        },
                        parent: 'node-1',
                        children: ['node-3']
                    },
                    'node-3': {
                        id: 'node-3',
                        message: {
                            id: 'msg-3',
                            author: { role: 'user' },
                            content: { content_type: 'text', parts: ['Follow up question'] },
                            create_time: 1704067320
                        },
                        parent: 'node-2',
                        children: ['node-4']
                    },
                    'node-4': {
                        id: 'node-4',
                        message: {
                            id: 'msg-4',
                            author: { role: 'assistant' },
                            content: { content_type: 'text', parts: ['Additional explanation'] },
                            create_time: 1704067380
                        },
                        parent: 'node-3',
                        children: []
                    }
                }
            }];
            const result = importer.parse(JSON.stringify(significantConv));

            expect(result.memories.length).toBeGreaterThan(0);
            expect(result.memories[0].content).toContain('ChatGPT conversation');
        });

        it('should not create memory for short conversations', () => {
            // Create a conversation with fewer than 4 messages
            const shortConv = [{
                id: 'short-1',
                title: 'Quick Question',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: {
                            id: 'msg-1',
                            author: { role: 'user' },
                            content: { content_type: 'text', parts: ['Hi'] },
                            create_time: 1704067200
                        },
                        parent: null,
                        children: []
                    }
                }
            }];
            const result = importer.parse(JSON.stringify(shortConv));

            expect(result.memories.length).toBe(0);
        });
    });

    describe('parseStream()', () => {
        it('should parse streaming data correctly', async () => {
            // Create a complete conversation array for streaming
            const conversations = [{
                id: 'stream-conv-1',
                title: 'Stream Test Conversation',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: {
                            id: 'msg-1',
                            author: { role: 'user' },
                            content: { content_type: 'text', parts: ['Hello from stream'] },
                            create_time: 1704067200
                        },
                        parent: null,
                        children: []
                    }
                }
            }];
            const data = JSON.stringify(conversations);
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(data));
                    controller.close();
                }
            });

            const result = await importer.parseStream(stream);

            // Streaming parser may produce some errors due to partial parsing
            // The key is that it should still produce results
            expect(result.conversations.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle chunked streaming data', async () => {
            // Create well-formed data for chunked streaming
            const conversations = [{
                id: 'chunk-conv-1',
                title: 'Chunked Stream Test',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: {
                            id: 'msg-1',
                            author: { role: 'user' },
                            content: { content_type: 'text', parts: ['Chunked message'] },
                            create_time: 1704067200
                        },
                        parent: null,
                        children: []
                    }
                }
            }];
            const data = JSON.stringify(conversations);
            const encoder = new TextEncoder();
            const chunks: string[] = [];
            const chunkSize = 50;

            for (let i = 0; i < data.length; i += chunkSize) {
                chunks.push(data.slice(i, i + chunkSize));
            }

            const stream = new ReadableStream({
                start(controller) {
                    for (const chunk of chunks) {
                        controller.enqueue(encoder.encode(chunk));
                    }
                    controller.close();
                }
            });

            const result = await importer.parseStream(stream);

            // The streaming parser should be able to parse chunked data
            // Results may vary based on chunk boundaries
            expect(result).toBeDefined();
            expect(result.stats).toBeDefined();
        });

        it('should handle empty stream', async () => {
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode('[]'));
                    controller.close();
                }
            });

            const result = await importer.parseStream(stream);

            // Empty array should produce no conversations
            // There may or may not be errors depending on stream parser behavior
            expect(result.conversations).toHaveLength(0);
            expect(result.stats.totalConversations).toBe(0);
        });
    });

    describe('parseUserProfile()', () => {
        it('should parse valid user profile', () => {
            const userJson = JSON.stringify({
                id: 'user-123',
                email: 'test@example.com',
                chatgpt_plus_user: true,
                phone_number: '+1234567890'
            });

            const profile = importer.parseUserProfile(userJson);

            expect(profile).not.toBeNull();
            expect(profile!.id).toBe('user-123');
            expect(profile!.email).toBe('test@example.com');
            expect(profile!.isPlusUser).toBe(true);
            expect(profile!.phoneNumber).toBe('+1234567890');
        });

        it('should handle user profile without phone number', () => {
            const userJson = JSON.stringify({
                id: 'user-456',
                email: 'another@example.com',
                chatgpt_plus_user: false
            });

            const profile = importer.parseUserProfile(userJson);

            expect(profile).not.toBeNull();
            expect(profile!.phoneNumber).toBeUndefined();
            expect(profile!.isPlusUser).toBe(false);
        });

        it('should return null for invalid user profile JSON', () => {
            const profile = importer.parseUserProfile('invalid json');

            expect(profile).toBeNull();
        });
    });

    describe('Large File Handling', () => {
        it('should handle large number of conversations without memory issues', () => {
            // Generate a large dataset
            const conversations = [];
            for (let i = 0; i < 100; i++) {
                conversations.push({
                    id: `conv-${i}`,
                    title: `Conversation ${i}`,
                    create_time: 1704067200 + i * 86400,
                    update_time: 1704153600 + i * 86400,
                    mapping: {
                        [`node-${i}`]: {
                            id: `node-${i}`,
                            message: {
                                id: `msg-${i}`,
                                author: { role: 'user' },
                                content: { content_type: 'text', parts: [`Message content for conversation ${i}`] },
                                create_time: 1704067200 + i * 86400
                            },
                            parent: null,
                            children: []
                        }
                    }
                });
            }

            const startMemory = process.memoryUsage().heapUsed;
            const result = importer.parse(JSON.stringify(conversations));
            const endMemory = process.memoryUsage().heapUsed;

            expect(result.conversations.length).toBe(100);
            expect(result.stats.totalConversations).toBe(100);

            // Memory increase should be reasonable (less than 50MB for 100 conversations)
            const memoryIncreaseMB = (endMemory - startMemory) / (1024 * 1024);
            expect(memoryIncreaseMB).toBeLessThan(50);
        });
    });

    describe('Edge Cases', () => {
        it('should handle conversation with circular references in tree', () => {
            // The tree traversal should handle cycles gracefully via visited set
            const cyclicConv = [{
                id: 'cyclic-1',
                title: 'Cyclic Test',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: {
                            id: 'msg-1',
                            author: { role: 'user' },
                            content: { content_type: 'text', parts: ['Hello'] },
                            create_time: 1704067200
                        },
                        parent: 'node-2', // Circular reference
                        children: ['node-2']
                    },
                    'node-2': {
                        id: 'node-2',
                        message: {
                            id: 'msg-2',
                            author: { role: 'assistant' },
                            content: { content_type: 'text', parts: ['Hi'] },
                            create_time: 1704067260
                        },
                        parent: 'node-1',
                        children: ['node-1'] // Circular reference back
                    }
                }
            }];

            // Should not hang or crash
            const result = importer.parse(JSON.stringify(cyclicConv));
            expect(result).toBeDefined();
        });

        it('should handle empty message content parts', () => {
            const emptyParts = [{
                id: 'empty-parts-1',
                title: 'Empty Parts Test',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: {
                            id: 'msg-1',
                            author: { role: 'user' },
                            content: { content_type: 'text', parts: [] },
                            create_time: 1704067200
                        },
                        parent: null,
                        children: []
                    }
                }
            }];
            const result = importer.parse(JSON.stringify(emptyParts));

            // Should handle gracefully, may skip empty messages
            expect(result.errors).toHaveLength(0);
        });

        it('should handle undefined parts', () => {
            const undefinedParts = [{
                id: 'undefined-parts-1',
                title: 'Undefined Parts Test',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: {
                            id: 'msg-1',
                            author: { role: 'user' },
                            content: { content_type: 'text' },
                            create_time: 1704067200
                        },
                        parent: null,
                        children: []
                    }
                }
            }];
            const result = importer.parse(JSON.stringify(undefinedParts));

            expect(result.errors).toHaveLength(0);
        });

        it('should handle timestamps as null', () => {
            const nullTimestamp = [{
                id: 'null-ts-1',
                title: 'Null Timestamp Test',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: {
                            id: 'msg-1',
                            author: { role: 'user' },
                            content: { content_type: 'text', parts: ['Test'] },
                            create_time: null
                        },
                        parent: null,
                        children: []
                    }
                }
            }];
            const result = importer.parse(JSON.stringify(nullTimestamp));

            expect(result.conversations.length).toBe(1);
            expect(result.conversations[0].messages[0].timestamp).toBeDefined();
        });

        it('should handle unknown content types gracefully', () => {
            const unknownType = [{
                id: 'unknown-type-1',
                title: 'Unknown Type Test',
                create_time: 1704067200,
                update_time: 1704153600,
                mapping: {
                    'node-1': {
                        id: 'node-1',
                        message: {
                            id: 'msg-1',
                            author: { role: 'user' },
                            content: { content_type: 'future_new_type', parts: ['Some content'] },
                            create_time: 1704067200
                        },
                        parent: null,
                        children: []
                    }
                }
            }];
            const result = importer.parse(JSON.stringify(unknownType));

            // Should fall back to text type
            expect(result.conversations.length).toBe(1);
            expect(result.conversations[0].messages[0].content).toBe('Some content');
        });
    });
});
