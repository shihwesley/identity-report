'use client';

import { ProjectContext } from '@/lib/types';
import { useState } from 'react';

export function ContextSelector({ projects }: { projects: ProjectContext[] }) {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    return (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6 mb-8 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">Workspaces</h2>
                    <p className="text-stone-500 text-sm">Select a project to load its "Identity Context"</p>
                </div>
                <button className="px-4 py-2 bg-[#1E90FF] hover:bg-[#187bcd] text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
                    + New Project
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map((project) => (
                    <div
                        key={project.id}
                        onClick={() => setSelectedId(project.id)}
                        className={`p-4 rounded-lg cursor-pointer border transition-all duration-200 group relative ${selectedId === project.id
                            ? 'bg-[#1E90FF]/5 border-[#1E90FF]/30 shadow-sm ring-1 ring-[#1E90FF]/20'
                            : 'bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 hover:bg-stone-100 dark:hover:bg-stone-800'
                            }`}
                    >
                        {selectedId === project.id && (
                            <div className="absolute top-3 right-3 flex items-center gap-1.5">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1E90FF] opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1E90FF]"></span>
                                </span>
                                <span className="text-[10px] font-bold text-[#1E90FF] uppercase tracking-wider">Active</span>
                            </div>
                        )}

                        <h3 className={`font-medium ${selectedId === project.id ? 'text-[#1E90FF]' : 'text-stone-700 dark:text-stone-200'}`}>
                            {project.name}
                        </h3>
                        <p className="text-sm text-stone-500 mt-1 line-clamp-2">{project.description}</p>

                        <div className="flex flex-wrap gap-2 mt-3">
                            {project.techStack.map(tech => (
                                <span key={tech} className="text-[10px] px-2 py-1 rounded bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-500 font-medium">
                                    {tech}
                                </span>
                            ))}
                        </div>

                        {selectedId === project.id && (
                            <div className="mt-4 pt-3 border-t border-[#1E90FF]/20">
                                <p className="text-xs text-[#1E90FF] font-mono">
                                    Included Context:
                                    <span className="ml-2 text-stone-500 font-sans">{project.relatedMemories.length} Memories Loaded</span>
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
