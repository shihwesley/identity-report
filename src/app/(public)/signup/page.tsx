'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, Wallet, Mail, Shield, ArrowRight, Check } from 'lucide-react';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { WalletAuth } from '@/components/auth/WalletAuth';

type SignUpOption = 'mnemonic' | 'wallet' | 'email';

const OPTIONS: { id: SignUpOption; icon: React.ReactNode; title: string; description: string; recommended?: boolean }[] = [
  {
    id: 'mnemonic',
    icon: <KeyRound size={24} />,
    title: 'Create with Recovery Phrase',
    description: 'Generate a secure 12-word phrase for full control',
    recommended: true,
  },
  {
    id: 'wallet',
    icon: <Wallet size={24} />,
    title: 'Create with Wallet',
    description: 'Use MetaMask or Coinbase Wallet',
  },
  {
    id: 'email',
    icon: <Mail size={24} />,
    title: 'Create with Email',
    description: 'Quick setup with Google or GitHub',
  },
];

export default function SignUpPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<SignUpOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (selected !== 'mnemonic') return;
    setIsLoading(true);
    router.push('/onboarding');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <Shield size={32} />
          </div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight mb-2">
            Create Your Vault
          </h1>
          <p className="text-sm text-stone-500">
            Choose how to create your identity
          </p>
        </div>

        {/* Options */}
        <div className="space-y-4 mb-8">
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelected(option.id)}
              className={`w-full glass-card p-6 text-left transition-all ${
                selected === option.id
                  ? 'ring-2 ring-primary border-primary'
                  : 'hover:scale-[1.01]'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${
                  selected === option.id ? 'bg-primary text-white' : 'bg-stone-100 text-stone-600'
                } transition-colors`}>
                  {option.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-black text-stone-900">
                      {option.title}
                    </h3>
                    {option.recommended && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary rounded-full">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500">
                    {option.description}
                  </p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  selected === option.id
                    ? 'border-primary bg-primary text-white'
                    : 'border-stone-300'
                }`}>
                  {selected === option.id && <Check size={14} />}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Action Section */}
        {selected === 'email' ? (
          <div className="glass-panel rounded-2xl p-6">
            <p className="text-sm text-stone-500 text-center mb-4">Continue with</p>
            <OAuthButtons />
          </div>
        ) : selected === 'wallet' ? (
          <div className="glass-panel rounded-2xl p-6">
            <WalletAuth onConnect={(address) => {
              setIsLoading(true);
              router.push(`/onboarding?wallet=true&address=${address}`);
            }} />
          </div>
        ) : (
          <button
            onClick={handleContinue}
            disabled={!selected || isLoading}
            className="w-full py-4 bg-primary text-white text-sm font-bold rounded-2xl hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-primary/20 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Continue
                <ArrowRight size={18} />
              </>
            )}
          </button>
        )}

        {/* Footer */}
        <p className="text-center text-sm text-stone-500 mt-6">
          Already have an account?{' '}
          <Link href="/signin" className="font-bold text-primary hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
