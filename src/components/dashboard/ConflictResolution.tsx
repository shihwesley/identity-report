'use client';

/**
 * Conflict Resolution UI
 *
 * Displays sync conflicts and allows users to resolve them.
 * Supports pick-and-edit workflow for smart merge resolution.
 */

import React, { useState, useCallback } from 'react';
import {
    Conflict,
    ConflictEntityType,
    Resolution,
    MemoryConflict,
    ConversationConflict
} from '@/lib/sync/types';
import { MemoryFragment, Conversation, UserInsight, SystemPreference } from '@/lib/types';

// ============================================================
// Types
// ============================================================

interface ConflictResolutionProps {
    conflicts: Conflict[];
    onResolve: (resolutions: Resolution[]) => void;
    onCancel?: () => void;
}

interface ConflictCardProps {
    conflict: Conflict;
    resolution: Resolution | null;
    onResolve: (resolution: Resolution) => void;
}

// ============================================================
// Main Component
// ============================================================

export function ConflictResolution({
    conflicts,
    onResolve,
    onCancel
}: ConflictResolutionProps) {
    const [resolutions, setResolutions] = useState<Map<string, Resolution>>(new Map());
    const [editingConflict, setEditingConflict] = useState<string | null>(null);

    const handleResolve = useCallback((resolution: Resolution) => {
        setResolutions(prev => {
            const next = new Map(prev);
            next.set(resolution.conflictId, resolution);
            return next;
        });
        setEditingConflict(null);
    }, []);

    const handleSubmit = useCallback(() => {
        if (resolutions.size < conflicts.length) {
            const unresolved = conflicts.filter(c => !resolutions.has(c.id));
            alert(`Please resolve all conflicts. ${unresolved.length} remaining.`);
            return;
        }
        onResolve(Array.from(resolutions.values()));
    }, [conflicts, resolutions, onResolve]);

    const resolvedCount = resolutions.size;
    const totalCount = conflicts.length;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-white">
                            Resolve Sync Conflicts
                        </h2>
                        <p className="text-sm text-zinc-400 mt-1">
                            {resolvedCount} of {totalCount} conflicts resolved
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-zinc-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-300"
                                style={{ width: `${(resolvedCount / totalCount) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Conflict List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {conflicts.map(conflict => (
                        <ConflictCard
                            key={conflict.id}
                            conflict={conflict}
                            resolution={resolutions.get(conflict.id) || null}
                            onResolve={handleResolve}
                        />
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-700 flex justify-between">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                        aria-label="Cancel"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={resolvedCount < totalCount}
                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${resolvedCount >= totalCount
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                            }`}
                    >
                        Apply Resolutions ({resolvedCount}/{totalCount})
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// Conflict Card Component
// ============================================================

function ConflictCard({ conflict, resolution, onResolve }: ConflictCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [customValue, setCustomValue] = useState<unknown>(null);
    const [selectedBase, setSelectedBase] = useState<'local' | 'remote'>('local');

    const handleQuickResolve = (choice: 'local' | 'remote') => {
        onResolve({
            conflictId: conflict.id,
            choice,
            resolvedAt: Date.now(),
            resolvedBy: 'user'
        });
    };

    const handleCustomResolve = () => {
        if (customValue) {
            onResolve({
                conflictId: conflict.id,
                choice: 'custom',
                customValue,
                resolvedAt: Date.now(),
                resolvedBy: 'user'
            });
            setIsEditing(false);
        }
    };

    const getIcon = (type: ConflictEntityType) => {
        switch (type) {
            case 'memory': return '🧠';
            case 'conversation': return '💬';
            case 'insight': return '💡';
            case 'preference': return '⚙️';
            case 'project': return '📁';
            case 'identity': return '👤';
            default: return '📄';
        }
    };

    const isResolved = resolution !== null;

    return (
        <div className={`border rounded-lg overflow-hidden transition-colors ${isResolved
                ? 'border-emerald-600 bg-emerald-900/20'
                : 'border-amber-600 bg-amber-900/20'
            }`}>
            {/* Conflict Header */}
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">{getIcon(conflict.type)}</span>
                    <div>
                        <h3 className="font-medium text-white capitalize">
                            {conflict.type} Conflict
                        </h3>
                        <p className="text-sm text-zinc-400">
                            Fields: {conflict.conflictingFields.join(', ')}
                        </p>
                    </div>
                </div>
                {isResolved && (
                    <span className="px-3 py-1 bg-emerald-600 text-white text-sm rounded-full">
                        Resolved: {resolution.choice}
                    </span>
                )}
            </div>

            {/* Comparison View */}
            {!isEditing && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-800/50">
                    <VersionCard
                        label="Local Version"
                        version={conflict.localVersion}
                        type={conflict.type}
                        isSelected={resolution?.choice === 'local'}
                        onClick={() => handleQuickResolve('local')}
                        timestamp={conflict.localModifiedAt}
                    />
                    <VersionCard
                        label="Remote Version"
                        version={conflict.remoteVersion}
                        type={conflict.type}
                        isSelected={resolution?.choice === 'remote'}
                        onClick={() => handleQuickResolve('remote')}
                        timestamp={conflict.remoteModifiedAt}
                    />
                </div>
            )}

            {/* Edit Mode */}
            {isEditing && (
                <div className="p-4 bg-zinc-800/50">
                    <div className="mb-4">
                        <label className="block text-sm text-zinc-400 mb-2">
                            Base version to edit:
                        </label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setSelectedBase('local');
                                    setCustomValue(conflict.localVersion);
                                }}
                                className={`px-3 py-1 rounded ${selectedBase === 'local'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-zinc-700 text-zinc-300'
                                    }`}
                            >
                                Local
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedBase('remote');
                                    setCustomValue(conflict.remoteVersion);
                                }}
                                className={`px-3 py-1 rounded ${selectedBase === 'remote'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-zinc-700 text-zinc-300'
                                    }`}
                            >
                                Remote
                            </button>
                        </div>
                    </div>
                    <ConflictEditor
                        type={conflict.type}
                        value={customValue || (selectedBase === 'local' ? conflict.localVersion : conflict.remoteVersion)}
                        onChange={setCustomValue}
                        conflictingFields={conflict.conflictingFields}
                    />
                    <div className="flex justify-end gap-2 mt-4">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="px-4 py-2 text-zinc-400 hover:text-white"
                            aria-label="Cancel edit"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCustomResolve}
                            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500"
                        >
                            Apply Custom
                        </button>
                    </div>
                </div>
            )}

            {/* Actions */}
            {!isEditing && !isResolved && (
                <div className="p-4 border-t border-zinc-700 flex justify-end">
                    <button
                        onClick={() => {
                            setIsEditing(true);
                            setCustomValue(conflict.localVersion);
                        }}
                        className="px-4 py-2 text-blue-400 hover:text-blue-300"
                    >
                        Edit & Merge
                    </button>
                </div>
            )}
        </div>
    );
}

// ============================================================
// Version Card Component
// ============================================================

interface VersionCardProps {
    label: string;
    version: unknown;
    type: ConflictEntityType;
    isSelected: boolean;
    onClick: () => void;
    timestamp: number;
}

function VersionCard({ label, version, type, isSelected, onClick, timestamp }: VersionCardProps) {
    const renderPreview = () => {
        switch (type) {
            case 'memory':
                const memory = version as MemoryFragment;
                return (
                    <div className="space-y-2">
                        <p className="text-white line-clamp-3">{memory.content}</p>
                        <div className="flex flex-wrap gap-1">
                            {memory.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="px-2 py-0.5 bg-zinc-700 text-xs rounded">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                );

            case 'conversation':
                const conv = version as Conversation;
                return (
                    <div className="space-y-2">
                        <p className="text-white font-medium">{conv.title}</p>
                        <p className="text-sm text-zinc-400">
                            {conv.messages.length} messages
                        </p>
                    </div>
                );

            case 'insight':
                const insight = version as UserInsight;
                return (
                    <div className="space-y-2">
                        <p className="text-white">{insight.content}</p>
                        <p className="text-sm text-zinc-400">
                            Confidence: {Math.round(insight.confidence * 100)}%
                        </p>
                    </div>
                );

            case 'preference':
                const pref = version as SystemPreference;
                return (
                    <div className="space-y-2">
                        <p className="text-white">{pref.key}</p>
                        <p className="text-sm text-zinc-400">{pref.value}</p>
                    </div>
                );

            default:
                return (
                    <pre className="text-xs text-zinc-400 overflow-hidden max-h-32">
                        {JSON.stringify(version, null, 2)}
                    </pre>
                );
        }
    };

    return (
        <button
            onClick={onClick}
            className={`p-4 rounded-lg border-2 text-left transition-all ${isSelected
                    ? 'border-emerald-500 bg-emerald-900/30'
                    : 'border-zinc-600 bg-zinc-800 hover:border-zinc-500'
                }`}
        >
            <div className="flex justify-between items-center mb-3">
                <span className={`text-sm font-medium ${isSelected ? 'text-emerald-400' : 'text-zinc-400'
                    }`}>
                    {label}
                </span>
                {isSelected && (
                    <span className="text-emerald-400">✓</span>
                )}
            </div>
            {renderPreview()}
            <p className="text-xs text-zinc-500 mt-3">
                Modified: {new Date(timestamp).toLocaleString()}
            </p>
        </button>
    );
}

// ============================================================
// Conflict Editor Component
// ============================================================

interface ConflictEditorProps {
    type: ConflictEntityType;
    value: unknown;
    onChange: (value: unknown) => void;
    conflictingFields: string[];
}

function ConflictEditor({ type, value, onChange, conflictingFields }: ConflictEditorProps) {
    const renderEditor = () => {
        switch (type) {
            case 'memory':
                return (
                    <MemoryEditor
                        value={value as MemoryFragment}
                        onChange={onChange}
                        conflictingFields={conflictingFields}
                    />
                );

            case 'insight':
                return (
                    <InsightEditor
                        value={value as UserInsight}
                        onChange={onChange}
                        conflictingFields={conflictingFields}
                    />
                );

            default:
                return (
                    <JsonEditor
                        value={value}
                        onChange={onChange}
                    />
                );
        }
    };

    return (
        <div className="bg-zinc-900 rounded-lg p-4">
            <h4 className="text-sm text-zinc-400 mb-3">
                Edit conflicting fields: {conflictingFields.join(', ')}
            </h4>
            {renderEditor()}
        </div>
    );
}

function MemoryEditor({
    value,
    onChange,
    conflictingFields
}: {
    value: MemoryFragment;
    onChange: (value: MemoryFragment) => void;
    conflictingFields: string[];
}) {
    return (
        <div className="space-y-4">
            {conflictingFields.includes('content') && (
                <div>
                    <label className="block text-sm text-zinc-400 mb-1">Content</label>
                    <textarea
                        value={value.content}
                        onChange={e => onChange({ ...value, content: e.target.value })}
                        className="w-full h-32 bg-zinc-800 border border-zinc-700 rounded p-2 text-white resize-none"
                    />
                </div>
            )}
            {conflictingFields.includes('type') && (
                <div>
                    <label className="block text-sm text-zinc-400 mb-1">Type</label>
                    <select
                        value={value.type}
                        onChange={e => onChange({ ...value, type: e.target.value as any })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
                    >
                        <option value="technical">Technical</option>
                        <option value="personal">Personal</option>
                        <option value="preference">Preference</option>
                        <option value="fact">Fact</option>
                    </select>
                </div>
            )}
            <div>
                <label className="block text-sm text-zinc-400 mb-1">Tags</label>
                <input
                    value={value.tags.join(', ')}
                    onChange={e => onChange({
                        ...value,
                        tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                    })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
                    placeholder="tag1, tag2, tag3"
                />
            </div>
        </div>
    );
}

function InsightEditor({
    value,
    onChange,
    conflictingFields
}: {
    value: UserInsight;
    onChange: (value: UserInsight) => void;
    conflictingFields: string[];
}) {
    return (
        <div className="space-y-4">
            {conflictingFields.includes('content') && (
                <div>
                    <label className="block text-sm text-zinc-400 mb-1">Content</label>
                    <textarea
                        value={value.content}
                        onChange={e => onChange({ ...value, content: e.target.value })}
                        className="w-full h-32 bg-zinc-800 border border-zinc-700 rounded p-2 text-white resize-none"
                    />
                </div>
            )}
            <div>
                <label className="block text-sm text-zinc-400 mb-1">
                    Confidence: {Math.round(value.confidence * 100)}%
                </label>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={value.confidence * 100}
                    onChange={e => onChange({ ...value, confidence: Number(e.target.value) / 100 })}
                    className="w-full"
                />
            </div>
        </div>
    );
}

function JsonEditor({
    value,
    onChange
}: {
    value: unknown;
    onChange: (value: unknown) => void;
}) {
    const [jsonStr, setJsonStr] = useState(JSON.stringify(value, null, 2));
    const [error, setError] = useState<string | null>(null);

    const handleChange = (str: string) => {
        setJsonStr(str);
        try {
            const parsed = JSON.parse(str);
            onChange(parsed);
            setError(null);
        } catch (e) {
            setError((e as Error).message);
        }
    };

    return (
        <div>
            <textarea
                value={jsonStr}
                onChange={e => handleChange(e.target.value)}
                className={`w-full h-48 bg-zinc-800 border rounded p-2 text-white font-mono text-sm resize-none ${error ? 'border-red-500' : 'border-zinc-700'
                    }`}
            />
            {error && (
                <p className="text-red-500 text-sm mt-1">{error}</p>
            )}
        </div>
    );
}

// ============================================================
// Sync Status Component
// ============================================================

interface SyncStatusProps {
    status: 'idle' | 'syncing' | 'conflict' | 'error' | 'offline';
    pendingConflicts: number;
    lastSyncedAt: number | null;
    onResolveConflicts?: () => void;
}

export function SyncStatus({
    status,
    pendingConflicts,
    lastSyncedAt,
    onResolveConflicts
}: SyncStatusProps) {
    const getStatusIcon = () => {
        switch (status) {
            case 'syncing': return '🔄';
            case 'conflict': return '⚠️';
            case 'error': return '❌';
            case 'offline': return '📡';
            default: return '✅';
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'syncing': return 'Syncing...';
            case 'conflict': return `${pendingConflicts} conflict${pendingConflicts !== 1 ? 's' : ''}`;
            case 'error': return 'Sync error';
            case 'offline': return 'Offline';
            default: return 'Synced';
        }
    };

    return (
        <div className="flex items-center gap-2 text-sm">
            <span className={status === 'syncing' ? 'animate-spin' : ''}>
                {getStatusIcon()}
            </span>
            <span className={status === 'conflict' ? 'text-amber-400' : 'text-zinc-400'}>
                {getStatusText()}
            </span>
            {status === 'conflict' && onResolveConflicts && (
                <button
                    onClick={onResolveConflicts}
                    className="px-2 py-0.5 bg-amber-600 text-white text-xs rounded hover:bg-amber-500"
                >
                    Resolve
                </button>
            )}
            {lastSyncedAt && status === 'idle' && (
                <span className="text-zinc-500">
                    {new Date(lastSyncedAt).toLocaleTimeString()}
                </span>
            )}
        </div>
    );
}

// ============================================================
// Tab Authority Indicator
// ============================================================

interface TabAuthorityIndicatorProps {
    hasAuthority: boolean;
    tabCount: number;
}

export function TabAuthorityIndicator({
    hasAuthority,
    tabCount
}: TabAuthorityIndicatorProps) {
    if (tabCount <= 1) return null;

    return (
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${hasAuthority
                ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
            }`}>
            <span className={`w-2 h-2 rounded-full ${hasAuthority ? 'bg-emerald-400' : 'bg-zinc-500'
                }`} />
            <span>
                {hasAuthority ? 'Write access' : 'Read only'}
            </span>
            <span className="text-zinc-500">
                ({tabCount} tabs)
            </span>
        </div>
    );
}

export default ConflictResolution;
