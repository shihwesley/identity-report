export class SummarizationService {
    /**
     * Clusters conversations into groups based on title similarity and tags.
     */
    static clusterConversations(conversations) {
        const clusters = [];
        const processed = new Set();
        // Sort by date desc (newest first)
        const sorted = [...conversations].sort((a, b) => b.metadata.createdAt - a.metadata.createdAt);
        for (const conv of sorted) {
            if (processed.has(conv.id))
                continue;
            // Start a new cluster
            const currentCluster = {
                id: `cluster_${clusters.length + 1}`,
                topic: conv.title, // Default topic is the title of the newest conv
                conversations: [],
                isDuplicateGroup: false
            };
            // Add current
            currentCluster.conversations.push(this.mapToSummary(conv));
            processed.add(conv.id);
            // Find related
            for (const candidate of sorted) {
                if (processed.has(candidate.id))
                    continue;
                const similarity = this.calculateSimilarity(conv, candidate);
                // Thresholds
                // High similarity > 0.8 -> Likely Duplicate (same title, same topic)
                // Medium similarity > 0.2 -> Related Topic
                if (similarity > 0.2) {
                    currentCluster.conversations.push(this.mapToSummary(candidate));
                    processed.add(candidate.id);
                }
            }
            // Determine if it's a duplicate group
            // Heuristic: If all titles are identical or very close
            if (currentCluster.conversations.length > 1) {
                const title = currentCluster.conversations[0].title.toLowerCase();
                const allSameTitle = currentCluster.conversations.every(c => this.calculateStringSimilarity(c.title.toLowerCase(), title) > 0.9);
                currentCluster.isDuplicateGroup = allSameTitle;
            }
            clusters.push(currentCluster);
        }
        return clusters;
    }
    static mapToSummary(conv) {
        return {
            id: conv.id,
            title: conv.title,
            createdAt: conv.metadata.createdAt,
            provider: conv.metadata.provider,
            messageCount: conv.metadata.messageCount
        };
    }
    /**
     * Simple Jaccard Index based on title tokens and tags.
     */
    static calculateSimilarity(a, b) {
        const tokensA = this.tokenize(a.title + ' ' + (a.tags || []).join(' '));
        const tokensB = this.tokenize(b.title + ' ' + (b.tags || []).join(' '));
        const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));
        const union = new Set([...tokensA, ...tokensB]);
        if (union.size === 0)
            return 0;
        return intersection.size / union.size;
    }
    static tokenize(text) {
        return new Set(text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3) // Ignore short words
        );
    }
    /**
     * Levienshtein-like check for exact title matches (simplified)
     */
    static calculateStringSimilarity(s1, s2) {
        if (s1 === s2)
            return 1.0;
        // naive inclusion check for now
        if (s1.includes(s2) || s2.includes(s1))
            return 0.8;
        return 0;
    }
}
