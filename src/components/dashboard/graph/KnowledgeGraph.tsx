'use client';

import React, { useMemo, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { PortableProfile } from '@/lib/types';
import { transformProfileToGraph } from './utils';
import { GraphNode } from './types';

// Dynamically import ForceGraph3D to avoid SSR issues
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
    ssr: false,
    loading: () => <div className="text-zinc-500 flex items-center justify-center h-full">Loading 3D Graph...</div>
});

interface KnowledgeGraphProps {
    profile: PortableProfile;
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ profile }) => {
    const [filters, setFilters] = useState({ showConversations: true, showMemories: true });
    const [graphData, setGraphData] = useState(transformProfileToGraph(profile, filters));

    // Refresh graph if profile or filters change
    useEffect(() => {
        setGraphData(transformProfileToGraph(profile, filters));
    }, [profile, filters]);

    return (
        <div className="h-full w-full relative bg-zinc-950 rounded-xl overflow-hidden glass-card">
            <div className="absolute top-4 left-4 z-10 p-4 bg-zinc-900/80 backdrop-blur-md rounded-xl border border-zinc-800 shadow-xl">
                <h3 className="text-xl font-bold text-white mb-1">Mind Map</h3>
                <p className="text-xs text-zinc-400 mb-4">Interactive 3D Knowledge Graph</p>

                {/* Filters */}
                <div className="space-y-2 mb-4">
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer hover:text-white transition-colors">
                        <input
                            type="checkbox"
                            checked={filters.showConversations}
                            onChange={(e) => setFilters(prev => ({ ...prev, showConversations: e.target.checked }))}
                            className="rounded border-zinc-700 bg-zinc-800 text-violet-600 focus:ring-violet-500/50"
                        />
                        <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-violet-500"></div> Conversations</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer hover:text-white transition-colors">
                        <input
                            type="checkbox"
                            checked={filters.showMemories}
                            onChange={(e) => setFilters(prev => ({ ...prev, showMemories: e.target.checked }))}
                            className="rounded border-zinc-700 bg-zinc-800 text-emerald-600 focus:ring-emerald-500/50"
                        />
                        <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Memories</span>
                    </label>
                </div>

                <div className="text-[10px] text-zinc-500 pt-2 border-t border-zinc-800">
                    <div className="flex items-center gap-2 mb-1"><div className="w-2 h-2 rounded-full bg-zinc-500"></div> Tag</div>
                    <div>{graphData.nodes.length} Nodes</div>
                </div>
            </div>

            <ForceGraph3D
                graphData={graphData}
                nodeLabel="label"
                nodeColor="color"
                nodeVal="val"
                linkColor="color"
                linkWidth="width"
                linkOpacity={0.3}
                linkDirectionalParticles="particles"
                linkDirectionalParticleSpeed={0.005}
                backgroundColor="rgba(0,0,0,0)" // Transparent to see background
                showNavInfo={false}
                nodeResolution={16}
                onNodeClick={(node: any) => {
                    // Logic to zoom to node or show details could go here
                    console.log('Clicked node:', node);
                }}
            />
        </div>
    );
};
