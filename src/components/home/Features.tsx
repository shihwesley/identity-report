'use client';

import { Plug, Brain, Upload } from 'lucide-react';

const FEATURES = [
  {
    icon: Plug,
    title: 'Works with Any AI',
    description: 'Connect to Claude, ChatGPT, Gemini via MCP protocol. Your context follows you across providers.',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    icon: Brain,
    title: 'Persistent Memory',
    description: 'AI remembers your preferences, projects, and history across sessions. No more starting from scratch.',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  {
    icon: Upload,
    title: 'Import Everything',
    description: 'Bring existing conversations from OpenAI, Anthropic, Google. Streaming support for large exports.',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 tracking-tight mb-4">
            Your AI, Your Rules
          </h2>
          <p className="text-stone-500 max-w-xl mx-auto">
            Take control of your AI interactions with portable, encrypted identity that works everywhere.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((feature, idx) => (
            <div
              key={idx}
              className="glass-card p-8 group hover:scale-[1.02] transition-all duration-300"
            >
              <div className={`w-14 h-14 rounded-2xl ${feature.bgColor} ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <feature.icon size={28} />
              </div>
              <h3 className="text-lg font-black text-stone-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-sm text-stone-500 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
