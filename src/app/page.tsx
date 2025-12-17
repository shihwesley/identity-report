'use client';

import { CURRENT_PROFILE } from '@/lib/currentProfile';
import { ContextSelector } from '@/components/dashboard/ContextSelector';
import { PermissionsList } from '@/components/dashboard/PermissionsList';
import ConnectWallet from '@/components/dashboard/ConnectWallet';
import { IdentityCard } from '@/components/dashboard/IdentityCard'; // Ensure this matches your export
import { DashboardShell } from '@/components/layout/DashboardShell';
import { useState } from 'react';

// Registry Sync Logic could be moved to a hook, simplified here for UI focus
import { createWalletClient, custom } from 'viem';
import { polygonAmoy } from 'viem/chains';

export default function Home() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handlePublish = async () => {
    // ... (Keep existing sync logic or simplify)
    setIsSyncing(true);
    setTimeout(() => {
      alert("Simulated Sync to Registry");
      setIsSyncing(false);
    }, 1000);
  };

  return (
    <DashboardShell>
      {/* Top Section: Identity + Wallet Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Identity Card */}
        <div className="lg:col-span-2">
          <IdentityCard
            profile={CURRENT_PROFILE}
            did={CURRENT_PROFILE.identity.email ? `did:key:z${CURRENT_PROFILE.identity.email.split('@')[0]}...` : 'did:key:unknown'}
            status="unlocked"
          />
        </div>

        {/* Right: Quick Actions */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 flex flex-col justify-between shadow-sm">
          <div>
            <h3 className="text-xs font-bold text-stone-400 mb-4 uppercase tracking-widest">Vault Actions</h3>
            <div className="space-y-3">
              <button
                onClick={handlePublish}
                disabled={isSyncing}
                className="w-full flex items-center justify-between px-4 py-2 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors group shadow-sm"
              >
                <span className="text-sm font-medium text-stone-700">{isSyncing ? 'Syncing...' : 'Sync to Chain'}</span>
                <span className="text-stone-400 group-hover:text-[#1E90FF] transition-colors">→</span>
              </button>

              <div className="pt-2">
                <ConnectWallet />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-stone-100">
            <div className="flex justify-between text-xs text-stone-400 font-mono">
              <span>NET: AMOY</span>
              <span className="text-emerald-600 font-bold">CONNECTED</span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle: Additional Contexts */}
      <div className="mt-8">
        <h3 className="text-lg font-bold text-stone-900 mb-4 px-1">Active Contexts</h3>
        <ContextSelector projects={CURRENT_PROFILE.projects} />
      </div>

      {/* Bottom: Permissions & Security */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <PermissionsList profile={CURRENT_PROFILE} />
        </div>

        <div className="bg-white rounded-xl p-6 border border-stone-200 shadow-sm h-fit">
          <h3 className="text-base font-bold text-stone-900 mb-4">System Status</h3>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between border-b border-stone-100 pb-2">
              <span className="text-stone-500">Encryption</span>
              <span className="font-mono text-stone-900">AES-256-GCM</span>
            </div>
            <div className="flex justify-between border-b border-stone-100 pb-2">
              <span className="text-stone-500">Signer</span>
              <span className="font-mono text-stone-900">Ed25519</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-stone-500">Storage</span>
              <span className="font-medium text-amber-600">Local (Unsynced)</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
