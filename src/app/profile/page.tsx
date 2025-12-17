'use client';

import { useState, useRef } from 'react';
import { MOCK_PROFILE } from '@/lib/mockData';

export default function ProfilePage() {
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const importInputRef = useRef<HTMLInputElement>(null);

    const handleExportVault = async () => {
        setIsExporting(true);
        setBackupStatus(null);

        try {
            const { vault } = await import('@/lib/vault/manager');
            await vault.downloadVaultBackup();
            setBackupStatus({ type: 'success', message: 'Vault backup downloaded successfully!' });
        } catch (e) {
            setBackupStatus({ type: 'error', message: `Export failed: ${(e as Error).message}` });
        }

        setIsExporting(false);
    };

    const handleImportVault = async (file: File) => {
        setIsImporting(true);
        setBackupStatus(null);

        try {
            const { vault } = await import('@/lib/vault/manager');
            const result = await vault.importVaultBackup(file);

            setBackupStatus({
                type: 'success',
                message: `Imported ${result.stats.conversations} conversations, ${result.stats.memories} memories, ${result.stats.blobs} media files`
            });
        } catch (e) {
            setBackupStatus({ type: 'error', message: `Import failed: ${(e as Error).message}` });
        }

        setIsImporting(false);
    };

    return (
        <div>
            <h1 className="text-2xl font-bold text-white mb-6">Profile Identity</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="glass-card p-6 rounded-xl">
                    <div className="flex items-center gap-4 mb-6">
                        <img src={MOCK_PROFILE.identity.avatarUrl} className="w-16 h-16 rounded-full bg-zinc-800" alt="Avatar" />
                        <div>
                            <h2 className="text-xl font-bold text-white">{MOCK_PROFILE.identity.fullName}</h2>
                            <p className="text-zinc-400">{MOCK_PROFILE.identity.email}</p>
                        </div>
                    </div>

                    <form className="space-y-4">
                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Display Name</label>
                            <input type="text" defaultValue={MOCK_PROFILE.identity.displayName} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm text-white" />
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Role</label>
                            <input type="text" defaultValue={MOCK_PROFILE.identity.role} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm text-white" />
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Location</label>
                            <input type="text" defaultValue={MOCK_PROFILE.identity.location} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm text-white" />
                        </div>
                        <div className="pt-4">
                            <button className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white rounded font-medium text-sm">Save Changes</button>
                        </div>
                    </form>
                </div>

                <div className="space-y-6">
                    {/* Vault Backup Section */}
                    <div className="glass-card p-6 rounded-xl border border-violet-500/20">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-violet-500/20 rounded-lg flex items-center justify-center">
                                <span className="text-xl">💾</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Portable Vault</h3>
                                <p className="text-xs text-zinc-500">Export your encrypted profile to take anywhere</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={handleExportVault}
                                disabled={isExporting}
                                className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all"
                            >
                                {isExporting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Exporting...
                                    </>
                                ) : (
                                    <>📦 Download .pvault Backup</>
                                )}
                            </button>

                            <div className="relative">
                                <input
                                    type="file"
                                    ref={importInputRef}
                                    accept=".pvault,.json"
                                    className="hidden"
                                    onChange={(e) => e.target.files?.[0] && handleImportVault(e.target.files[0])}
                                />
                                <button
                                    onClick={() => importInputRef.current?.click()}
                                    disabled={isImporting}
                                    className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 border border-zinc-700 transition-all"
                                >
                                    {isImporting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Importing...
                                        </>
                                    ) : (
                                        <>📥 Import from .pvault</>
                                    )}
                                </button>
                            </div>

                            {backupStatus && (
                                <div className={`p-3 rounded-lg text-sm ${backupStatus.type === 'success'
                                        ? 'bg-teal-500/10 border border-teal-500/30 text-teal-300'
                                        : 'bg-red-500/10 border border-red-500/30 text-red-300'
                                    }`}>
                                    {backupStatus.message}
                                </div>
                            )}

                            <p className="text-xs text-zinc-600 text-center">
                                Your .pvault file is encrypted. You'll need your<br />
                                <span className="text-violet-400">12-word mnemonic + password</span> to unlock it anywhere.
                            </p>
                        </div>
                    </div>

                    <div className="glass-card p-6 rounded-xl">
                        <h3 className="text-lg font-semibold text-white mb-4">Core Preferences</h3>
                        <div className="space-y-3">
                            {MOCK_PROFILE.preferences.map(pref => (
                                <div key={pref.id} className="p-3 bg-zinc-900/50 rounded border border-zinc-800">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-xs font-medium text-teal-400">{pref.key}</span>
                                        <span className="text-[10px] text-zinc-600 uppercase">{pref.category}</span>
                                    </div>
                                    <p className="text-sm text-zinc-300">{pref.value}</p>
                                </div>
                            ))}
                            <button className="w-full py-2 border border-zinc-700 hover:bg-zinc-800 text-zinc-400 rounded text-sm mt-2">+ Add Preference</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
