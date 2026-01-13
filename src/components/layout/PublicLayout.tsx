'use client';

import Link from 'next/link';
import { Shield } from 'lucide-react';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen mesh-gradient">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
              <Shield size={20} />
            </div>
            <span className="text-lg font-black text-stone-900 tracking-tight">Identity Report</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/signin"
              className="px-5 py-2.5 text-sm font-bold text-stone-600 hover:text-stone-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-stone-200/50 mt-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-stone-400" />
            <span className="text-sm font-medium text-stone-500">Identity Report</span>
          </div>
          <p className="text-xs text-stone-400">
            Own your AI context. Privacy-first. Open protocol.
          </p>
        </div>
      </footer>
    </div>
  );
}
