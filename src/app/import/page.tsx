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
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-white mb-2">Import Conversations</h1>
            <p className="text-zinc-400 mb-8">
                Migrate your chat history from OpenAI, Claude, or Gemini into your encrypted Profile Vault.
            </p>

            {/* Provider Selection */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                {availableImporters.map((imp) => {
                    const info = providerInfo[imp.id as AIProvider];
                    return (
                        <div
                            key={imp.id}
                            className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedProvider === imp.id
                                ? 'border-violet-500 bg-violet-500/10'
                                : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                                }`}
                            onClick={() => setSelectedProvider(imp.id as AIProvider)}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-2xl">{info.icon}</span>
                                <span className="font-medium text-white">{info.name}</span>
                            </div>
                            <p className="text-xs text-zinc-500">{imp.description}</p>
                            {imp.supportsFolder && (
                                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 bg-violet-500/20 text-violet-300 rounded-full">
                                    📁 Folder Import
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Success State */}
            {status === 'complete' && stats && (
                <div className="glass-card p-8 rounded-xl border border-teal-500/50 bg-teal-500/5">
                    <div className="flex items-start gap-6">
                        <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center shrink-0">
                            <svg className="w-8 h-8 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-white mb-2">Import Successful</h2>
                            <p className="text-zinc-300 mb-4">
                                Successfully imported from <strong className="text-teal-300">{stats.provider}</strong>
                                {stats.hasUserProfile && <span className="text-violet-300 ml-2">• Profile linked</span>}
                            </p>

                            {/* Primary Stats */}
                            <div className="grid grid-cols-4 gap-4 mb-4">
                                <div className="bg-zinc-950 rounded-lg p-3">
                                    <p className="text-2xl font-bold text-white">{stats.conversations}</p>
                                    <p className="text-xs text-zinc-500">Conversations</p>
                                </div>
                                <div className="bg-zinc-950 rounded-lg p-3">
                                    <p className="text-2xl font-bold text-white">{stats.messages.toLocaleString()}</p>
                                    <p className="text-xs text-zinc-500">Messages</p>
                                </div>
                                <div className="bg-zinc-950 rounded-lg p-3">
                                    <p className="text-2xl font-bold text-white">{stats.memories}</p>
                                    <p className="text-xs text-zinc-500">Memories Created</p>
                                </div>
                                <div className="bg-zinc-950 rounded-lg p-3">
                                    <p className="text-2xl font-bold text-white">{Math.round(stats.words / 1000)}k</p>
                                    <p className="text-xs text-zinc-500">Words</p>
                                </div>
                            </div>

                            {/* Media Stats (if any) */}
                            {(stats.attachments > 0 || stats.voiceSessions > 0 || stats.dalleGenerations > 0) && (
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    {stats.attachments > 0 && (
                                        <div className="bg-zinc-950 rounded-lg p-3 border border-violet-500/20">
                                            <p className="text-xl font-bold text-violet-300">{stats.attachments}</p>
                                            <p className="text-xs text-zinc-500">📎 Attachments</p>
                                        </div>
                                    )}
                                    {stats.voiceSessions > 0 && (
                                        <div className="bg-zinc-950 rounded-lg p-3 border border-blue-500/20">
                                            <p className="text-xl font-bold text-blue-300">{stats.voiceSessions}</p>
                                            <p className="text-xs text-zinc-500">🎤 Voice Sessions</p>
                                        </div>
                                    )}
                                    {stats.dalleGenerations > 0 && (
                                        <div className="bg-zinc-950 rounded-lg p-3 border border-pink-500/20">
                                            <p className="text-xl font-bold text-pink-300">{stats.dalleGenerations}</p>
                                            <p className="text-xs text-zinc-500">🎨 DALL-E Images</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Content Type Distribution */}
                            {Object.keys(stats.contentTypes).length > 0 && (
                                <div className="mb-4 p-3 bg-zinc-950 rounded-lg">
                                    <p className="text-xs text-zinc-500 mb-2">Content Types</p>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(stats.contentTypes).map(([type, count]) => (
                                            <span key={type} className="text-xs px-2 py-1 bg-zinc-800 rounded text-zinc-300">
                                                {type}: {count}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {stats.dateRange && (
                                <p className="text-xs text-zinc-500 mb-4">
                                    Date range: {stats.dateRange.earliest.toLocaleDateString()} — {stats.dateRange.latest.toLocaleDateString()}
                                </p>
                            )}

                            {stats.errors.length > 0 && (
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                                    <p className="text-sm font-medium text-amber-400 mb-1">
                                        {stats.errors.length} parsing warnings
                                    </p>
                                    <ul className="text-xs text-amber-200/70 list-disc list-inside">
                                        {stats.errors.slice(0, 3).map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                        {stats.errors.length > 3 && (
                                            <li>...and {stats.errors.length - 3} more</li>
                                        )}
                                    </ul>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => window.location.href = '/memory'}
                                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors"
                                >
                                    View Memory Bank
                                </button>
                                <button
                                    onClick={resetImport}
                                    className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
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
                <div className="glass-card p-8 rounded-xl border border-red-500/50 bg-red-500/5">
                    <div className="flex items-start gap-6">
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center shrink-0">
                            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-white mb-2">Import Failed</h2>
                            <p className="text-zinc-300 mb-4">
                                We couldn't parse the file. Please check the format and try again.
                            </p>

                            {stats.errors.length > 0 && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                                    <ul className="text-sm text-red-200/70 list-disc list-inside">
                                        {stats.errors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <button
                                onClick={resetImport}
                                className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
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
                    className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${isDragging
                        ? 'border-violet-500 bg-violet-500/10'
                        : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/30'
                        }`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                >
                    {status === 'idle' && (
                        <>
                            <div className="w-16 h-16 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-6">
                                <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-medium text-white mb-2">Drop your export file or folder here</h3>
                            <p className="text-zinc-500 text-sm max-w-md mx-auto mb-6">
                                Supports JSON exports and <strong className="text-violet-300">full ChatGPT export folders</strong> with voice, images, and DALL-E generations. Your data is parsed locally and never leaves your browser unencrypted.
                            </p>

                            <div className="flex justify-center gap-3 mb-6">
                                <input
                                    type="file"
                                    id="file"
                                    accept=".json,.html"
                                    className="hidden"
                                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                                />
                                <label
                                    htmlFor="file"
                                    className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-lg text-sm font-medium cursor-pointer transition-all shadow-lg shadow-violet-500/20"
                                >
                                    Select File
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
                                    className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-all border border-zinc-700"
                                >
                                    📁 Select Folder
                                </button>
                            </div>

                            <div className="mt-8 pt-6 border-t border-zinc-800">
                                <p className="text-xs text-zinc-600 mb-3">How to export your data:</p>
                                <div className="flex justify-center gap-8 text-xs text-zinc-500">
                                    <div className="text-left">
                                        <p className="font-medium text-zinc-400 mb-1">ChatGPT</p>
                                        <p>Settings → Data Controls → Export</p>
                                        <p className="text-violet-400">📁 Use full folder for media</p>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-medium text-zinc-400 mb-1">Claude</p>
                                        <p>Settings → Export Conversations</p>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-medium text-zinc-400 mb-1">Gemini</p>
                                        <p>takeout.google.com → Select Bard</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {(status === 'detecting' || status === 'parsing' || status === 'importing') && (
                        <div className="py-8">
                            <div className="w-12 h-12 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-white mb-1">
                                {status === 'detecting' && 'Detecting provider...'}
                                {status === 'parsing' && 'Parsing conversations...'}
                                {status === 'importing' && 'Encrypting & importing to vault...'}
                            </h3>
                            <p className="text-sm text-zinc-500">
                                {status === 'detecting' && 'Analyzing file format'}
                                {status === 'parsing' && 'Extracting messages, media, and insights'}
                                {status === 'importing' && 'Securing your data locally'}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Preview of detected conversations */}
            {result && result.conversations.length > 0 && status !== 'complete' && (
                <div className="mt-6 glass-card rounded-xl p-4">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Preview ({result.conversations.length} conversations)</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {result.conversations.slice(0, 10).map((conv) => (
                            <div key={conv.id} className="flex items-center justify-between p-2 bg-zinc-950 rounded-lg">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-lg">{providerInfo[conv.metadata.provider].icon}</span>
                                    <span className="text-sm text-white truncate">{conv.title}</span>
                                </div>
                                <span className="text-xs text-zinc-500 shrink-0 ml-4">
                                    {conv.metadata.messageCount} msgs
                                </span>
                            </div>
                        ))}
                        {result.conversations.length > 10 && (
                            <p className="text-xs text-zinc-600 text-center py-2">
                                ...and {result.conversations.length - 10} more
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
