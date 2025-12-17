'use client';

import { useState, useEffect } from 'react';
import { AccessGrant, PortableProfile } from '@/lib/types';
import { vault } from '@/lib/vault/manager';

export function PermissionsList({ profile }: { profile: PortableProfile }) {
    const [grants, setGrants] = useState<AccessGrant[]>(profile.activeGrants || []);
    const [isCreating, setIsCreating] = useState(false);
    const [newGrantee, setNewGrantee] = useState('');

    useEffect(() => {
        // Ensure vault has keys for signing
        vault.initializeDemoMode();
    }, []);

    const handleCreateGrant = async () => {
        if (!newGrantee.trim()) return;
        setIsCreating(true);
        try {
            // Default to 1 hour + read permissions for demo
            const newGrant = await vault.grantAccess(
                newGrantee,
                ['read_memory', 'read_identity'],
                3600
            );

            setGrants([...grants, newGrant]);
            setNewGrantee('');
        } catch (e: any) {
            alert("Failed to create grant: " + e.message);
        } finally {
            setIsCreating(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Copied to clipboard!");
    };

    return (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-stone-200 dark:border-stone-800 flex justify-between items-center bg-stone-50/50 dark:bg-stone-900/50">
                <div>
                    <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">Access Control</h2>
                    <p className="text-stone-500 text-sm">Manage cryptographic permissions.</p>
                </div>

                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Enter Agent ID"
                        className="bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E90FF] focus:border-transparent w-64 shadow-sm"
                        value={newGrantee}
                        onChange={(e) => setNewGrantee(e.target.value)}
                    />
                    <button
                        onClick={handleCreateGrant}
                        disabled={isCreating || !newGrantee}
                        className="px-4 py-1.5 bg-[#1E90FF] hover:bg-[#187bcd] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
                    >
                        {isCreating ? 'Signing...' : 'Grant Access'}
                    </button>
                </div>
            </div>

            <div className="divide-y divide-stone-200 dark:divide-stone-800">
                {grants.length === 0 ? (
                    <div className="p-8 text-center text-stone-500 text-sm italic">
                        No active access grants found.
                    </div>
                ) : (
                    grants.map((grant) => (
                        <div key={grant.id} className="p-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors flex justify-between items-center group">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="font-semibold text-stone-900 dark:text-stone-200">{grant.grantee}</span>
                                    <span className="px-2 py-0.5 rounded-full text-xs bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 border border-stone-200 dark:border-stone-700 font-medium">
                                        {grant.permissions.join(', ')}
                                    </span>
                                </div>
                                <div className="flex gap-4 text-xs text-stone-500 font-mono">
                                    <span>ID: {grant.id.substring(0, 12)}...</span>
                                    <span>Expires: {new Date(grant.expiresAt).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => copyToClipboard(JSON.stringify(grant, null, 2))}
                                className="text-xs text-[#1E90FF] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                COPY JSON
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
