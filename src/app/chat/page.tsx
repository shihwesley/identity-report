'use client';

import { useState } from 'react';
import { MOCK_PROFILE } from '@/lib/mockData';

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
        <div className="h-[calc(100vh-8rem)] flex gap-6">
            <div className="flex-1 flex flex-col glass-card rounded-xl overflow-hidden">
                {/* Chat Header */}
                <div className="p-4 border-b border-zinc-700/50 flex justify-between items-center bg-black/20">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${activeModel === 'gpt-4' ? 'bg-green-500' : activeModel === 'gemini-1.5' ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
                        <select
                            value={activeModel}
                            onChange={(e) => setActiveModel(e.target.value as any)}
                            className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                        >
                            <option value="gpt-4">GPT-4 Turbo</option>
                            <option value="gemini-1.5">Gemini 1.5 Pro</option>
                            <option value="claude-3">Claude 3 Opus</option>
                        </select>
                    </div>
                    <div className="text-xs text-zinc-500">Session ID: 8f92-a2b1</div>
                </div>

                {/* Messages */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-lg text-sm leading-relaxed ${msg.role === 'user'
                                    ? 'bg-violet-600 text-white rounded-br-none'
                                    : 'bg-zinc-800/80 text-zinc-200 rounded-bl-none'
                                }`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input */}
                <div className="p-4 border-t border-zinc-700/50 bg-black/20">
                    <div className="relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Type a message..."
                            className="w-full bg-zinc-900/50 border border-zinc-700 rounded-lg pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-violet-500 transition-colors"
                        />
                        <button onClick={handleSend} className="absolute right-2 top-2 p-1.5 bg-violet-600 rounded-md hover:bg-violet-500 transition-colors">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Context HUD */}
            <div className="w-80 hidden lg:flex flex-col gap-4">
                <div className="glass-card p-4 rounded-xl border-l-2 border-teal-500">
                    <h3 className="text-xs font-semibold text-teal-400 uppercase tracking-wider mb-3">Injected Context</h3>
                    <div className="space-y-3">
                        <div className="text-xs">
                            <span className="text-zinc-500">Identity:</span>
                            <p className="text-zinc-300 font-mono mt-1 line-clamp-1">{MOCK_PROFILE.identity.fullName} ({MOCK_PROFILE.identity.role})</p>
                        </div>
                        <div className="text-xs">
                            <span className="text-zinc-500">Active Task:</span>
                            <p className="text-white font-medium mt-1">Vision Pro Subway App</p>
                        </div>
                        <div className="p-2 bg-zinc-900/50 rounded border border-zinc-800">
                            <p className="text-[10px] text-zinc-400 font-mono">
                                &gt; LOAD Memory(mem_1)<br />
                                &gt; LOAD Preference(pref_2)<br />
                                &gt; LOAD TechStack(SwiftUI)
                            </p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-xl border-l-2 border-violet-500 flex-1">
                    <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-3">System Instructions</h3>
                    <div className="space-y-2">
                        {MOCK_PROFILE.preferences.map(pref => (
                            <div key={pref.id} className="text-xs flex gap-2">
                                <span className="text-violet-500/80">●</span>
                                <span className="text-zinc-400">{pref.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
