'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutGrid,
    User,
    Network,
    MessageCircle,
    Upload,
    Plug,
    ChevronRight,
    Settings,
    Shield
} from 'lucide-react';

const NAV_ITEMS = [
    { label: 'Command Center', href: '/dashboard', icon: LayoutGrid, iconId: 'grid' },
    { label: 'Profile Editor', href: '/profile', icon: User, iconId: 'user' },
    { label: 'Memory Graph', href: '/memory', icon: Network, iconId: 'network' },
    { label: 'Active Chat', href: '/chat', icon: MessageCircle, iconId: 'message-circle' },
    { label: 'Import Data', href: '/import', icon: Upload, iconId: 'upload' },
    { label: 'MCP Connect', href: '/connect', icon: Plug, iconId: 'plug' },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 h-screen fixed left-0 top-0 border-r border-stone-200/50 bg-white/70 backdrop-blur-xl flex flex-col z-50">
            <div className="p-6">
                <Link href="/dashboard" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E90FF] to-[#00BFFF] flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                        <Shield size={22} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-stone-900 tracking-tight leading-none">Identity</h1>
                        <p className="text-[10px] font-bold text-[#1E90FF] uppercase tracking-widest mt-1">Report v2.0</p>
                    </div>
                </Link>
            </div>

            <nav className="flex-1 px-4 py-2 space-y-1">
                <div className="mb-4 px-2">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Navigation</p>
                </div>
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center justify-between group px-3 py-2.5 rounded-xl transition-all duration-200 ${isActive
                                ? 'bg-primary/10 text-primary shadow-sm shadow-primary/5'
                                : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Icon
                                    size={18}
                                    strokeWidth={isActive ? 2.5 : 2}
                                    data-testid={`icon-${item.iconId}`}
                                />
                                <span className={`text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                            </div>
                            {isActive && <ChevronRight size={14} className="animate-pulse" />}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 mt-auto">
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-stone-200 to-stone-100 flex items-center justify-center text-xs font-bold text-stone-600 border-2 border-white shadow-sm">
                                QS
                            </div>
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-stone-900 truncate">QuarterShot</p>
                            <p className="text-[10px] font-medium text-stone-500 uppercase tracking-tight">Pro Plan</p>
                        </div>
                    </div>
                    <button className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-white border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-colors shadow-sm">
                        <Settings size={14} />
                        Account Settings
                    </button>
                </div>
            </div>
        </aside>
    );
}

