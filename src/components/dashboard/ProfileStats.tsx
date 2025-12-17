'use client';

import { PortableProfile } from '@/lib/types';

export function ProfileStats({ profile }: { profile: PortableProfile }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="glass-card p-5 rounded-xl border-l-2 border-violet-500 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <svg className="w-16 h-16 text-violet-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" /></svg>
                </div>
                <h3 className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">Identity</h3>
                <p className="text-2xl font-bold text-white mt-1">{profile.identity.fullName}</p>
                <p className="text-sm text-zinc-500">{profile.identity.role}</p>
            </div>

            <div className="glass-card p-5 rounded-xl border-l-2 border-teal-500 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <svg className="w-16 h-16 text-teal-500" fill="currentColor" viewBox="0 0 24 24"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.41.21.75-.2.75-.55V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z" /></svg>
                </div>
                <h3 className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">Memory Bank</h3>
                <p className="text-2xl font-bold text-white mt-1">{profile.longTermMemory.length + profile.shortTermMemory.length} Fragments</p>
                <div className="flex gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">{(profile.longTermMemory.filter(m => m.type === 'technical').length / profile.longTermMemory.length * 100).toFixed(0)}% Technical</span>
                </div>
            </div>


            <div className="glass-card p-5 rounded-xl border-l-2 border-pink-500 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <svg className="w-16 h-16 text-pink-500" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3 3.1-3 1.71 0 3.1 1.29 3.1 3v2z" /></svg>
                </div>
                <h3 className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">Vault Status</h3>
                <p className="text-2xl font-bold text-white mt-1">Encrypted</p>
                <div className="flex flex-col gap-1 mt-1">
                    <p className="text-[10px] text-zinc-500 font-mono">DID: did:pkh:eth:0x7a2...</p>
                    <p className="text-[10px] text-green-400">● On-Chain Identity Verified</p>
                </div>
            </div>
        </div>
    );
}
