'use client';

/**
 * Recovery Setup UI
 *
 * Allows users to configure key recovery with guardians.
 * Implements Shamir's Secret Sharing setup workflow.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    Guardian,
    RecoveryConfig,
    RECOVERY_CONSTANTS
} from '@/lib/recovery/types';
import { getGuardianManager, GuardianManager } from '@/lib/recovery/guardian';
import { getExpiryMonitor, ShareExpiryMonitor, ExpiryNotification } from '@/lib/recovery/monitor';

// ============================================================
// Types
// ============================================================

interface RecoverySetupProps {
    encryptionKey: CryptoKey | null;
    onConfigured?: (config: RecoveryConfig) => void;
    onClose?: () => void;
}

interface GuardianInput {
    address: string;
    label: string;
    email?: string;
}

type SetupStep = 'intro' | 'guardians' | 'settings' | 'distribute' | 'confirm' | 'complete';

// ============================================================
// Main Component
// ============================================================

export function RecoverySetup({
    encryptionKey,
    onConfigured,
    onClose
}: RecoverySetupProps) {
    const [step, setStep] = useState<SetupStep>('intro');
    const [guardians, setGuardians] = useState<GuardianInput[]>([
        { address: '', label: '', email: '' },
        { address: '', label: '', email: '' },
        { address: '', label: '', email: '' }
    ]);
    const [threshold, setThreshold] = useState<number>(2);
    const [timeLockHours, setTimeLockHours] = useState<number>(RECOVERY_CONSTANTS.DEFAULT_TIME_LOCK_HOURS);
    const [enableExpiry, setEnableExpiry] = useState(false);
    const [expiryDays, setExpiryDays] = useState<number>(RECOVERY_CONSTANTS.DEFAULT_SHARE_EXPIRY_DAYS);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [config, setConfig] = useState<RecoveryConfig | null>(null);

    const validGuardians = guardians.filter(g => g.address && g.label);
    const canAddMore = guardians.length < RECOVERY_CONSTANTS.MAX_GUARDIANS;
    const canProceed = validGuardians.length >= RECOVERY_CONSTANTS.MIN_GUARDIANS;

    // ============================================================
    // Guardian Management
    // ============================================================

    const addGuardian = useCallback(() => {
        if (canAddMore) {
            setGuardians(prev => [...prev, { address: '', label: '', email: '' }]);
        }
    }, [canAddMore]);

    const removeGuardian = useCallback((index: number) => {
        if (guardians.length > RECOVERY_CONSTANTS.MIN_GUARDIANS) {
            setGuardians(prev => prev.filter((_, i) => i !== index));
        }
    }, [guardians.length]);

    const updateGuardian = useCallback((index: number, field: keyof GuardianInput, value: string) => {
        setGuardians(prev => prev.map((g, i) =>
            i === index ? { ...g, [field]: value } : g
        ));
    }, []);

    // ============================================================
    // Setup Process
    // ============================================================

    const handleSetup = useCallback(async () => {
        if (!encryptionKey) {
            setError('Encryption key not available. Please unlock your vault first.');
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            const manager = getGuardianManager();

            const result = await manager.initializeRecovery(
                encryptionKey,
                validGuardians.map(g => ({
                    address: g.address,
                    label: g.label,
                    email: g.email || undefined
                })),
                {
                    threshold,
                    timeLockHours,
                    enableExpiry,
                    expiryDays: enableExpiry ? expiryDays : undefined
                }
            );

            setConfig(result);
            setStep('distribute');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsProcessing(false);
        }
    }, [encryptionKey, validGuardians, threshold, timeLockHours, enableExpiry, expiryDays]);

    const handleComplete = useCallback(() => {
        if (config) {
            onConfigured?.(config);
        }
        onClose?.();
    }, [config, onConfigured, onClose]);

    // ============================================================
    // Render Steps
    // ============================================================

    const renderIntro = () => (
        <div className="space-y-6">
            <div className="text-center">
                <div className="text-5xl mb-4">🛡️</div>
                <h2 className="text-2xl font-bold text-white mb-2">
                    Protect Your Account
                </h2>
                <p className="text-zinc-400">
                    Set up recovery guardians to ensure you never lose access to your vault,
                    even if you lose your seed phrase.
                </p>
            </div>

            <div className="bg-zinc-800 rounded-lg p-4 space-y-4">
                <h3 className="font-medium text-white">How it works:</h3>
                <ul className="space-y-3 text-sm text-zinc-400">
                    <li className="flex gap-3">
                        <span className="text-emerald-400">1.</span>
                        <span>Choose 3-5 trusted people as your guardians</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="text-emerald-400">2.</span>
                        <span>Each guardian receives a unique recovery share</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="text-emerald-400">3.</span>
                        <span>To recover, collect enough shares from your guardians</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="text-emerald-400">4.</span>
                        <span>A time-lock protects against unauthorized recovery attempts</span>
                    </li>
                </ul>
            </div>

            <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4">
                <p className="text-amber-200 text-sm">
                    <strong>Important:</strong> Choose guardians you trust completely.
                    They won't be able to access your data, but they can help you recover it.
                </p>
            </div>

            <button
                onClick={() => setStep('guardians')}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 transition-colors"
            >
                Get Started
            </button>
        </div>
    );

    const renderGuardians = () => (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-white mb-2">
                    Add Your Guardians
                </h2>
                <p className="text-zinc-400 text-sm">
                    Add {RECOVERY_CONSTANTS.MIN_GUARDIANS}-{RECOVERY_CONSTANTS.MAX_GUARDIANS} trusted people
                    who can help you recover your account.
                </p>
            </div>

            <div className="space-y-4">
                {guardians.map((guardian, index) => (
                    <div key={index} className="bg-zinc-800 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-zinc-400">Guardian {index + 1}</span>
                            {guardians.length > RECOVERY_CONSTANTS.MIN_GUARDIANS && (
                                <button
                                    onClick={() => removeGuardian(index)}
                                    className="text-red-400 hover:text-red-300 text-sm"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                        <input
                            type="text"
                            placeholder="Label (e.g., Mom, Best Friend)"
                            value={guardian.label}
                            onChange={e => updateGuardian(index, 'label', e.target.value)}
                            className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white placeholder-zinc-500"
                        />
                        <input
                            type="text"
                            placeholder="Ethereum address (0x...)"
                            value={guardian.address}
                            onChange={e => updateGuardian(index, 'address', e.target.value)}
                            className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white placeholder-zinc-500 font-mono text-sm"
                        />
                        <input
                            type="email"
                            placeholder="Email (optional, for notifications)"
                            value={guardian.email || ''}
                            onChange={e => updateGuardian(index, 'email', e.target.value)}
                            className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white placeholder-zinc-500"
                        />
                    </div>
                ))}
            </div>

            {canAddMore && (
                <button
                    onClick={addGuardian}
                    className="w-full py-2 border border-dashed border-zinc-600 text-zinc-400 rounded-lg hover:border-zinc-500 hover:text-zinc-300 transition-colors"
                >
                    + Add Another Guardian
                </button>
            )}

            <div className="flex gap-3">
                <button
                    onClick={() => setStep('intro')}
                    className="flex-1 py-3 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
                >
                    Back
                </button>
                <button
                    onClick={() => setStep('settings')}
                    disabled={!canProceed}
                    className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                        canProceed
                            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                            : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                    }`}
                >
                    Continue ({validGuardians.length} guardians)
                </button>
            </div>
        </div>
    );

    const renderSettings = () => (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-white mb-2">
                    Recovery Settings
                </h2>
                <p className="text-zinc-400 text-sm">
                    Configure how recovery will work.
                </p>
            </div>

            <div className="space-y-4">
                {/* Threshold */}
                <div className="bg-zinc-800 rounded-lg p-4">
                    <label className="block text-sm text-zinc-400 mb-2">
                        Required Guardians for Recovery
                    </label>
                    <select
                        value={threshold}
                        onChange={e => setThreshold(Number(e.target.value))}
                        className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white"
                    >
                        {Array.from({ length: validGuardians.length - 1 }, (_, i) => i + 2).map(n => (
                            <option key={n} value={n}>
                                {n} of {validGuardians.length} guardians
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-zinc-500 mt-2">
                        Higher = more secure, but harder to recover if guardians are unavailable
                    </p>
                </div>

                {/* Time Lock */}
                <div className="bg-zinc-800 rounded-lg p-4">
                    <label className="block text-sm text-zinc-400 mb-2">
                        Recovery Time Lock
                    </label>
                    <select
                        value={timeLockHours}
                        onChange={e => setTimeLockHours(Number(e.target.value))}
                        className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white"
                    >
                        <option value={24}>24 hours (minimum)</option>
                        <option value={48}>48 hours</option>
                        <option value={72}>72 hours (recommended)</option>
                        <option value={168}>7 days</option>
                    </select>
                    <p className="text-xs text-zinc-500 mt-2">
                        You can cancel any recovery attempt during this period
                    </p>
                </div>

                {/* Expiry */}
                <div className="bg-zinc-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm text-zinc-400">
                            Share Expiry
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={enableExpiry}
                                onChange={e => setEnableExpiry(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-zinc-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                        </label>
                    </div>
                    {enableExpiry && (
                        <select
                            value={expiryDays}
                            onChange={e => setExpiryDays(Number(e.target.value))}
                            className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white"
                        >
                            <option value={90}>90 days</option>
                            <option value={180}>6 months</option>
                            <option value={365}>1 year</option>
                        </select>
                    )}
                    <p className="text-xs text-zinc-500 mt-2">
                        {enableExpiry
                            ? "You'll be reminded to regenerate shares before they expire"
                            : 'Shares will remain valid indefinitely'}
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-200 text-sm">
                    {error}
                </div>
            )}

            <div className="flex gap-3">
                <button
                    onClick={() => setStep('guardians')}
                    className="flex-1 py-3 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
                >
                    Back
                </button>
                <button
                    onClick={handleSetup}
                    disabled={isProcessing}
                    className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50"
                >
                    {isProcessing ? 'Creating Shares...' : 'Create Recovery Shares'}
                </button>
            </div>
        </div>
    );

    const renderDistribute = () => (
        <div className="space-y-6">
            <div className="text-center">
                <div className="text-5xl mb-4">✅</div>
                <h2 className="text-xl font-bold text-white mb-2">
                    Shares Created Successfully
                </h2>
                <p className="text-zinc-400 text-sm">
                    Now distribute the shares to your guardians.
                </p>
            </div>

            <div className="space-y-3">
                {config?.social?.guardians.map((guardian, index) => (
                    <div
                        key={guardian.id}
                        className="bg-zinc-800 rounded-lg p-4 flex items-center justify-between"
                    >
                        <div>
                            <p className="text-white font-medium">{guardian.label}</p>
                            <p className="text-xs text-zinc-500 font-mono">
                                {guardian.address.slice(0, 8)}...{guardian.address.slice(-6)}
                            </p>
                        </div>
                        <button
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 transition-colors"
                        >
                            Send Share
                        </button>
                    </div>
                ))}
            </div>

            <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4">
                <p className="text-amber-200 text-sm">
                    <strong>Note:</strong> Each guardian will receive a unique share via IPFS.
                    They should store it securely and confirm receipt.
                </p>
            </div>

            <button
                onClick={() => setStep('complete')}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 transition-colors"
            >
                Complete Setup
            </button>
        </div>
    );

    const renderComplete = () => (
        <div className="space-y-6 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-white">
                Recovery Setup Complete
            </h2>
            <p className="text-zinc-400">
                Your account is now protected by {validGuardians.length} guardians.
                {threshold} of them can help you recover your account if needed.
            </p>

            <div className="bg-zinc-800 rounded-lg p-4 text-left space-y-2">
                <div className="flex justify-between">
                    <span className="text-zinc-400">Guardians</span>
                    <span className="text-white">{validGuardians.length}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-zinc-400">Required for Recovery</span>
                    <span className="text-white">{threshold}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-zinc-400">Time Lock</span>
                    <span className="text-white">{timeLockHours} hours</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-zinc-400">Share Expiry</span>
                    <span className="text-white">
                        {enableExpiry ? `${expiryDays} days` : 'Never'}
                    </span>
                </div>
            </div>

            <button
                onClick={handleComplete}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 transition-colors"
            >
                Done
            </button>
        </div>
    );

    // ============================================================
    // Main Render
    // ============================================================

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    {/* Progress */}
                    <div className="flex gap-2 mb-6">
                        {(['intro', 'guardians', 'settings', 'distribute', 'complete'] as SetupStep[]).map((s, i) => (
                            <div
                                key={s}
                                className={`h-1 flex-1 rounded-full ${
                                    ['intro', 'guardians', 'settings', 'distribute', 'complete'].indexOf(step) >= i
                                        ? 'bg-emerald-500'
                                        : 'bg-zinc-700'
                                }`}
                            />
                        ))}
                    </div>

                    {/* Step Content */}
                    {step === 'intro' && renderIntro()}
                    {step === 'guardians' && renderGuardians()}
                    {step === 'settings' && renderSettings()}
                    {step === 'distribute' && renderDistribute()}
                    {step === 'complete' && renderComplete()}
                </div>
            </div>
        </div>
    );
}

// ============================================================
// Recovery Status Component
// ============================================================

interface RecoveryStatusProps {
    onSetup?: () => void;
}

export function RecoveryStatus({ onSetup }: RecoveryStatusProps) {
    const [config, setConfig] = useState<RecoveryConfig | null>(null);
    const [notifications, setNotifications] = useState<ExpiryNotification[]>([]);

    useEffect(() => {
        const manager = getGuardianManager();
        setConfig(manager.getConfig());

        const monitor = getExpiryMonitor({
            onNotification: (notification) => {
                setNotifications(prev => [...prev, notification]);
            }
        });
        monitor.start();

        return () => {
            monitor.stop();
        };
    }, []);

    if (!config || !config.enabled) {
        return (
            <div className="bg-zinc-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-medium">Account Recovery</h3>
                        <p className="text-sm text-zinc-400">Not configured</p>
                    </div>
                    <button
                        onClick={onSetup}
                        className="px-4 py-2 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-500"
                    >
                        Set Up
                    </button>
                </div>
            </div>
        );
    }

    const urgentNotifications = notifications.filter(n => n.severity === 'urgent' && !n.dismissed);

    return (
        <div className="space-y-3">
            {urgentNotifications.length > 0 && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
                    <p className="text-red-200 text-sm">
                        {urgentNotifications[0].message}
                    </p>
                </div>
            )}

            <div className="bg-zinc-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-medium">Account Recovery</h3>
                    <span className="px-2 py-1 bg-emerald-900 text-emerald-300 text-xs rounded">
                        Active
                    </span>
                </div>
                <div className="text-sm text-zinc-400 space-y-1">
                    <p>
                        {config.social?.guardians.length} guardians configured
                    </p>
                    <p>
                        {config.shamir?.threshold} required for recovery
                    </p>
                    {config.shamir?.expiresAt && (
                        <p>
                            Shares expire: {new Date(config.shamir.expiresAt).toLocaleDateString()}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default RecoverySetup;
