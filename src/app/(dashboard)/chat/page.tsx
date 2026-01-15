'use client';

import { useState } from 'react';
import { CURRENT_PROFILE } from '@/lib/currentProfile';
import {
    Send,
    Bot,
    User,
    Cpu,
    Shield,
    Maximize2,
    History,
    Sparkles,
    Hash,
    MoreHorizontal
} from 'lucide-react';

export default function ChatPage() {
    const [activeModel, setActiveModel] = useState<'gpt-4' | 'gemini-1.5' | 'claude-3'>('gpt-4');
    const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([
        { role: 'assistant', content: 'Universal Profile loaded. Context "Vision Pro Subway App" is active. How can I help with MapKit implementation?' }
    ]);
    const [input, setInput] = useState('');

    const handleSend = () => {
        if (!input.trim()) return;
        setMessages(prev => [...prev, { role: 'user', content: input }]);
        setTimeout(() => {
            setMessages(prev => [...prev, { role: 'assistant', content: "I've analyzed your memory bank. Based on your preference for MapKit over generic graphs (Memory ID: mem_1), I suggest we stick to standard Apple APIs. Here is a Swift snippet..." }]);
        }, 1000);
        setInput('');
    };

    return (
        <div className="h-[calc(100vh-10rem)] flex gap-6 animate-in">
            {/* Primary Chat Container */}
            <div className="flex-1 flex flex-col glass-panel rounded-[2.5rem] overflow-hidden bg-white/40 shadow-2xl shadow-primary/5">
                {/* Chat Header */}
                <div className="px-6 py-4 border-b border-white/40 flex justify-between items-center bg-white/30 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white shadow-lg">
                                <Bot size={20} strokeWidth={2.5} />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white"></div>
                        </div>
                        <div>
                            <select
                                value={activeModel}
                                onChange={(e) => setActiveModel(e.target.value as typeof activeModel)}
                                className="bg-transparent text-stone-900 font-black text-sm focus:outline-none cursor-pointer tracking-tight"
                            >
                                <option value="gpt-4">GPT-4 Turbo</option>
                                <option value="gemini-1.5">Gemini 1.5 Pro</option>
                                <option value="claude-3">Claude 3 Opus</option>
                            </select>
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Identity: {CURRENT_PROFILE.identity.displayName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="p-2 text-stone-400 hover:text-stone-900 transition-colors">
                            <History size={18} />
                        </button>
                        <button className="p-2 text-stone-400 hover:text-stone-900 transition-colors">
                            <Maximize2 size={18} />
                        </button>
                    </div>
                </div>

                {/* Messages Display */}
                <div className="flex-1 p-8 overflow-y-auto space-y-6 scrollbar-hide">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-white border border-stone-100 text-primary shadow-sm'
                                    }`}>
                                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                                </div>
                                <div className={`p-4 rounded-[1.5rem] text-sm leading-relaxed font-medium shadow-sm border ${msg.role === 'user'
                                        ? 'bg-stone-900 text-white border-stone-800 rounded-tr-none'
                                        : 'bg-white text-stone-800 border-white/60 rounded-tl-none'
                                    }`}>
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input Area */}
                <div className="p-6 bg-white/30 border-t border-white/40">
                    <div className="relative group">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ask based on your profile context..."
                            className="w-full bg-white border border-stone-100 rounded-[2rem] pl-6 pr-14 py-5 text-sm font-bold text-stone-900 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-inner"
                        />
                        <button
                            onClick={handleSend}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-stone-900 text-white rounded-full hover:bg-primary transition-all shadow-lg hover:scale-105 active:scale-95"
                        >
                            <Send size={18} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Context Insights HUD */}
            <div className="w-80 hidden lg:flex flex-col gap-6">
                <div className="glass-panel p-6 rounded-[2rem] border-l-4 border-l-primary relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-2xl -mr-12 -mt-12"></div>

                    <div className="flex items-center gap-2 mb-4 relative z-10">
                        <Sparkles size={16} className="text-primary" />
                        <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Injected Context</h3>
                    </div>

                    <div className="space-y-4 relative z-10">
                        <div>
                            <span className="text-[10px] font-black text-stone-300 uppercase block mb-1">Active Identity</span>
                            <div className="flex items-center gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-100">
                                <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-[10px] font-black">QS</div>
                                <p className="text-[11px] font-black text-stone-900 truncate tracking-tight">{CURRENT_PROFILE.identity.fullName}</p>
                            </div>
                        </div>

                        <div>
                            <span className="text-[10px] font-black text-stone-300 uppercase block mb-1">Current Task</span>
                            <p className="text-sm font-black text-stone-900 tracking-tight ml-1">Vision Pro Development</p>
                        </div>

                        <div className="p-3 bg-stone-900 rounded-2xl border border-stone-800 space-y-2">
                            <div className="flex items-center gap-2 text-primary">
                                <Cpu size={12} />
                                <span className="text-[9px] font-black uppercase">Graph Seeds</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {['SwiftUI', 'MapKit', 'VisionOS'].map(tag => (
                                    <span key={tag} className="text-[8px] font-black text-stone-500 bg-stone-800 px-1.5 py-0.5 rounded uppercase">{tag}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-[2.5rem] bg-stone-900 border-primary/20 flex-1 relative overflow-hidden flex flex-col">
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] -mr-16 -mb-16"></div>

                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Shield size={16} className="text-primary" />
                            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Privacy Rules</h3>
                        </div>
                        <MoreHorizontal size={14} className="text-stone-600" />
                    </div>

                    <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                        {CURRENT_PROFILE.preferences.slice(0, 5).map(pref => (
                            <div key={pref.id} className="flex gap-3 items-start group">
                                <div className="mt-1">
                                    <Hash size={10} className="text-stone-700 group-hover:text-primary transition-colors" />
                                </div>
                                <p className="text-[11px] font-bold text-stone-400 group-hover:text-stone-100 transition-colors leading-relaxed">
                                    {pref.value}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/5">
                        <button className="w-full py-3 bg-stone-800 rounded-2xl text-[10px] font-black text-stone-400 uppercase tracking-widest hover:text-white hover:bg-stone-700 transition-all">
                            Configure Constraints
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

