'use client';

import { CURRENT_PROFILE } from '@/lib/currentProfile';
import { ContextSelector } from '@/components/dashboard/ContextSelector';
import { PermissionsList } from '@/components/dashboard/PermissionsList';
import ConnectWallet from '@/components/dashboard/ConnectWallet';
import { IdentityCard } from '@/components/dashboard/IdentityCard';
import { useState } from 'react';
import {
  CloudIcon,
  ShieldCheck,
  Zap,
  Lock,
  Cpu,
  ArrowUpRight,
  Server
} from 'lucide-react';

export default function Home() {
  const [isSyncing, setIsSyncing] = useState(false);

  const handlePublish = async () => {
    setIsSyncing(true);
    setTimeout(() => {
      alert("Simulated Sync to Registry");
      setIsSyncing(false);
    }, 1000);
  };

  return (
    <>
      {/* Hero Section: Identity + Quick Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Identity Passport - Premium Card */}
        <div className="lg:col-span-8">
          <IdentityCard
            profile={CURRENT_PROFILE}
            did={CURRENT_PROFILE.identity.email ? `did:key:z${CURRENT_PROFILE.identity.email.split('@')[0]}...` : 'did:key:unknown'}
            status="unlocked"
          />
        </div>

        {/* Global Sync Status - Glassy Side Card */}
        <div className="lg:col-span-4 glass-panel rounded-3xl p-8 flex flex-col justify-between overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl"></div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Vault Security</h3>
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <ShieldCheck size={18} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-center text-stone-400">
                  <CloudIcon size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-900">Decentralized Backup</p>
                  <p className="text-[10px] font-medium text-stone-400">IPFS / Pinata Connected</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-8 space-y-3">
            <button
              onClick={handlePublish}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-stone-900 text-white rounded-2xl font-bold text-sm hover:bg-stone-800 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-stone-900/20 disabled:opacity-50"
            >
              {isSyncing ? <Zap className="animate-spin" size={16} /> : <CloudIcon size={16} />}
              {isSyncing ? 'Synchronizing...' : 'Sync to Registry'}
            </button>

            <ConnectWallet />
          </div>
        </div>
      </div>

      {/* Main Grid: Contexts & System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">

        {/* Active Context Explorer */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Cpu size={20} className="text-primary" />
              <h3 className="text-xl font-black text-stone-900 tracking-tight">Active Contexts</h3>
            </div>
            <button className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
              View All <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="glass-card p-2">
            <ContextSelector projects={CURRENT_PROFILE.projects} />
          </div>
        </div>

        {/* Security / System Status Meta */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-panel p-8 rounded-3xl space-y-6">
            <div className="flex items-center gap-2">
              <Server size={18} className="text-stone-400" />
              <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest">Protocol Stack</h3>
            </div>

            <div className="space-y-4">
              {[
                { label: 'Encryption', value: 'AES-256-GCM', icon: Lock, color: 'text-blue-500' },
                { label: 'Signature', value: 'Ed25519', icon: ShieldCheck, color: 'text-emerald-500' },
                { label: 'Storage', value: 'IndexedDB (Local)', icon: Server, color: 'text-amber-500' }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between group cursor-default">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl bg-stone-50 border border-stone-100 ${item.color} transition-colors group-hover:bg-white`}>
                      <item.icon size={14} />
                    </div>
                    <span className="text-xs font-bold text-stone-500">{item.label}</span>
                  </div>
                  <span className="text-[11px] font-black text-stone-900 font-mono bg-stone-50 px-2 py-1 rounded-lg border border-stone-100 group-hover:bg-white transition-colors">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 mt-6 border-t border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">Blockchain Verified</span>
              </div>
              <span className="text-[10px] font-bold text-stone-300">POLY-AMOY</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Permissions Explorer */}
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-4 px-2">
          <Lock size={20} className="text-primary" />
          <h3 className="text-xl font-black text-stone-900 tracking-tight">Active Permissions</h3>
        </div>
        <div className="glass-panel rounded-[2.5rem] overflow-hidden p-2">
          <PermissionsList profile={CURRENT_PROFILE} />
        </div>
      </div>
    </>
  );
}

