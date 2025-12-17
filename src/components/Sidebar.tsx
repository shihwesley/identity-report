'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
    { label: 'Command Center', href: '/', icon: 'grid' },
    { label: 'Profile Editor', href: '/profile', icon: 'user' },
    { label: 'Memory Graph', href: '/memory', icon: 'network' },
    { label: 'Active Chat', href: '/chat', icon: 'message-circle' },
    { label: 'Import Data', href: '/import', icon: 'upload' },
    { label: 'MCP Connect', href: '/connect', icon: 'plug' },
];



export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 h-screen fixed left-0 top-0 border-r border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex flex-col z-50">
            <div className="p-6 border-b border-stone-200 dark:border-stone-800">
                <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100 tracking-tight flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-[#1E90FF] flex items-center justify-center text-white text-xs font-bold">I</span>
                    Identity Report
                </h1>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${isActive
                                ? 'bg-[#1E90FF]/10 text-[#1E90FF] dark:bg-[#1E90FF]/20 dark:text-[#1E90FF]'
                                : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800/50'
                                }`}
                        >
                            {item.icon === 'grid' && <span>⌘</span>}
                            {item.icon === 'user' && <span>👤</span>}
                            {item.icon === 'network' && <span>🕸</span>}
                            {item.icon === 'message-circle' && <span>💬</span>}
                            {item.icon === 'upload' && <span>↓</span>}
                            {item.icon === 'plug' && <span>🔌</span>}
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-3 px-2">
                    <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center text-xs font-medium text-stone-600 dark:text-stone-400">QS</div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">QuarterShot</p>
                        <p className="text-xs text-stone-500 truncate">Pro Plan</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
