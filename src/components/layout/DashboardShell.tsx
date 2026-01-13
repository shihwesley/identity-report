'use client';

import { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { useAuth } from '@/lib/auth/context';

interface DashboardShellProps {
    children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
    const { signOut } = useAuth();

    return (
        <div className="flex min-h-screen mesh-gradient bg-fixed">
            {/* Fixed Sidebar */}
            <div className="w-64 fixed inset-y-0 left-0 z-50">
                <Sidebar />
            </div>

            {/* Main Content */}
            <main className="pl-64 flex-1 min-h-screen relative">
                {/* Header / Top Bar */}
                <header className="sticky top-0 z-40 h-16 bg-white/40 backdrop-blur-xl border-b border-white/20 px-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">Network Status: <span className="text-stone-900">Synchronized</span></span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={signOut}
                            className="p-2 rounded-xl hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors"
                            title="Sign Out"
                        >
                            <LogOut size={18} />
                        </button>
                        <button className="p-2 rounded-full hover:bg-white/50 transition-colors">
                            <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-600">
                                QS
                            </div>
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in">
                    {children}
                </div>
            </main>
        </div>
    );
}

