'use client';

import { useState } from 'react';
import { KeyRound, Lock, Loader2, AlertCircle } from 'lucide-react';

type Props = {
  onSubmit?: (mnemonic: string, password: string) => void;
  isLoading?: boolean;
};

export function MnemonicAuth({ onSubmit, isLoading }: Props) {
  const [mnemonic, setMnemonic] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== 12) {
      setError('Please enter all 12 words of your recovery phrase');
      return;
    }

    if (!password) {
      setError('Please enter your vault password');
      return;
    }

    onSubmit?.(mnemonic.trim(), password);
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
        <div className="flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 leading-relaxed">
            Enter your 12-word recovery phrase to restore access to your vault.
            Never share this phrase with anyone.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="mnemonic" className="block text-xs font-bold text-stone-500 mb-2">
            Recovery Phrase (12 words)
          </label>
          <div className="relative">
            <KeyRound size={18} className="absolute left-4 top-4 text-stone-400" />
            <textarea
              id="mnemonic"
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              placeholder="Enter your 12-word recovery phrase..."
              rows={3}
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-stone-200 bg-white/50 text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none font-mono"
            />
          </div>
        </div>

        <div>
          <label htmlFor="vault-password" className="block text-xs font-bold text-stone-500 mb-2">
            Vault Password
          </label>
          <div className="relative">
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              id="vault-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your vault password"
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-stone-200 bg-white/50 text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Unlocking Vault...
            </>
          ) : (
            'Unlock Vault'
          )}
        </button>
      </form>
    </div>
  );
}
