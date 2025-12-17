'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TimelineEvent, TimelineZoomLevel } from './types';
import { EventCard } from './EventCard';
import { PortableProfile } from '@/lib/types';

interface TimelineViewProps {
    profile: PortableProfile;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ profile }) => {
    const [zoom, setZoom] = useState<TimelineZoomLevel>('day');
    const [filters, setFilters] = useState({ showConversations: true, showMemories: true });
    const containerRef = useRef<HTMLDivElement>(null);

    // Transform Profile Data into Timeline Events
    const events = useMemo(() => {
        const list: TimelineEvent[] = [];

        // Conversations
        if (filters.showConversations) {
            profile.conversations.forEach(c => {
                list.push({
                    id: c.id,
                    type: 'conversation',
                    timestamp: c.metadata.createdAt,
                    title: c.title,
                    summary: c.messages[0]?.content.slice(0, 100) || 'No preview',
                    source: c.metadata.provider,
                    priority: 1,
                    data: c
                });
            });
        }

        // Memories
        if (filters.showMemories) {
            profile.shortTermMemory.forEach(m => {
                list.push({
                    id: m.id,
                    type: 'memory',
                    timestamp: new Date(m.timestamp).getTime(),
                    title: 'Memory Formed',
                    summary: m.content,
                    source: m.sourceModel,
                    priority: 2,
                    data: m
                });
            });
        }

        // Sort descending (newest first)
        return list.sort((a, b) => b.timestamp - a.timestamp);
    }, [profile, filters]);

    // Grouping Logic
    const groupedEvents = useMemo(() => {
        const groups: Record<string, TimelineEvent[]> = {};

        events.forEach(ev => {
            const date = new Date(ev.timestamp);
            let key = date.toDateString(); // Default Day

            if (zoom === 'month') {
                key = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
            }

            if (!groups[key]) groups[key] = [];
            groups[key].push(ev);
        });

        // Convert groups object to an array of [key, events] pairs and sort by date
        const sortedGroups = Object.entries(groups).sort(([keyA], [keyB]) => {
            // Simple date parsing for sorting, might need more robust logic for different zoom levels
            const dateA = new Date(keyA);
            const dateB = new Date(keyB);
            return dateB.getTime() - dateA.getTime(); // Newest first
        });

        return sortedGroups;
    }, [events, zoom]);

    return (
        <div className="relative h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex justify-between items-center mb-6 px-2 shrink-0">
                <div className="flex items-center gap-6">
                    <h3 className="text-xl font-bold text-white">Timeline</h3>

                    {/* Filters */}
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer hover:text-white transition-colors">
                            <input
                                type="checkbox"
                                checked={filters.showConversations}
                                onChange={(e) => setFilters(prev => ({ ...prev, showConversations: e.target.checked }))}
                                className="rounded border-zinc-700 bg-zinc-800 text-violet-600 focus:ring-violet-500/50"
                            />
                            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-violet-500"></div> Chats</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer hover:text-white transition-colors">
                            <input
                                type="checkbox"
                                checked={filters.showMemories}
                                onChange={(e) => setFilters(prev => ({ ...prev, showMemories: e.target.checked }))}
                                className="rounded border-zinc-700 bg-zinc-800 text-emerald-600 focus:ring-emerald-500/50"
                            />
                            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Memories</span>
                        </label>
                    </div>
                </div>

                <div className="flex bg-zinc-900/50 rounded-lg p-1 border border-zinc-800">
                    {(['day', 'week', 'month'] as const).map(z => (
                        <button
                            key={z}
                            onClick={() => setZoom(z)}
                            className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${zoom === z
                                    ? 'bg-violet-600 text-white shadow-lg'
                                    : 'text-zinc-400 hover:text-white'
                                }`}
                        >
                            {z}
                        </button>
                    ))}
                </div>
            </div>

            {/* Horizontal Scrollable Feed */}
            <div
                ref={containerRef}
                className="flex-1 overflow-x-auto overflow-y-hidden flex gap-8 px-8 pb-4 snap-x relative no-scrollbar items-center"
                onWheel={(e) => {
                    // Enable horizontal scrolling with vertical wheel
                    if (containerRef.current) {
                        containerRef.current.scrollLeft += e.deltaY;
                    }
                }}
            >
                {/* Empty State */}
                {groupedEvents.length === 0 && (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500 flex-col gap-2">
                        <span className="text-4xl">📭</span>
                        <p>No events found for this filter.</p>
                    </div>
                )}

                {/* Time Groups */}
                {groupedEvents.map(([dateLabel, groupEvents]) => (
                    <div key={dateLabel} className="flex flex-col h-full shrink-0 snap-start">
                        {/* Group Header */}
                        <div className="text-xs font-medium text-zinc-500 mb-4 sticky left-0 uppercase tracking-wider pl-1 border-l-2 border-zinc-800">
                            {dateLabel}
                        </div>

                        {/* Cards Column/Row */}
                        <div className="flex gap-4 items-center h-full">
                            {groupEvents.map((event) => (
                                <EventCard key={event.id} event={event} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom Scrubber (Visual representation) */}
            <div className="h-12 border-t border-zinc-800/50 flex items-center px-8 bg-zinc-900/20 backdrop-blur-sm shrink-0">
                <div className="w-full h-1 bg-zinc-800 rounded-full relative">
                    <div className="absolute left-0 top-0 w-1/3 h-full bg-violet-600 rounded-full opacity-50"></div>
                    <span className="absolute left-0 -top-6 text-[10px] text-zinc-500">Newest</span>
                    <span className="absolute right-0 -top-6 text-[10px] text-zinc-500">Oldest</span>
                </div>
            </div>
        </div>
    );
};
