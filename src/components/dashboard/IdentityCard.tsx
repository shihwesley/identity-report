'use client';

import { PortableProfile } from '@/lib/types';
import { VaultStatus } from '@/lib/types';
import { Shield, Fingerprint, Activity, Key, Globe } from 'lucide-react';

interface IdentityCardProps {
    profile: PortableProfile | null;
    did: string | null;
    status: VaultStatus;
}

export function IdentityCard({ profile, did, status }: IdentityCardProps) {
    if (!profile) {
        return (
            <div className="glass-panel p-8 rounded-3xl flex items-center justify-between overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl -mr-16 -mt-16"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2 text-red-600">
                        <Lock size={20} />
                        <h2 className="text-xl font-bold tracking-tight">Vault Locked</h2>
                    </div>
                    <p className="text-stone-500 text-sm">Identity encryption keys are not active. Please unlock to access your profile.</p>
                </div>
                <button className="relative z-10 px-6 py-2 bg-red-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-500/20 hover:scale-105 transition-transform">
                    Unlock Vault
                </button>
            </div>
        );
    }

    const memoryCount = (profile.shortTermMemory?.length || 0) + (profile.longTermMemory?.length || 0);

    return (
        <div className="glass-panel p-1 rounded-[2.5rem] relative overflow-hidden group">
            {/* Background Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 blur-[60px] -ml-24 -mb-24"></div>

            <div className="relative z-10 bg-white/40 backdrop-blur-md rounded-[2.25rem] p-8 border border-white/40 flex flex-col md:flex-row gap-8 items-start md:items-center">
                {/* Avatar Section */}
                <div className="relative">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-white to-stone-100 p-0.5 shadow-xl">
                        <div className="w-full h-full rounded-[1.4rem] bg-white flex items-center justify-center text-3xl font-bold text-stone-900 overflow-hidden relative">
                            {profile.identity.avatarUrl ? (
                                <img src={profile.identity.avatarUrl} alt={profile.identity.displayName} className="w-full h-full object-cover" />
                            ) : (
                                <span className="bg-gradient-to-br from-primary to-blue-600 bg-clip-text text-transparent uppercase">
                                    {profile.identity.displayName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-white shadow-lg border border-stone-100 flex items-center justify-center text-primary">
                        <Shield size={16} strokeWidth={2.5} />
                    </div>
                </div>

                {/* Identity Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                        <h2 className="text-2xl font-black text-stone-900 tracking-tight">{profile.identity.displayName}</h2>
                        <div className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase tracking-wider flex items-center gap-1">
                            <Activity size={10} />
                            Active DID
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mb-6 group/did cursor-pointer">
                        <Fingerprint size={14} className="text-primary" />
                        <p className="text-stone-400 font-mono text-[11px] truncate hover:text-stone-900 transition-colors">
                            {did || 'did:key:pending...'}
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-stone-400">
                                <Activity size={12} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Memories</span>
                            </div>
                            <p className="text-xl font-black text-stone-900">{memoryCount}</p>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-stone-400">
                                <Globe size={12} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Access</span>
                            </div>
                            <p className="text-xl font-black text-stone-900">{profile.activeGrants?.length || 0}</p>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-stone-400">
                                <Key size={12} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Role</span>
                            </div>
                            <p className="text-sm font-bold text-primary truncate max-w-[100px]">{profile.identity.role || 'Explorer'}</p>
                        </div>
                    </div>
                </div>

                {/* Status Badge */}
                <div className="hidden lg:block">
                    <div className="bg-stone-900 text-white p-4 rounded-2xl shadow-2xl shadow-stone-900/20 space-y-2 min-w-[140px]">
                        <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">System Tier</p>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-black italic">ULTIMATE</span>
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper to avoid build error if Lock icon not imported
function Lock({ size }: { size: number }) {
    return <Shield size={size} />;
}

