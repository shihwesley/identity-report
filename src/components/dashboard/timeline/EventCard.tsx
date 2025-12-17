import React from 'react';
import { TimelineEvent } from './types';

interface EventCardProps {
    event: TimelineEvent;
    onClick?: () => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onClick }) => {
    const date = new Date(event.timestamp);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let iconColor = 'bg-zinc-500';
    let borderColor = 'border-zinc-800';

    switch (event.type) {
        case 'conversation':
            iconColor = 'bg-violet-500';
            borderColor = 'border-violet-500/30';
            break;
        case 'memory':
            iconColor = 'bg-emerald-500';
            borderColor = 'border-emerald-500/30';
            break;
        case 'insight':
            iconColor = 'bg-amber-500';
            borderColor = 'border-amber-500/30';
            break;
    }

    return (
        <div
            onClick={onClick}
            className={`group relative flex-none w-72 h-80 flex flex-col p-5 rounded-2xl glass-card hover:bg-white/5 transition-all cursor-pointer border ${borderColor} hover:-translate-y-1 hover:shadow-xl`}
        >
            {/* Top Indicator */}
            <div className="flex justify-between items-start mb-4">
                <div className={`w-8 h-8 rounded-full ${iconColor} flex items-center justify-center shadow-[0_0_15px_currentColor] opacity-80`}>
                    <div className="w-3 h-3 bg-white rounded-full opacity-50"></div>
                </div>
                <span className="text-xs text-zinc-500 font-mono bg-black/40 px-2 py-1 rounded">
                    {timeStr}
                </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 flex flex-col">
                <h4 className="text-white font-bold text-lg leading-tight mb-2 line-clamp-2" title={event.title}>{event.title}</h4>

                <p className="text-sm text-zinc-400 leading-relaxed line-clamp-4 flex-1">
                    {event.summary}
                </p>

                {/* Footer Tags */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
                    <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-white/5 text-zinc-400 border border-white/5">
                        {event.source || 'System'}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-white/5 text-zinc-400 border border-white/5">
                        {event.type}
                    </span>
                </div>
            </div>

            {/* Connector Line (Bottom for horizontal flow visually) */}
            <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 w-1 h-3 ${iconColor} opacity-20`}></div>
        </div>
    );
};
