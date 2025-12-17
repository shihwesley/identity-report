'use client';

import { PortableProfile } from '@/lib/types';
import { VaultStatus } from '@/lib/types';

interface IdentityCardProps {
    profile: PortableProfile | null;
    did: string | null;
    status: VaultStatus;
}

export function IdentityCard({ profile, did, status }: IdentityCardProps) {
    if (!profile) {
        return (
            <div className="bg-white dark:bg-stone-900 p-6 rounded-xl border border-red-200 dark:border-red-900/50 flex items-center justify-between shadow-sm">
                <div>
                    <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-1">Vault Locked</h2>
                    <p className="text-stone-500 text-sm">Identity encryption keys are not active.</p>
                </div>
            </div>
        );
    }

    const initials = profile.identity.displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <div className="bg-white dark:bg-stone-900 rounded-xl p-6 border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center">
            {/* Avatar / Initials */}
            <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-xl font-medium text-stone-900 dark:text-stone-100 ring-4 ring-stone-50 dark:ring-stone-950">
                {initials}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">{profile.identity.displayName}</h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#1E90FF] border border-blue-100 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-900/30">
                        Verified
                    </span>
                </div>

                <p className="text-stone-500 text-sm truncate mb-4 font-mono text-xs text-opacity-80">
                    {did}
                </p>

                <div className="flex gap-8 text-sm text-stone-600 dark:text-stone-400">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold mb-1">Memories</span>
                        <span className="font-semibold text-lg text-stone-900 dark:text-white leading-none">
                            {(profile.shortTermMemory?.length || 0) + (profile.longTermMemory?.length || 0)}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold mb-1">Permissions</span>
                        <span className="font-semibold text-lg text-stone-900 dark:text-white leading-none">{profile.activeGrants?.length || 0}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
