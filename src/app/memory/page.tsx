'use client';

import { MOCK_PROFILE } from '@/lib/mockData';

export default function MemoryPage() {
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">Memory Bank</h1>
                <div className="flex gap-2">
                    <input placeholder="Search memories..." className="bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-sm text-white w-64" />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {MOCK_PROFILE.longTermMemory.concat(MOCK_PROFILE.shortTermMemory).map((mem, idx) => (
                    <div key={idx} className="glass-card p-4 rounded-xl flex gap-4 hover:border-violet-500/50 transition-colors group">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${mem.type === 'technical' ? 'bg-blue-500/10 text-blue-400' :
                                mem.type === 'preference' ? 'bg-purple-500/10 text-purple-400' :
                                    'bg-zinc-800 text-zinc-400'
                            }`}>
                            <span className="text-xs font-bold uppercase">{mem.type.substring(0, 3)}</span>
                        </div>
                        <div className="flex-1">
                            <p className="text-white text-sm leading-relaxed">{mem.content}</p>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">{mem.sourceModel}</span>
                                <div className="flex gap-2">
                                    {mem.tags.map(tag => (
                                        <span key={tag} className="text-xs text-zinc-500">#{tag}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end justify-center text-zinc-600 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="text-xs hover:text-white">Edit</button>
                            <button className="text-xs hover:text-red-400">Forget</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
