import { PortableProfile } from '@/lib/types';
import { GraphData, GraphNode, GraphLink } from './types';

export interface GraphFilters {
    showConversations: boolean;
    showMemories: boolean;
}

export function transformProfileToGraph(profile: PortableProfile, filters: GraphFilters = { showConversations: true, showMemories: true }): GraphData {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const tagMap = new Map<string, string>(); // tag -> nodeId

    // 1. Root Node (User Identity)
    nodes.push({
        id: 'root',
        label: profile.identity.displayName || 'Me',
        type: 'root',
        val: 20,
        color: '#ffffff',
        desc: 'Identity Root'
    });

    // 2. Process Conversations
    if (filters.showConversations) {
        profile.conversations.forEach(conv => {
            const convNodeId = conv.id;

            nodes.push({
                id: convNodeId,
                label: conv.title.length > 20 ? conv.title.substring(0, 15) + '...' : conv.title,
                type: 'conversation',
                val: 5 + (conv.messages.length / 5), // Size based on length
                color: '#8b5cf6', // Violet
                desc: conv.title,
                data: conv as any
            });

            // Link to Root
            links.push({
                source: 'root',
                target: convNodeId,
                color: 'rgba(139, 92, 246, 0.2)',
                width: 1
            });

            // Process Tags
            conv.tags.forEach(tag => {
                const normalizedTag = tag.toLowerCase();
                let tagNodeId = tagMap.get(normalizedTag);

                if (!tagNodeId) {
                    tagNodeId = `tag_${normalizedTag}`;
                    tagMap.set(normalizedTag, tagNodeId);
                    nodes.push({
                        id: tagNodeId,
                        label: `#${tag}`,
                        type: 'tag',
                        val: 3,
                        color: '#71717a', // Zinc
                        desc: `Tag: ${tag}`
                    });
                }

                // Link Convo -> Tag
                links.push({
                    source: convNodeId,
                    target: tagNodeId!,
                    color: 'rgba(255, 255, 255, 0.1)',
                    width: 0.5
                });
            });
        });
    }

    // 3. Process Memories
    if (filters.showMemories) {
        profile.shortTermMemory.forEach(mem => {
            const memNodeId = mem.id;

            nodes.push({
                id: memNodeId,
                label: mem.content.substring(0, 15) + '...',
                type: 'memory',
                val: 5,
                color: '#10b981', // Emerald
                desc: mem.content,
                data: mem as any
            });

            // Link to Source Conversation if exists
            // (Mock data usually doesn't have this link explicitly in `conversationId` for all, but let's check)
            // If no explicit link, link to Root or calculate
            links.push({
                source: 'root',
                target: memNodeId,
                color: 'rgba(16, 185, 129, 0.2)',
                width: 1
            });

            // Link Memory -> Tags
            mem.tags.forEach(tag => {
                const normalizedTag = tag.toLowerCase();
                let tagNodeId = tagMap.get(normalizedTag);

                if (!tagNodeId) {
                    tagNodeId = `tag_${normalizedTag}`;
                    tagMap.set(normalizedTag, tagNodeId);
                    nodes.push({
                        id: tagNodeId,
                        label: `#${tag}`,
                        type: 'tag',
                        val: 3,
                        color: '#71717a', // Zinc
                        desc: `Tag: ${tag}`
                    });
                }

                links.push({
                    source: memNodeId,
                    target: tagNodeId!,
                    color: 'rgba(16, 185, 129, 0.15)',
                    width: 0.5
                });
            });
        });
    }

    return { nodes, links };
}
