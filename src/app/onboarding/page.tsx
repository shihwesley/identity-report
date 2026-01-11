'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'welcome' | 'create' | 'restore' | 'mnemonic' | 'password' | 'complete';

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>('welcome');
    const [mnemonic, setMnemonic] = useState('');
    const [inputMnemonic, setInputMnemonic] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [mnemonicConfirmed, setMnemonicConfirmed] = useState(false);

    // Generate mnemonic on create
    const handleCreate = async () => {
        setIsLoading(true);
        try {
            // Dynamic import to avoid SSR issues
            const { generateMnemonic } = await import('@/lib/vault/identity');
            const newMnemonic = generateMnemonic();
            setMnemonic(newMnemonic);
            setStep('mnemonic');
        } catch {
            setError('Failed to generate wallet. Please try again.');
        }
        setIsLoading(false);
    };

    // Handle mnemonic confirmation
    const handleConfirmMnemonic = () => {
        setMnemonicConfirmed(true);
        setStep('password');
    };

    // Handle restore flow
    const handleRestore = () => {
        setStep('restore');
    };

    const handleRestoreSubmit = async () => {
        setIsLoading(true);
        setError('');
        try {
            const { validateMnemonic } = await import('@/lib/vault/identity');
            if (!validateMnemonic(inputMnemonic.trim())) {
                setError('Invalid recovery phrase. Please check and try again.');
                setIsLoading(false);
                return;
            }
            setMnemonic(inputMnemonic.trim());
            setStep('password');
        } catch {
            setError('Failed to validate phrase. Please try again.');
        }
        setIsLoading(false);
    };

    // Handle password setup
    const handlePasswordSubmit = async () => {
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const { vault } = await import('@/lib/vault/manager');

            // Create or restore wallet
            if (mnemonicConfirmed) {
                await vault.restoreFromMnemonic(mnemonic);
            } else {
                await vault.restoreFromMnemonic(mnemonic);
            }

            // Unlock with password (this also saves the encrypted vault)
            await vault.unlock(mnemonic, password);

            setStep('complete');
        } catch (e) {
            setError(`Failed to create vault: ${(e as Error).message}`);
        }
        setIsLoading(false);
    };

    // Complete onboarding
    const handleComplete = () => {
        router.push('/');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
                {/* Logo/Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white">Profile Vault</h1>
                    <p className="text-zinc-400 mt-1">Your portable AI conversation identity</p>
                </div>

                {/* Card */}
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 shadow-2xl">

                    {/* Welcome Step */}
                    {step === 'welcome' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h2 className="text-xl font-semibold text-white mb-2">Welcome</h2>
                                <p className="text-zinc-400 text-sm">
                                    Create a secure vault for your AI conversations. Like a crypto wallet,
                                    but for your AI profile.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={handleCreate}
                                    disabled={isLoading}
                                    className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50"
                                >
                                    {isLoading ? 'Creating...' : 'Create New Vault'}
                                </button>

                                <button
                                    onClick={handleRestore}
                                    disabled={isLoading}
                                    className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-all border border-zinc-700"
                                >
                                    Restore from Recovery Phrase
                                </button>
                            </div>

                            <div className="pt-4 border-t border-zinc-800">
                                <div className="flex items-start gap-3 text-xs text-zinc-500">
                                    <svg className="w-4 h-4 mt-0.5 shrink-0 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                    <span>Your data is encrypted locally. Only you can access it with your recovery phrase and password.</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mnemonic Display Step */}
                    {step === 'mnemonic' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h2 className="text-xl font-semibold text-white mb-2">Save Your Recovery Phrase</h2>
                                <p className="text-zinc-400 text-sm">
                                    Write these 12 words down and store them safely. This is the ONLY way to recover your vault.
                                </p>
                            </div>

                            <div className="bg-zinc-950 rounded-xl p-4 border border-amber-500/30">
                                <div className="grid grid-cols-3 gap-2">
                                    {mnemonic.split(' ').map((word, i) => (
                                        <div key={i} className="flex items-center gap-2 bg-zinc-900 rounded-lg px-3 py-2">
                                            <span className="text-zinc-500 text-xs w-4">{i + 1}.</span>
                                            <span className="text-white font-mono text-sm">{word}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                <svg className="w-5 h-5 mt-0.5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <p className="text-amber-200 text-sm">
                                    Never share this phrase with anyone. Anyone with these words can access your vault.
                                </p>
                            </div>

                            <button
                                onClick={handleConfirmMnemonic}
                                className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-violet-500/20"
                            >
                                I&apos;ve Saved My Recovery Phrase
                            </button>
                        </div>
                    )}

                    {/* Restore Step */}
                    {step === 'restore' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h2 className="text-xl font-semibold text-white mb-2">Enter Recovery Phrase</h2>
                                <p className="text-zinc-400 text-sm">
                                    Enter your 12-word recovery phrase to restore your vault.
                                </p>
                            </div>

                            <div>
                                <textarea
                                    value={inputMnemonic}
                                    onChange={(e) => setInputMnemonic(e.target.value)}
                                    placeholder="word1 word2 word3 ..."
                                    rows={3}
                                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                />
                            </div>

                            {error && (
                                <p className="text-red-400 text-sm">{error}</p>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('welcome')}
                                    className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-all"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleRestoreSubmit}
                                    disabled={isLoading || !inputMnemonic.trim()}
                                    className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl font-medium transition-all disabled:opacity-50"
                                >
                                    {isLoading ? 'Verifying...' : 'Continue'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Password Step */}
                    {step === 'password' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h2 className="text-xl font-semibold text-white mb-2">Set Your Password</h2>
                                <p className="text-zinc-400 text-sm">
                                    This password encrypts your vault. You&apos;ll need it along with your recovery phrase to unlock.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">Password</label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="At least 8 characters"
                                        className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">Confirm Password</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm your password"
                                        className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {error && (
                                <p className="text-red-400 text-sm">{error}</p>
                            )}

                            <button
                                onClick={handlePasswordSubmit}
                                disabled={isLoading || !password || !confirmPassword}
                                className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50"
                            >
                                {isLoading ? 'Creating Vault...' : 'Create Vault'}
                            </button>
                        </div>
                    )}

                    {/* Complete Step */}
                    {step === 'complete' && (
                        <div className="space-y-6 text-center">
                            <div className="w-16 h-16 mx-auto rounded-full bg-teal-500/20 flex items-center justify-center">
                                <svg className="w-8 h-8 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>

                            <div>
                                <h2 className="text-xl font-semibold text-white mb-2">Vault Created!</h2>
                                <p className="text-zinc-400 text-sm">
                                    Your Profile Vault is ready. Start importing your AI conversations.
                                </p>
                            </div>

                            <div className="bg-zinc-950 rounded-xl p-4 text-left">
                                <p className="text-xs text-zinc-500 mb-2">Your DID (Decentralized ID)</p>
                                <p className="text-sm text-zinc-300 font-mono break-all">
                                    {/* Will be populated by vault */}
                                    did:key:z...
                                </p>
                            </div>

                            <button
                                onClick={handleComplete}
                                className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-violet-500/20"
                            >
                                Go to Dashboard
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-zinc-600 mt-6">
                    Profile Context Protocol v1.0 — Your AI conversations, your control
                </p>
            </div>
        </div>
    );
}
