'use client';

import Link from 'next/link';
import { Shield, Sparkles, ArrowDown } from 'lucide-react';

export function Hero() {
  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center px-6 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-4xl mx-auto text-center animate-in">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-bold mb-8">
          <Sparkles size={16} />
          <span>Privacy-First AI Context</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-black text-stone-900 tracking-tight leading-[1.1] mb-6">
          Own Your
          <span className="block text-primary">AI Context</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-stone-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Your conversations, memories, and insights—encrypted, portable, and under your control.
          Works with Claude, ChatGPT, Gemini, and any MCP-compatible AI.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="px-8 py-4 bg-primary text-white text-base font-bold rounded-2xl hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-primary/25 flex items-center gap-2"
          >
            <Shield size={20} />
            Get Started
          </Link>
          <button
            onClick={scrollToFeatures}
            className="px-8 py-4 bg-white/60 backdrop-blur-sm border border-stone-200 text-stone-700 text-base font-bold rounded-2xl hover:bg-white hover:border-stone-300 transition-all flex items-center gap-2"
          >
            Learn More
            <ArrowDown size={18} />
          </button>
        </div>

        {/* Hero Visual */}
        <div className="mt-16 relative">
          <div className="glass-panel rounded-3xl p-8 max-w-lg mx-auto">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white shadow-lg">
                <Shield size={24} />
              </div>
              <div className="text-left">
                <p className="text-sm font-black text-stone-900">Your Identity Vault</p>
                <p className="text-xs text-stone-500">Encrypted &bull; Portable &bull; Yours</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-emerald-600">Secure</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-3 bg-stone-100 rounded-full w-full" />
              <div className="h-3 bg-stone-100 rounded-full w-4/5" />
              <div className="h-3 bg-stone-100 rounded-full w-3/5" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
