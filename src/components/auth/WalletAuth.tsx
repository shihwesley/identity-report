'use client';

import { useState } from 'react';
import { Wallet } from 'lucide-react';

type WalletProvider = {
  name: string;
  icon: string;
  id: string;
};

const WALLET_PROVIDERS: WalletProvider[] = [
  { name: 'MetaMask', icon: '🦊', id: 'metamask' },
  { name: 'Coinbase Wallet', icon: '💼', id: 'coinbase' },
];

type Props = {
  onConnect?: (address: string) => void;
};

export function WalletAuth({ onConnect }: Props) {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (providerId: string) => {
    setConnecting(providerId);
    setError(null);

    try {
      // Check for ethereum provider (EIP-6963)
      if (typeof window !== 'undefined' && 'ethereum' in window) {
        const ethereum = window.ethereum as { request: (args: { method: string }) => Promise<string[]> };
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts[0]) {
          onConnect?.(accounts[0]);
        }
      } else {
        setError('No wallet detected. Please install MetaMask or Coinbase Wallet.');
      }
    } catch (err) {
      setError('Failed to connect wallet. Please try again.');
      console.error(err);
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div className="space-y-4">
      {WALLET_PROVIDERS.map((provider) => (
        <button
          key={provider.id}
          onClick={() => handleConnect(provider.id)}
          disabled={connecting !== null}
          className="w-full flex items-center gap-4 p-4 rounded-2xl border border-stone-200 hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50"
        >
          <span className="text-2xl">{provider.icon}</span>
          <span className="text-sm font-bold text-stone-900">{provider.name}</span>
          {connecting === provider.id && (
            <div className="ml-auto">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </button>
      ))}

      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}

      <div className="pt-4 border-t border-stone-100">
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <Wallet size={14} />
          <span>Connect your Web3 wallet to sign in</span>
        </div>
      </div>
    </div>
  );
}
