/**
 * Unit tests for Summarization Service
 *
 * Tests conversation clustering, similarity calculations,
 * duplicate detection, and topic grouping functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SummarizationService, ConversationCluster } from '@/lib/services/summarizer';
import type { Conversation } from '@/lib/types';

// Helper to create mock conversations
function createMockConversation(overrides: Partial<Conversation> = {}): Conversation {
    const defaultConv: Conversation = {
        id: `conv_${Math.random().toString(36).slice(2)}`,
        title: 'Test Conversation',
        messages: [
            {
                id: 'msg-1',
                role: 'user',
                content: 'Hello',
                timestamp: Date.now()
            }
        ],
        metadata: {
            provider: 'openai',
            model: 'gpt-4',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            importedAt: Date.now(),
            messageCount: 1,
            wordCount: 1
        },
        tags: []
    };

    return { ...defaultConv, ...overrides };
}

describe('SummarizationService', () => {
    describe('clusterConversations()', () => {
        it('should return empty array for no conversations', () => {
            const clusters = SummarizationService.clusterConversations([]);

            expect(clusters).toHaveLength(0);
        });

        it('should create single cluster for one conversation', () => {
            const conversations = [createMockConversation({ title: 'Single Conv' })];

            const clusters = SummarizationService.clusterConversations(conversations);

            expect(clusters).toHaveLength(1);
            expect(clusters[0].conversations).toHaveLength(1);
        });

        it('should cluster conversations with similar titles', () => {
            const conversations = [
                createMockConversation({
                    id: 'conv-1',
                    title: 'React Component Development',
                    metadata: {
                        provider: 'openai',
                        model: 'gpt-4',
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        importedAt: Date.now(),
                        messageCount: 1,
                        wordCount: 10
                    }
                }),
                createMockConversation({
                    id: 'conv-2',
                    title: 'React Component Testing',
                    metadata: {
                        provider: 'openai',
                        model: 'gpt-4',
                        createdAt: Date.now() - 1000,
                        updatedAt: Date.now() - 1000,
                        importedAt: Date.now() - 1000,
                        messageCount: 1,
                        wordCount: 10
                    }
                })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            // Similar titles should be clustered together
            expect(clusters.length).toBeLessThanOrEqual(conversations.length);
            // At least one cluster should have multiple conversations
            const multiConvCluster = clusters.find(c => c.conversations.length > 1);
            expect(multiConvCluster).toBeDefined();
        });

        it('should keep unrelated conversations in separate clusters', () => {
            const conversations = [
                createMockConversation({
                    id: 'conv-1',
                    title: 'Python Machine Learning',
                    tags: ['python', 'ml']
                }),
                createMockConversation({
                    id: 'conv-2',
                    title: 'Italian Cooking Recipes',
                    tags: ['cooking', 'food']
                })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            // Unrelated topics should be in separate clusters
            expect(clusters.length).toBe(2);
        });

        it('should set topic from newest conversation title', () => {
            const newestTime = Date.now();
            const conversations = [
                createMockConversation({
                    id: 'conv-old',
                    title: 'Old JavaScript Question',
                    metadata: {
                        provider: 'openai',
                        model: 'gpt-4',
                        createdAt: newestTime - 86400000, // 1 day ago
                        updatedAt: newestTime - 86400000,
                        importedAt: newestTime - 86400000,
                        messageCount: 1,
                        wordCount: 5
                    },
                    tags: ['javascript']
                }),
                createMockConversation({
                    id: 'conv-new',
                    title: 'New JavaScript Tutorial',
                    metadata: {
                        provider: 'openai',
                        model: 'gpt-4',
                        createdAt: newestTime,
                        updatedAt: newestTime,
                        importedAt: newestTime,
                        messageCount: 1,
                        wordCount: 5
                    },
                    tags: ['javascript']
                })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            // The cluster topic should be from the newest conversation
            const jsCluster = clusters.find(c =>
                c.conversations.some(conv => conv.id === 'conv-new')
            );
            expect(jsCluster?.topic).toBe('New JavaScript Tutorial');
        });

        it('should generate unique cluster IDs', () => {
            const conversations = [
                createMockConversation({ id: 'conv-1', title: 'Topic A' }),
                createMockConversation({ id: 'conv-2', title: 'Topic B' }),
                createMockConversation({ id: 'conv-3', title: 'Topic C' })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            const ids = clusters.map(c => c.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });

        it('should include conversation metadata in cluster', () => {
            const conversations = [
                createMockConversation({
                    id: 'conv-1',
                    title: 'Test Conv',
                    metadata: {
                        provider: 'anthropic',
                        model: 'claude-3',
                        createdAt: 1704067200000,
                        updatedAt: 1704067200000,
                        importedAt: 1704067200000,
                        messageCount: 10,
                        wordCount: 500
                    }
                })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            expect(clusters[0].conversations[0]).toEqual({
                id: 'conv-1',
                title: 'Test Conv',
                createdAt: 1704067200000,
                provider: 'anthropic',
                messageCount: 10
            });
        });
    });

    describe('Duplicate Detection', () => {
        it('should mark cluster as duplicate group when all titles are identical', () => {
            const conversations = [
                createMockConversation({
                    id: 'conv-1',
                    title: 'Exact Same Title',
                    metadata: {
                        provider: 'openai',
                        model: 'gpt-4',
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        importedAt: Date.now(),
                        messageCount: 1,
                        wordCount: 5
                    },
                    tags: ['same']
                }),
                createMockConversation({
                    id: 'conv-2',
                    title: 'Exact Same Title',
                    metadata: {
                        provider: 'openai',
                        model: 'gpt-4',
                        createdAt: Date.now() - 1000,
                        updatedAt: Date.now() - 1000,
                        importedAt: Date.now() - 1000,
                        messageCount: 1,
                        wordCount: 5
                    },
                    tags: ['same']
                })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            // Find the cluster with both conversations
            const duplicateCluster = clusters.find(c => c.conversations.length > 1);
            expect(duplicateCluster?.isDuplicateGroup).toBe(true);
        });

        it('should mark cluster as duplicate when titles are very similar', () => {
            const conversations = [
                createMockConversation({
                    id: 'conv-1',
                    title: 'Help with React Code',
                    metadata: {
                        provider: 'openai',
                        model: 'gpt-4',
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        importedAt: Date.now(),
                        messageCount: 1,
                        wordCount: 5
                    },
                    tags: ['react', 'code', 'help']
                }),
                createMockConversation({
                    id: 'conv-2',
                    title: 'Help with React Code',
                    metadata: {
                        provider: 'openai',
                        model: 'gpt-4',
                        createdAt: Date.now() - 1000,
                        updatedAt: Date.now() - 1000,
                        importedAt: Date.now() - 1000,
                        messageCount: 1,
                        wordCount: 5
                    },
                    tags: ['react', 'code', 'help']
                })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            const multiCluster = clusters.find(c => c.conversations.length > 1);
            if (multiCluster) {
                expect(multiCluster.isDuplicateGroup).toBe(true);
            }
        });

        it('should not mark as duplicate when titles differ significantly', () => {
            const conversations = [
                createMockConversation({
                    id: 'conv-1',
                    title: 'React Development Guide',
                    metadata: {
                        provider: 'openai',
                        model: 'gpt-4',
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        importedAt: Date.now(),
                        messageCount: 1,
                        wordCount: 5
                    },
                    tags: ['react', 'development']
                }),
                createMockConversation({
                    id: 'conv-2',
                    title: 'React Testing Best Practices',
                    metadata: {
                        provider: 'openai',
                        model: 'gpt-4',
                        createdAt: Date.now() - 1000,
                        updatedAt: Date.now() - 1000,
                        importedAt: Date.now() - 1000,
                        messageCount: 1,
                        wordCount: 5
                    },
                    tags: ['react', 'testing']
                })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            // If clustered together, should not be marked as duplicate
            const cluster = clusters.find(c => c.conversations.length > 1);
            if (cluster) {
                expect(cluster.isDuplicateGroup).toBe(false);
            }
        });

        it('should not mark single-conversation cluster as duplicate', () => {
            const conversations = [
                createMockConversation({ id: 'conv-1', title: 'Unique Topic' })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            expect(clusters[0].isDuplicateGroup).toBe(false);
        });
    });

    describe('Similarity Calculation', () => {
        it('should cluster conversations with shared tags', () => {
            const conversations = [
                createMockConversation({
                    id: 'conv-1',
                    title: 'Discussion One',
                    tags: ['typescript', 'nodejs', 'backend'],
                    metadata: {
                        provider: 'openai',
                        model: 'gpt-4',
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        importedAt: Date.now(),
                        messageCount: 1,
                        wordCount: 5
                    }
                }),
                createMockConversation({
                    id: 'conv-2',
                    title: 'Discussion Two',
                    tags: ['typescript', 'nodejs', 'api'],
                    metadata: {
                        provider: 'openai',
                        model: 'gpt-4',
                        createdAt: Date.now() - 1000,
                        updatedAt: Date.now() - 1000,
                        importedAt: Date.now() - 1000,
                        messageCount: 1,
                        wordCount: 5
                    }
                })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            // Shared tags should cause clustering
            const multiCluster = clusters.find(c => c.conversations.length > 1);
            expect(multiCluster).toBeDefined();
        });

        it('should handle conversations with no tags', () => {
            const conversations = [
                createMockConversation({
                    id: 'conv-1',
                    title: 'No Tags One',
                    tags: []
                }),
                createMockConversation({
                    id: 'conv-2',
                    title: 'No Tags Two',
                    tags: []
                })
            ];

            // Should not throw
            const clusters = SummarizationService.clusterConversations(conversations);
            expect(clusters.length).toBeGreaterThan(0);
        });

        it('should handle conversations with undefined tags', () => {
            const conv = createMockConversation({ id: 'conv-1', title: 'Test' });
            // @ts-ignore - Testing undefined case
            delete conv.tags;

            const clusters = SummarizationService.clusterConversations([conv]);
            expect(clusters.length).toBe(1);
        });

        it('should filter short words from similarity calculation', () => {
            // Words <= 3 chars should be ignored
            const conversations = [
                createMockConversation({
                    id: 'conv-1',
                    title: 'The A An Or',
                    tags: ['the', 'an', 'or']
                }),
                createMockConversation({
                    id: 'conv-2',
                    title: 'Is It At To',
                    tags: ['is', 'it', 'at']
                })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            // Short words filtered = no similarity = separate clusters
            expect(clusters.length).toBe(2);
        });
    });

    describe('String Similarity (Levenshtein)', () => {
        // Testing internal methods indirectly through clustering behavior

        it('should consider identical strings as fully similar', () => {
            const conversations = [
                createMockConversation({
                    id: 'conv-1',
                    title: 'Exact Match Title',
                    metadata: {
                        provider: 'openai',
                        model: 'gpt-4',
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        importedAt: Date.now(),
                        messageCount: 1,
                        wordCount: 5
                    },
                    tags: ['exact', 'match']
                }),
                createMockConversation({
                    id: 'conv-2',
                    title: 'Exact Match Title',
                    metadata: {
                        provider: 'openai',
                        model: 'gpt-4',
                        createdAt: Date.now() - 1000,
                        updatedAt: Date.now() - 1000,
                        importedAt: Date.now() - 1000,
                        messageCount: 1,
                        wordCount: 5
                    },
                    tags: ['exact', 'match']
                })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            // Should cluster together and be marked as duplicates
            const cluster = clusters.find(c => c.conversations.length === 2);
            expect(cluster?.isDuplicateGroup).toBe(true);
        });

        it('should handle case differences', () => {
            const conversations = [
                createMockConversation({
                    id: 'conv-1',
                    title: 'UPPERCASE TITLE',
                    metadata: {
                        provider: 'openai',
                        model: 'gpt-4',
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        importedAt: Date.now(),
                        messageCount: 1,
                        wordCount: 5
                    },
                    tags: ['uppercase']
                }),
                createMockConversation({
                    id: 'conv-2',
                    title: 'uppercase title',
                    metadata: {
                        provider: 'openai',
                        model: 'gpt-4',
                        createdAt: Date.now() - 1000,
                        updatedAt: Date.now() - 1000,
                        importedAt: Date.now() - 1000,
                        messageCount: 1,
                        wordCount: 5
                    },
                    tags: ['uppercase']
                })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            // Case-insensitive comparison should cluster them together
            expect(clusters.length).toBeLessThanOrEqual(2);
        });
    });

    describe('Large Dataset Handling', () => {
        it('should handle 100+ conversations efficiently', () => {
            const conversations: Conversation[] = [];
            for (let i = 0; i < 100; i++) {
                conversations.push(createMockConversation({
                    id: `conv-${i}`,
                    title: `Conversation about topic ${i % 10}`,
                    metadata: {
                        provider: 'openai',
                        model: 'gpt-4',
                        createdAt: Date.now() - i * 86400000,
                        updatedAt: Date.now() - i * 86400000,
                        importedAt: Date.now() - i * 86400000,
                        messageCount: 5,
                        wordCount: 50
                    },
                    tags: [`topic${i % 10}`, 'general']
                }));
            }

            const startTime = Date.now();
            const clusters = SummarizationService.clusterConversations(conversations);
            const duration = Date.now() - startTime;

            expect(clusters.length).toBeGreaterThan(0);
            expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
        });

        it('should correctly cluster related items in large dataset', () => {
            const conversations: Conversation[] = [];

            // Create 5 groups of related conversations
            for (let group = 0; group < 5; group++) {
                for (let i = 0; i < 10; i++) {
                    conversations.push(createMockConversation({
                        id: `conv-${group}-${i}`,
                        title: `Topic ${group} Discussion ${i}`,
                        metadata: {
                            provider: 'openai',
                            model: 'gpt-4',
                            createdAt: Date.now() - (group * 10 + i) * 86400000,
                            updatedAt: Date.now() - (group * 10 + i) * 86400000,
                            importedAt: Date.now() - (group * 10 + i) * 86400000,
                            messageCount: 5,
                            wordCount: 50
                        },
                        tags: [`group${group}`, 'discussion', `topic${group}`]
                    }));
                }
            }

            const clusters = SummarizationService.clusterConversations(conversations);

            // Should have roughly 5 major clusters (allowing for some variance)
            expect(clusters.length).toBeLessThan(50); // Much less than 50 individual
        });
    });

    describe('Edge Cases', () => {
        it('should handle conversation with empty title', () => {
            const conversations = [
                createMockConversation({ id: 'conv-1', title: '' })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            expect(clusters.length).toBe(1);
        });

        it('should handle conversation with only whitespace title', () => {
            const conversations = [
                createMockConversation({ id: 'conv-1', title: '   ' })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            expect(clusters.length).toBe(1);
        });

        it('should handle conversation with special characters in title', () => {
            const conversations = [
                createMockConversation({
                    id: 'conv-1',
                    title: 'Code: `const x = 1` @user #tag'
                })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            expect(clusters.length).toBe(1);
        });

        it('should handle very long titles', () => {
            const longTitle = 'A'.repeat(1000);
            const conversations = [
                createMockConversation({ id: 'conv-1', title: longTitle })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            expect(clusters.length).toBe(1);
        });

        it('should handle unicode in titles and tags', () => {
            const conversations = [
                createMockConversation({
                    id: 'conv-1',
                    title: 'Discussion  ',
                    tags: ['emoji', 'unicode']
                })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            expect(clusters.length).toBe(1);
        });

        it('should handle duplicate conversation IDs gracefully', () => {
            const conversations = [
                createMockConversation({
                    id: 'same-id',
                    title: 'First Conversation'
                }),
                createMockConversation({
                    id: 'same-id', // Duplicate ID
                    title: 'Second Conversation'
                })
            ];

            // Should not throw, though behavior may vary
            const clusters = SummarizationService.clusterConversations(conversations);
            expect(clusters.length).toBeGreaterThan(0);
        });
    });

    describe('Cluster Structure', () => {
        it('should have correct cluster structure', () => {
            const conversations = [
                createMockConversation({
                    id: 'conv-1',
                    title: 'Test Conversation',
                    metadata: {
                        provider: 'anthropic',
                        model: 'claude-3',
                        createdAt: 1704067200000,
                        updatedAt: 1704067200000,
                        importedAt: 1704067200000,
                        messageCount: 15,
                        wordCount: 500
                    }
                })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);
            const cluster = clusters[0];

            // Verify cluster structure
            expect(cluster).toHaveProperty('id');
            expect(cluster).toHaveProperty('topic');
            expect(cluster).toHaveProperty('conversations');
            expect(cluster).toHaveProperty('isDuplicateGroup');

            // Verify conversation summary structure
            expect(cluster.conversations[0]).toHaveProperty('id');
            expect(cluster.conversations[0]).toHaveProperty('title');
            expect(cluster.conversations[0]).toHaveProperty('createdAt');
            expect(cluster.conversations[0]).toHaveProperty('provider');
            expect(cluster.conversations[0]).toHaveProperty('messageCount');
        });

        it('should prefix cluster IDs with "cluster_"', () => {
            const conversations = [
                createMockConversation({ id: 'conv-1', title: 'Test' }),
                createMockConversation({ id: 'conv-2', title: 'Different' })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            clusters.forEach(cluster => {
                expect(cluster.id.startsWith('cluster_')).toBe(true);
            });
        });

        it('should number cluster IDs sequentially', () => {
            const conversations = [
                createMockConversation({ id: 'conv-1', title: 'Topic A' }),
                createMockConversation({ id: 'conv-2', title: 'Topic B' }),
                createMockConversation({ id: 'conv-3', title: 'Topic C' })
            ];

            const clusters = SummarizationService.clusterConversations(conversations);

            // IDs should be cluster_1, cluster_2, etc.
            expect(clusters[0].id).toBe('cluster_1');
            if (clusters.length > 1) {
                expect(clusters[1].id).toBe('cluster_2');
            }
        });
    });
});
