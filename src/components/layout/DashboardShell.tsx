'use client';

import { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';

interface DashboardShellProps {
    children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
    return (
        <div className="flex min-h-screen">
            {/* Fixed Sidebar */}
            <div className="w-64 fixed inset-y-0 left-0 z-50">
                <Sidebar />
            </div>

            {/* Main Content */}
            <main className="pl-64 flex-1 min-h-screen relative bg-[#fafaf9]">
                {/* Header / Top Bar */}
                <header className="sticky top-0 z-40 h-16 bg-white/80 backdrop-blur-sm border-b border-stone-200 px-8 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-stone-900">Welcome back, QuarterShot</span>
                    </div>
                </header>

                {/* Page Content */}
                <div className="p-8 max-w-7xl mx-auto space-y-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
