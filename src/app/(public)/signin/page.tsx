'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wallet, Mail, KeyRound, Shield } from 'lucide-react';
import { WalletAuth } from '@/components/auth/WalletAuth';
import { EmailAuth } from '@/components/auth/EmailAuth';
import { MnemonicAuth } from '@/components/auth/MnemonicAuth';
import { setVaultSession } from '@/lib/auth/session';

type AuthTab = 'wallet' | 'email' | 'recovery';

const TABS: { id: AuthTab; label: string; icon: React.ReactNode }[] = [
  { id: 'wallet', label: 'Wallet', icon: <Wallet size={18} /> },
  { id: 'email', label: 'Email', icon: <Mail size={18} /> },
  { id: 'recovery', label: 'Recovery', icon: <KeyRound size={18} /> },
];

export default function SignInPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AuthTab>('wallet');
  const [isLoading, setIsLoading] = useState(false);

  const handleWalletConnect = async (address: string) => {
    setIsLoading(true);
    // TODO: Verify wallet ownership and load vault
    console.log('Wallet connected:', address);
    setVaultSession();
    router.push('/dashboard');
  };

  const handleEmailSubmit = async (email: string, password: string) => {
    setIsLoading(true);
    // TODO: Authenticate with email/password
    console.log('Email auth:', email);
    setVaultSession();
    router.push('/dashboard');
  };

  const handleMnemonicSubmit = async (mnemonic: string, password: string) => {
    setIsLoading(true);
    // TODO: Restore vault from mnemonic
    console.log('Mnemonic auth');
    setVaultSession();
    router.push('/dashboard');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <Shield size={32} />
          </div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight mb-2">
            Welcome Back
          </h1>
          <p className="text-sm text-stone-500">
            Sign in to access your identity vault
          </p>
        </div>

        {/* Auth Card */}
        <div className="glass-panel rounded-3xl p-8">
          {/* Tabs */}
          <div className="flex rounded-2xl bg-stone-100 p-1 mb-8">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'wallet' && (
            <WalletAuth onConnect={handleWalletConnect} />
          )}
          {activeTab === 'email' && (
            <EmailAuth onSubmit={handleEmailSubmit} isLoading={isLoading} />
          )}
          {activeTab === 'recovery' && (
            <MnemonicAuth onSubmit={handleMnemonicSubmit} isLoading={isLoading} />
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-stone-500 mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-bold text-primary hover:underline">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
