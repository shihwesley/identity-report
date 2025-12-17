import { Conversation, MemoryFragment, UserInsight } from '@/lib/types';

export type TimelineZoomLevel = 'day' | 'week' | 'month';

export interface TimelineEvent {
    id: string;
    type: 'conversation' | 'memory' | 'insight';
    timestamp: number;
    title: string;
    summary: string;
    source?: string; // e.g. "openai", "claude"
    priority: number; // 1-normal, 2-highlight
    data: Conversation | MemoryFragment | UserInsight;
}

export interface TimelineProps {
    events: TimelineEvent[];
}
