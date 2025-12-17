import { Conversation, MemoryFragment, UserInsight, EntityType } from '@/lib/types';

export type NodeType = 'root' | 'conversation' | 'memory' | 'insight' | 'tag';

export interface GraphNode {
    id: string;
    label: string;
    type: NodeType;
    val: number; // Size
    color: string;
    desc?: string;
    data?: Conversation | MemoryFragment | UserInsight;
}

export interface GraphLink {
    source: string;
    target: string;
    color?: string;
    width?: number;
    particles?: number; // For visual flow
}

export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}
