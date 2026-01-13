'use client';

import Link from 'next/link';
import { Shield, ArrowRight } from 'lucide-react';

export function CTASection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="glass-panel rounded-[2.5rem] p-12 md:p-16 text-center relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-8">
              <Shield size={32} />
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-stone-900 tracking-tight mb-4">
              Ready to own your AI identity?
            </h2>

            <p className="text-stone-500 max-w-lg mx-auto mb-10">
              Create your encrypted vault in minutes. Your data stays yours, forever.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="px-8 py-4 bg-primary text-white text-base font-bold rounded-2xl hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-primary/25 flex items-center gap-2"
              >
                Create Your Vault
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/signin"
                className="text-sm font-bold text-stone-500 hover:text-primary transition-colors"
              >
                Already have an account? Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
