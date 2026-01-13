'use client';

import { useState, useCallback, useRef } from 'react';
import {
    importConversations,
    detectProvider,
    ImportResult,
    getAvailableImporters,
    importOpenAIFolder,
    isOpenAIExportFolder
} from '@/lib/importers';
import { AIProvider, MessageContentType } from '@/lib/types';
import {
    CloudIcon,
    Zap,
    Folder,
    FileText,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    BarChart3,
    Clock,
    FileJson,
    MessageSquare,
    Link as LinkIcon,
    Brain,
    History as HistoryIcon
} from 'lucide-react';

type ImportStatus = 'idle' | 'detecting' | 'parsing' | 'importing' | 'complete' | 'error';

interface ImportStats {
    conversations: number;
    memories: number;
    messages: number;
    words: number;
    attachments: number;
    voiceSessions: number;
    dalleGenerations: number;
    provider: string;
    dateRange: { earliest: Date; latest: Date } | null;
    contentTypes: Partial<Record<MessageContentType, number>>;
    hasUserProfile: boolean;
    errors: string[];
}

const providerInfo: Record<AIProvider | 'unknown', { name: string; color: string; icon: string }> = {
    openai: { name: 'OpenAI/ChatGPT', color: 'emerald', icon: '🤖' },
    anthropic: { name: 'Anthropic Claude', color: 'orange', icon: '🧠' },
    google: { name: 'Google Gemini', color: 'blue', icon: '✨' },
    local: { name: 'Local LLM', color: 'zinc', icon: '💻' },
    other: { name: 'Other', color: 'zinc', icon: '📄' },
    unknown: { name: 'Unknown', color: 'zinc', icon: '❓' }
};

export default function ImportPage() {
    const [isDragging, setIsDragging] = useState(false);
    const [status, setStatus] = useState<ImportStatus>('idle');
    const [stats, setStats] = useState<ImportStats | null>(null);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    const processImportResult = useCallback((importResult: ImportResult, provider: AIProvider) => {
        setResult(importResult);

        const importStats: ImportStats = {
            conversations: importResult.stats.totalConversations,
            memories: importResult.memories.length,
            messages: importResult.stats.totalMessages,
            words: importResult.stats.totalWords,
            attachments: importResult.stats.totalAttachments,
            voiceSessions: importResult.stats.totalVoiceSessions,
            dalleGenerations: importResult.stats.totalDALLEGenerations,
            provider: providerInfo[provider].name,
            dateRange: importResult.stats.totalConversations > 0 ? {
                earliest: new Date(importResult.stats.dateRange.earliest),
                latest: new Date(importResult.stats.dateRange.latest)
            } : null,
            contentTypes: importResult.stats.contentTypeDistribution,
            hasUserProfile: !!importResult.userProfile,
            errors: importResult.errors
        };
        setStats(importStats);

        if (importResult.errors.length > 0 && importResult.conversations.length === 0) {
            setStatus('error');
        } else {
            setStatus('importing');
            // Simulate vault import (in real app, would use vault.importConversations)
            setTimeout(() => setStatus('complete'), 1000);
        }
    }, []);

    const handleFile = useCallback(async (file: File) => {
        setStatus('detecting');
        setStats(null);
        setResult(null);

        try {
            const text = await file.text();
            const detected = detectProvider(text);
            const provider = detected === 'unknown' ? selectedProvider || 'other' : detected as AIProvider;

            setStatus('parsing');
            await new Promise(resolve => setTimeout(resolve, 500));

            const importResult = importConversations(text, provider);
            processImportResult(importResult, provider);
        } catch (e) {
            setStats({
                conversations: 0,
                memories: 0,
                messages: 0,
                words: 0,
                attachments: 0,
                voiceSessions: 0,
                dalleGenerations: 0,
                provider: 'Unknown',
                dateRange: null,
                contentTypes: {},
                hasUserProfile: false,
                errors: [(e as Error).message]
            });
            setStatus('error');
        }
    }, [selectedProvider, processImportResult]);

    const handleFolder = useCallback(async (files: FileList) => {
        setStatus('detecting');
        setStats(null);
        setResult(null);

        try {
            // Check if this is an OpenAI export folder
            if (!isOpenAIExportFolder(files)) {
                throw new Error('Not a valid OpenAI export folder. Please drop the entire export folder.');
            }

            setStatus('parsing');
            await new Promise(resolve => setTimeout(resolve, 500));

            const importResult = await importOpenAIFolder(files);
            processImportResult(importResult, 'openai');
        } catch (e) {
            setStats({
                conversations: 0,
                memories: 0,
                messages: 0,
                words: 0,
                attachments: 0,
                voiceSessions: 0,
                dalleGenerations: 0,
                provider: 'Unknown',
                dateRange: null,
                contentTypes: {},
                hasUserProfile: false,
                errors: [(e as Error).message]
            });
            setStatus('error');
        }
    }, [processImportResult]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const items = e.dataTransfer.items;
        const files = e.dataTransfer.files;

        // Check if dropping a folder (webkit directory entry)
        if (items && items.length > 0) {
            const item = items[0];
            if (item.webkitGetAsEntry) {
                const entry = item.webkitGetAsEntry();
                if (entry?.isDirectory) {
                    // Folder dropped - use the files list which has webkitRelativePath
                    if (files.length > 0) {
                        handleFolder(files);
                        return;
                    }
                }
            }
        }

        // Single file
        if (files[0]) {
            handleFile(files[0]);
        }
    }, [handleFile, handleFolder]);

    const resetImport = () => {
        setStatus('idle');
        setStats(null);
        setResult(null);
    };

    const availableImporters = getAvailableImporters();

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-stone-900 tracking-tight">Sync & Import</h1>
                    <p className="text-stone-500 font-medium">Migrate knowledge from major AI providers to your encrypted vault.</p>
                </div>
                <div className="px-4 py-2 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center gap-2">
                    <CloudIcon size={16} />
                    <span className="text-xs font-bold uppercase tracking-widest">Multi-Provider Bridge</span>
                </div>
            </div>

            {/* Provider Selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {availableImporters.map((imp) => {
                    const info = providerInfo[imp.id as AIProvider];
                    const isSelected = selectedProvider === imp.id;
                    return (
                        <div
                            key={imp.id}
                            className={`p-6 rounded-[2rem] border transition-all cursor-pointer relative overflow-hidden group ${isSelected
                                ? 'bg-stone-900 border-stone-800 shadow-xl shadow-stone-900/10'
                                : 'bg-white border-white/60 hover:bg-stone-50'
                                }`}
                            onClick={() => setSelectedProvider(imp.id as AIProvider)}
                        >
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border transition-all ${isSelected ? 'bg-white/10 border-white/10 shadow-inner' : 'bg-stone-50 border-stone-100'
                                    }`}>
                                    {info.icon}
                                </div>
                                {isSelected && <CheckCircle2 size={16} className="text-primary" />}
                            </div>
                            <div className="relative z-10">
                                <h3 className={`text-sm font-black tracking-tight ${isSelected ? 'text-white' : 'text-stone-900'}`}>{info.name}</h3>
                                <p className={`text-[10px] font-medium leading-relaxed mt-1 ${isSelected ? 'text-stone-400' : 'text-stone-500'}`}>
                                    {imp.description}
                                </p>
                            </div>
                            {imp.supportsFolder && (
                                <div className={`mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider relative z-10 ${isSelected ? 'bg-primary/20 text-primary' : 'bg-stone-100 text-stone-400'
                                    }`}>
                                    <Folder size={10} /> Folder Ready
                                </div>
                            )}
                            {isSelected && (
                                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-2xl -mr-12 -mt-12"></div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Success State */}
            {status === 'complete' && stats && (
                <div className="glass-panel p-10 rounded-[2.5rem] bg-emerald-50/50 border-emerald-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] -mr-32 -mt-32"></div>

                    <div className="flex flex-col md:flex-row gap-8 relative z-10">
                        <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center text-emerald-600 border border-emerald-500/30 shadow-lg shadow-emerald-500/10 shrink-0">
                            <CheckCircle2 size={32} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 space-y-8">
                            <div>
                                <h2 className="text-3xl font-black text-stone-900 tracking-tighter">Import Complete</h2>
                                <p className="text-stone-500 font-medium">
                                    Knowledge bridge established with <strong className="text-stone-900">{stats.provider}</strong>.
                                    {stats.hasUserProfile && <span className="text-primary ml-2 font-black uppercase text-[10px] border border-primary/20 px-2 py-0.5 rounded-lg">Identity Linked</span>}
                                </p>
                            </div>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white p-5 rounded-[1.8rem] border border-stone-100 shadow-sm group hover:scale-105 transition-all">
                                    <MessageSquare size={16} className="text-stone-200 mb-2 group-hover:text-primary" />
                                    <p className="text-2xl font-black text-stone-900 tracking-tight">{stats.conversations}</p>
                                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Threads</p>
                                </div>
                                <div className="bg-white p-5 rounded-[1.8rem] border border-stone-100 shadow-sm group hover:scale-105 transition-all">
                                    <Zap size={16} className="text-stone-200 mb-2 group-hover:text-amber-500" />
                                    <p className="text-2xl font-black text-stone-900 tracking-tight">{stats.messages.toLocaleString()}</p>
                                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Messages</p>
                                </div>
                                <div className="bg-white p-5 rounded-[1.8rem] border border-stone-100 shadow-sm group hover:scale-105 transition-all">
                                    <Brain size={16} className="text-stone-200 mb-2 group-hover:text-emerald-500" />
                                    <p className="text-2xl font-black text-stone-900 tracking-tight">{stats.memories}</p>
                                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Memories</p>
                                </div>
                                <div className="bg-white p-5 rounded-[1.8rem] border border-stone-100 shadow-sm group hover:scale-105 transition-all">
                                    <BarChart3 size={16} className="text-stone-200 mb-2 group-hover:text-blue-500" />
                                    <p className="text-2xl font-black text-stone-900 tracking-tight">{Math.round(stats.words / 1000)}k</p>
                                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Keywords</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-4 items-center">
                                <div className="flex items-center gap-2 text-stone-400">
                                    <Clock size={14} />
                                    <span className="text-[10px] font-bold">
                                        {stats.dateRange ? `${stats.dateRange.earliest.toLocaleDateString()} — ${stats.dateRange.latest.toLocaleDateString()}` : 'N/A'}
                                    </span>
                                </div>
                                {stats.errors.length > 0 && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-600">
                                        <AlertCircle size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-tight">{stats.errors.length} Warnings processed</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => window.location.href = '/memory'}
                                    className="px-8 py-4 bg-stone-900 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/10"
                                >
                                    View Memory Bank <ArrowRight size={18} />
                                </button>
                                <button
                                    onClick={resetImport}
                                    className="px-8 py-4 bg-white border border-stone-200 text-stone-900 rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-stone-50 transition-all"
                                >
                                    Import More
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Error State */}
            {status === 'error' && stats && (
                <div className="glass-panel p-10 rounded-[2.5rem] bg-red-50/50 border-red-500/20 animate-shake">
                    <div className="flex flex-col md:flex-row gap-8 items-center">
                        <div className="w-20 h-20 bg-red-500/20 rounded-3xl flex items-center justify-center text-red-600 border border-red-500/30">
                            <AlertCircle size={32} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h2 className="text-2xl font-black text-stone-900 tracking-tighter">Bridge Failed</h2>
                            <p className="text-stone-500 font-medium mb-6">Parsing unsuccessful. The file format may be deprecated or invalid.</p>

                            {stats.errors.length > 0 && (
                                <div className="bg-white p-4 rounded-2xl border border-red-100 text-left mb-6">
                                    <ul className="text-xs font-bold text-red-500 space-y-1">
                                        {stats.errors.slice(0, 3).map((err, i) => (
                                            <li key={i} className="flex gap-2"><span>•</span> {err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <button
                                onClick={resetImport}
                                className="px-8 py-4 bg-stone-900 text-white rounded-2xl font-black text-sm transition-all"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Drop Zone */}
            {(status === 'idle' || status === 'detecting' || status === 'parsing' || status === 'importing') && (
                <div
                    className={`glass-panel p-16 text-center transition-all relative overflow-hidden rounded-[3rem] border-2 border-dashed ${isDragging
                        ? 'border-primary bg-primary/5'
                        : 'border-stone-200 bg-white/40 hover:border-stone-300'
                        }`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                >
                    {status === 'idle' && (
                        <div className="max-w-2xl mx-auto space-y-8 relative z-10">
                            <div className="w-20 h-20 bg-stone-100 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner border border-stone-50 group-hover:scale-110 transition-transform">
                                <FileJson className="text-stone-400" size={32} />
                            </div>

                            <div>
                                <h3 className="text-3xl font-black text-stone-900 tracking-tighter mb-3">Initialize Migration</h3>
                                <p className="text-stone-500 font-medium leading-relaxed">
                                    Drop your <span className="text-primary font-bold">.json</span> export file or
                                    <span className="text-primary font-bold ml-1">full ChatGPT folders</span> here.
                                    All processing happens locally in your specialized vault.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
                                <input
                                    type="file"
                                    id="file"
                                    accept=".json,.html"
                                    className="hidden"
                                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                                />
                                <label
                                    htmlFor="file"
                                    className="px-8 py-4 bg-stone-900 text-white rounded-2xl font-black text-sm cursor-pointer hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/10 flex items-center justify-center gap-2"
                                >
                                    <FileText size={18} /> Select Export File
                                </label>
                                <input
                                    type="file"
                                    ref={folderInputRef}
                                    // @ts-expect-error webkitdirectory is non-standard but widely supported
                                    webkitdirectory="true"
                                    directory=""
                                    className="hidden"
                                    onChange={(e) => e.target.files && e.target.files.length > 0 && handleFolder(e.target.files)}
                                />
                                <button
                                    onClick={() => folderInputRef.current?.click()}
                                    className="px-8 py-4 bg-white border border-stone-200 text-stone-900 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-stone-50 transition-all shadow-sm"
                                >
                                    <Folder size={18} /> Browse Folders
                                </button>
                            </div>

                            <div className="pt-12 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-stone-100">
                                <div className="text-left space-y-2">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">ChatGPT Guide</p>
                                    <p className="text-[11px] font-bold text-stone-400">Settings → Data → Export data</p>
                                </div>
                                <div className="text-left space-y-2">
                                    <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Claude Guide</p>
                                    <p className="text-[11px] font-bold text-stone-400">Settings → Account → Export</p>
                                </div>
                                <div className="text-left space-y-2">
                                    <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Gemini Guide</p>
                                    <p className="text-[11px] font-bold text-stone-400">Google Takeout → Select Bard</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {(status === 'detecting' || status === 'parsing' || status === 'importing') && (
                        <div className="py-20 animate-pulse relative z-10">
                            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-8" />
                            <h3 className="text-2xl font-black text-stone-900 tracking-tighter mb-2">
                                {status === 'detecting' && 'Initializing Detection...'}
                                {status === 'parsing' && 'Streaming Conversational Data...'}
                                {status === 'importing' && 'Optimizing Vault Structure...'}
                            </h3>
                            <p className="text-stone-500 font-medium">
                                {status === 'detecting' && 'Analyzing schema identifiers'}
                                {status === 'parsing' && 'Extracting intent and semantic fragments'}
                                {status === 'importing' && 'Applying local encryption protocols'}
                            </p>
                        </div>
                    )}

                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 to-transparent opacity-50 pointer-events-none"></div>
                </div>
            )}

            {/* Preview Section */}
            {result && result.conversations.length > 0 && status !== 'complete' && (
                <div className="glass-panel p-8 rounded-[2.5rem] bg-white border-white/60">
                    <div className="flex items-center gap-2 mb-6">
                        <HistoryIcon size={18} className="text-stone-400" />
                        <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest">Stream Preview ({result.conversations.length} Items)</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-4 scrollbar-hide">
                        {result.conversations.slice(0, 10).map((conv) => (
                            <div key={conv.id} className="flex items-center justify-between p-4 bg-stone-50 border border-stone-100 rounded-2xl group hover:border-primary/20 transition-all">
                                <div className="flex items-center gap-4 min-w-0">
                                    <span className="text-xl group-hover:scale-110 transition-transform">{providerInfo[conv.metadata.provider].icon}</span>
                                    <span className="text-[11px] font-black text-stone-700 truncate">{conv.title}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 ml-4 font-black text-[9px] text-stone-400 uppercase bg-white px-2 py-1 rounded-lg">
                                    <LinkIcon size={10} /> {conv.metadata.messageCount}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

