'use client';

import { CURRENT_PROFILE } from '@/lib/currentProfile';
import {
    Search,
    Brain,
    Tag,
    MoreVertical,
    Edit2,
    Trash2,
    Plus,
    Filter,
    ArrowUpDown
} from 'lucide-react';

export default function MemoryPage() {
    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-stone-900 tracking-tight flex items-center gap-3">
                        <Brain className="text-primary" size={32} />
                        Memory Bank
                    </h1>
                    <p className="text-stone-500 font-medium">Semantic storage of your AI-extracted insights and facts.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-primary transition-colors" size={18} />
                        <input
                            placeholder="Search memories..."
                            className="bg-white border border-stone-200 rounded-2xl pl-11 pr-4 py-3 text-sm text-stone-900 font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 w-full md:w-80 transition-all shadow-sm"
                        />
                    </div>
                    <button className="p-3 rounded-2xl bg-white border border-stone-200 text-stone-900 hover:bg-stone-50 transition-colors shadow-sm">
                        <Filter size={20} />
                    </button>
                    <button className="flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-2xl font-black text-sm hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/10">
                        <Plus size={18} />
                        New insight
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center justify-between px-2 text-[10px] font-black text-stone-400 uppercase tracking-widest">
                    <div className="flex items-center gap-4">
                        <button className="flex items-center gap-1 hover:text-stone-900 transition-colors">
                            Type <ArrowUpDown size={10} />
                        </button>
                        <button className="flex items-center gap-1 hover:text-stone-900 transition-colors">
                            Content <ArrowUpDown size={10} />
                        </button>
                    </div>
                    <span>
                        Total: {CURRENT_PROFILE.longTermMemory.length + CURRENT_PROFILE.shortTermMemory.length}
                    </span>
                </div>

                {CURRENT_PROFILE.longTermMemory.concat(CURRENT_PROFILE.shortTermMemory).map((mem, idx) => (
                    <div key={idx} className="glass-card p-6 rounded-[2rem] flex gap-6 hover:shadow-xl hover:shadow-primary/5 transition-all group relative overflow-hidden border-white/40">
                        {/* Type indicator */}
                        <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 border transition-all ${mem.type === 'technical' ? 'bg-blue-500/10 text-blue-600 border-blue-200/50' :
                                mem.type === 'preference' ? 'bg-purple-500/10 text-purple-600 border-purple-200/50' :
                                    mem.type === 'personal' ? 'bg-pink-500/10 text-pink-600 border-pink-200/50' :
                                        'bg-stone-100 text-stone-600 border-stone-200'
                            }`}>
                            <span className="text-[10px] font-black uppercase tracking-tighter">{mem.type.substring(0, 4)}</span>
                            <Brain size={14} className="mt-1" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-stone-900 font-bold text-sm leading-relaxed mb-4">{mem.content}</p>

                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-stone-50 border border-stone-100">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                                    <span className="text-[10px] font-black text-stone-500 uppercase tracking-tight">{mem.sourceModel}</span>
                                </div>
                                <div className="flex gap-3">
                                    {mem.tags.map(tag => (
                                        <div key={tag} className="flex items-center gap-1 text-stone-400">
                                            <Tag size={10} />
                                            <span className="text-[10px] font-bold">#{tag}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 rounded-xl border border-stone-100 text-stone-400 hover:text-primary hover:bg-primary/5 transition-all" title="Edit memory">
                                <Edit2 size={16} />
                            </button>
                            <button className="p-2 rounded-xl border border-stone-100 text-stone-400 hover:text-red-500 hover:bg-red-50 transition-all" title="Forget memory">
                                <Trash2 size={16} />
                            </button>
                            <button className="p-2 text-stone-300">
                                <MoreVertical size={16} />
                            </button>
                        </div>

                        {/* Sparkle decoration on hover */}
                        <div className="absolute -right-4 -top-4 w-12 h-12 bg-primary/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                ))}
            </div>

            {/* Load More */}
            <div className="flex justify-center pt-4">
                <button className="px-8 py-3 bg-white border border-stone-200 text-stone-500 rounded-2xl text-sm font-black hover:bg-stone-50 transition-colors shadow-sm">
                    Load Archive
                </button>
            </div>
        </div>
    );
}

