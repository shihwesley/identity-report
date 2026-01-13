'use client';

import { useState, useRef } from 'react';
import { CURRENT_PROFILE } from '@/lib/currentProfile';
import {
    User,
    Shield,
    Download,
    Upload,
    Mail,
    MapPin,
    Briefcase,
    Save,
    Plus,
    CheckCircle2,
    Lock
} from 'lucide-react';

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
        <div className="max-w-5xl mx-auto space-y-8 animate-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-stone-900 tracking-tight">Profile Identity</h1>
                    <p className="text-stone-500 font-medium">Manage your cryptographic identity and vault settings.</p>
                </div>
                <div className="px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center gap-2">
                    <Shield size={16} />
                    <span className="text-xs font-bold uppercase tracking-widest">End-to-End Encrypted</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Essential Info */}
                <div className="lg:col-span-7 space-y-8">
                    <div className="glass-panel p-8 rounded-[2.5rem] relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16"></div>

                        <div className="flex items-center gap-6 mb-8 relative z-10">
                            <div className="relative group">
                                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-white to-stone-100 p-0.5 shadow-xl transition-all group-hover:scale-105">
                                    <div className="w-full h-full rounded-[1.2rem] bg-white flex items-center justify-center overflow-hidden">
                                        <img
                                            src={CURRENT_PROFILE.identity.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${CURRENT_PROFILE.identity.displayName}`}
                                            className="w-full h-full object-cover"
                                            alt="Avatar"
                                        />
                                    </div>
                                </div>
                                <button className="absolute -bottom-2 -right-2 p-2 bg-white rounded-xl shadow-lg border border-stone-100 text-primary hover:text-blue-600 transition-colors">
                                    <Plus size={14} strokeWidth={3} />
                                </button>
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-stone-900 tracking-tighter">{CURRENT_PROFILE.identity.fullName}</h2>
                                <div className="flex items-center gap-2 text-stone-400 mt-1">
                                    <Mail size={14} />
                                    <p className="text-sm font-medium">{CURRENT_PROFILE.identity.email}</p>
                                </div>
                            </div>
                        </div>

                        <form className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-2 text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">
                                    <User size={10} /> Display Name
                                </label>
                                <input type="text" defaultValue={CURRENT_PROFILE.identity.displayName} className="w-full bg-stone-50 border border-stone-100 rounded-2xl px-4 py-3 text-sm text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-2 text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">
                                    <Briefcase size={10} /> Professional Role
                                </label>
                                <input type="text" defaultValue={CURRENT_PROFILE.identity.role} className="w-full bg-stone-50 border border-stone-100 rounded-2xl px-4 py-3 text-sm text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner" />
                            </div>
                            <div className="md:col-span-2 space-y-1.5">
                                <label className="flex items-center gap-2 text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">
                                    <MapPin size={10} /> Primary Location
                                </label>
                                <input type="text" defaultValue={CURRENT_PROFILE.identity.location} className="w-full bg-stone-50 border border-stone-100 rounded-2xl px-4 py-3 text-sm text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner" />
                            </div>
                            <div className="md:col-span-2 pt-2">
                                <button className="w-full py-4 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-xl shadow-stone-900/10">
                                    <Save size={16} /> Save Identity Changes
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="glass-panel p-8 rounded-[2.5rem]">
                        <div className="flex items-center gap-2 mb-6">
                            <CheckCircle2 size={18} className="text-primary" />
                            <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest">Profile Preferences</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {CURRENT_PROFILE.preferences.map(pref => (
                                <div key={pref.id} className="p-4 bg-white/50 border border-white/60 rounded-2xl hover:shadow-md transition-all group">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-black text-primary uppercase tracking-tighter">{pref.key}</span>
                                        <div className="p-1 rounded-md bg-stone-100 text-stone-400 group-hover:bg-primary group-hover:text-white transition-colors">
                                            <CheckCircle2 size={10} />
                                        </div>
                                    </div>
                                    <p className="text-xs font-bold text-stone-900 leading-tight">{pref.value}</p>
                                </div>
                            ))}
                            <button className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-stone-100 rounded-2xl text-xs font-black text-stone-400 hover:border-primary/20 hover:text-primary transition-all">
                                <Plus size={14} /> Add New Preference
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Vault Actions */}
                <div className="lg:col-span-5 space-y-8">
                    <div className="glass-panel p-8 rounded-[2.5rem] bg-gradient-to-br from-stone-900 to-stone-800 text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/20 blur-3xl -mb-16 -mr-16"></div>

                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-primary border border-white/10">
                                <Lock size={22} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black tracking-tight">Portable Vault</h3>
                                <p className="text-xs text-stone-400 font-medium">Export and backup your encrypted knowledge</p>
                            </div>
                        </div>

                        <div className="space-y-4 relative z-10">
                            <button
                                onClick={handleExportVault}
                                disabled={isExporting}
                                className="w-full py-4 bg-white text-stone-900 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
                            >
                                {isExporting ? (
                                    <div className="w-4 h-4 border-2 border-stone-900/30 border-t-stone-900 rounded-full animate-spin" />
                                ) : (
                                    <Download size={16} strokeWidth={3} />
                                )}
                                Download .pvault Backup
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
                                    className="w-full py-4 bg-stone-800 border border-white/10 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-stone-700 transition-all"
                                >
                                    {isImporting ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Upload size={16} strokeWidth={3} />
                                    )}
                                    Restore from .pvault
                                </button>
                            </div>

                            {backupStatus && (
                                <div className={`p-4 rounded-2xl text-xs font-bold ${backupStatus.type === 'success'
                                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                                    } flex items-center gap-2`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${backupStatus.type === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                                    {backupStatus.message}
                                </div>
                            )}

                            <div className="pt-4 border-t border-white/5 space-y-4">
                                <div className="flex items-start gap-3">
                                    <Shield size={14} className="text-primary shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-stone-500 font-medium leading-relaxed">
                                        Your .pvault file is encrypted using <span className="text-stone-300">AES-256-GCM</span>.
                                        Restoration requires your recovery phrase + vault password.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="glass-panel p-8 rounded-[2.5rem] space-y-6">
                        <div className="flex items-center gap-2">
                            <Shield size={18} className="text-stone-400" />
                            <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest">Protocol Metadata</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-stone-500">DID Method</span>
                                <span className="text-[10px] font-black font-mono bg-stone-900 text-white px-2 py-1 rounded-lg">did:key:ed25519</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-stone-500">Vault Version</span>
                                <span className="text-[10px] font-black font-mono text-stone-900">v2.0.4-stable</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

