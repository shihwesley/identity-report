'use client';

import { useState, useEffect, useCallback } from 'react';

interface LogEntry {
    id: string;
    timestamp: Date;
    type: 'request' | 'response' | 'error' | 'info';
    method?: string;
    data: string;
}

interface ConnectionStatus {
    status: 'disconnected' | 'connected' | 'error';
    serverName: string;
    serverVersion: string;
    protocolVersion: string;
    lastPing: Date | null;
    capabilities: {
        resources: boolean;
        tools: boolean;
        prompts: boolean;
    };
}

// Simulated MCP test client for the UI
async function testMcpServer(): Promise<{ success: boolean; response: any; error?: string }> {
    try {
        // In a real implementation, this would connect to the MCP server
        // For now, we simulate the response based on the actual server
        const mockResponse = {
            protocolVersion: '2024-11-05',
            capabilities: {
                resources: { subscribe: false, listChanged: false },
                tools: {},
                prompts: {}
            },
            serverInfo: {
                name: 'profile-context-protocol',
                version: '1.0.0',
                description: "User's portable AI profile with conversation history and preferences"
            }
        };

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        return { success: true, response: mockResponse };
    } catch (e) {
        return { success: false, response: null, error: (e as Error).message };
    }
}

export default function ConnectPage() {
    const [status, setStatus] = useState<ConnectionStatus>({
        status: 'disconnected',
        serverName: '',
        serverVersion: '',
        protocolVersion: '',
        lastPing: null,
        capabilities: { resources: false, tools: false, prompts: false }
    });
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isConnecting, setIsConnecting] = useState(false);
    const [configCopied, setConfigCopied] = useState(false);

    const addLog = useCallback((type: LogEntry['type'], method: string | undefined, data: any) => {
        const entry: LogEntry = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timestamp: new Date(),
            type,
            method,
            data: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
        };
        setLogs(prev => [entry, ...prev].slice(0, 100)); // Keep last 100 logs
    }, []);

    const handleConnect = async () => {
        setIsConnecting(true);
        addLog('info', undefined, 'Attempting to connect to MCP server...');

        // Simulate initialize request
        addLog('request', 'initialize', { jsonrpc: '2.0', id: 1, method: 'initialize' });

        const result = await testMcpServer();

        if (result.success) {
            addLog('response', 'initialize', result.response);
            setStatus({
                status: 'connected',
                serverName: result.response.serverInfo.name,
                serverVersion: result.response.serverInfo.version,
                protocolVersion: result.response.protocolVersion,
                lastPing: new Date(),
                capabilities: {
                    resources: !!result.response.capabilities.resources,
                    tools: !!result.response.capabilities.tools,
                    prompts: !!result.response.capabilities.prompts
                }
            });
            addLog('info', undefined, 'Successfully connected to MCP server');
        } else {
            addLog('error', 'initialize', result.error || 'Connection failed');
            setStatus(prev => ({ ...prev, status: 'error' }));
        }

        setIsConnecting(false);
    };

    const handleTestTool = async (toolName: string) => {
        addLog('request', 'tools/call', {
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: { name: toolName, arguments: { query: 'test' } }
        });

        // Simulate response
        await new Promise(resolve => setTimeout(resolve, 300));

        const mockResults: Record<string, any> = {
            search_memory: { query: 'test', matches: [], count: 0, totalSearched: 0 },
            get_context_for_task: { task: 'test', context: { memories: [], conversations: [], insights: [] } }
        };

        addLog('response', 'tools/call', {
            content: [{ type: 'text', text: JSON.stringify(mockResults[toolName] || {}) }]
        });
    };

    const handleListResources = async () => {
        addLog('request', 'resources/list', { jsonrpc: '2.0', id: Date.now(), method: 'resources/list' });

        await new Promise(resolve => setTimeout(resolve, 300));

        addLog('response', 'resources/list', {
            resources: [
                { uri: 'profile://identity', name: 'User Identity' },
                { uri: 'profile://preferences', name: 'User Preferences' },
                { uri: 'profile://memory/recent', name: 'Recent Memory' },
                { uri: 'profile://memory/all', name: 'All Memories' },
                { uri: 'profile://insights', name: 'User Insights' },
                { uri: 'profile://conversations/recent', name: 'Recent Conversations' },
                { uri: 'profile://stats', name: 'Profile Statistics' }
            ]
        });
    };

    const handleListTools = async () => {
        addLog('request', 'tools/list', { jsonrpc: '2.0', id: Date.now(), method: 'tools/list' });

        await new Promise(resolve => setTimeout(resolve, 300));

        addLog('response', 'tools/list', {
            tools: [
                { name: 'search_memory', description: 'Search long-term memory' },
                { name: 'add_memory', description: 'Store new insight' },
                { name: 'get_context_for_task', description: 'Get relevant context' },
                { name: 'get_conversation_history', description: 'Retrieve past conversations' }
            ]
        });
    };

    const copyConfig = () => {
        const config = {
            mcpServers: {
                "profile-vault": {
                    command: "node",
                    args: ["/Users/quartershots/.gemini/antigravity/scratch/universal_profile_dashboard/mcp-server.mjs"],
                    env: {
                        DEBUG: "true"
                    }
                }
            }
        };
        navigator.clipboard.writeText(JSON.stringify(config, null, 2));
        setConfigCopied(true);
        setTimeout(() => setConfigCopied(false), 2000);
    };

    const clearLogs = () => {
        setLogs([]);
        addLog('info', undefined, 'Logs cleared');
    };

    const getLogTypeColor = (type: LogEntry['type']) => {
        switch (type) {
            case 'request': return 'text-blue-400';
            case 'response': return 'text-teal-400';
            case 'error': return 'text-red-400';
            case 'info': return 'text-zinc-400';
        }
    };

    const getLogTypeIcon = (type: LogEntry['type']) => {
        switch (type) {
            case 'request': return '→';
            case 'response': return '←';
            case 'error': return '✕';
            case 'info': return 'ℹ';
        }
    };

    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-white mb-2">MCP Connection</h1>
            <p className="text-zinc-400 mb-8">
                Monitor and test your Profile Context Protocol MCP server connection.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Status Panel */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Connection Status Card */}
                    <div className="glass-card rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Server Status</h2>
                            <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${status.status === 'connected'
                                    ? 'bg-teal-500/20 text-teal-400'
                                    : status.status === 'error'
                                        ? 'bg-red-500/20 text-red-400'
                                        : 'bg-zinc-700/50 text-zinc-400'
                                }`}>
                                <span className={`w-2 h-2 rounded-full ${status.status === 'connected'
                                        ? 'bg-teal-500 animate-pulse'
                                        : status.status === 'error'
                                            ? 'bg-red-500'
                                            : 'bg-zinc-500'
                                    }`} />
                                {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                            </div>
                        </div>

                        {status.status === 'connected' ? (
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs text-zinc-500">Server Name</p>
                                    <p className="text-white font-medium">{status.serverName}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-zinc-500">Version</p>
                                    <p className="text-white">{status.serverVersion}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-zinc-500">Protocol</p>
                                    <p className="text-white">{status.protocolVersion}</p>
                                </div>
                                <div className="pt-3 border-t border-zinc-800">
                                    <p className="text-xs text-zinc-500 mb-2">Capabilities</p>
                                    <div className="flex flex-wrap gap-2">
                                        {status.capabilities.resources && (
                                            <span className="px-2 py-1 bg-violet-500/20 text-violet-300 rounded text-xs">Resources</span>
                                        )}
                                        {status.capabilities.tools && (
                                            <span className="px-2 py-1 bg-fuchsia-500/20 text-fuchsia-300 rounded text-xs">Tools</span>
                                        )}
                                        {status.capabilities.prompts && (
                                            <span className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded text-xs">Prompts</span>
                                        )}
                                    </div>
                                </div>
                                {status.lastPing && (
                                    <p className="text-xs text-zinc-600 pt-2">
                                        Last ping: {status.lastPing.toLocaleTimeString()}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-4">
                                <p className="text-zinc-500 text-sm mb-4">
                                    {status.status === 'error'
                                        ? 'Connection failed. Check if the server is running.'
                                        : 'Not connected to MCP server'}
                                </p>
                                <button
                                    onClick={handleConnect}
                                    disabled={isConnecting}
                                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                                >
                                    {isConnecting ? 'Connecting...' : 'Test Connection'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Quick Actions */}
                    {status.status === 'connected' && (
                        <div className="glass-card rounded-xl p-6">
                            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">Test Commands</h2>
                            <div className="space-y-2">
                                <button
                                    onClick={handleListResources}
                                    className="w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors text-left flex items-center gap-2"
                                >
                                    <span className="text-violet-400">📋</span>
                                    List Resources
                                </button>
                                <button
                                    onClick={handleListTools}
                                    className="w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors text-left flex items-center gap-2"
                                >
                                    <span className="text-fuchsia-400">🔧</span>
                                    List Tools
                                </button>
                                <button
                                    onClick={() => handleTestTool('search_memory')}
                                    className="w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors text-left flex items-center gap-2"
                                >
                                    <span className="text-teal-400">🔍</span>
                                    Test search_memory
                                </button>
                                <button
                                    onClick={() => handleTestTool('get_context_for_task')}
                                    className="w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors text-left flex items-center gap-2"
                                >
                                    <span className="text-amber-400">📦</span>
                                    Test get_context
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Configuration */}
                    <div className="glass-card rounded-xl p-6">
                        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">Claude Desktop Config</h2>
                        <p className="text-xs text-zinc-500 mb-3">
                            Add this to your Claude Desktop configuration file to enable the Profile Vault MCP server.
                        </p>
                        <div className="bg-zinc-950 rounded-lg p-3 text-xs font-mono text-zinc-400 mb-3 overflow-x-auto">
                            <pre>{`{
  "mcpServers": {
    "profile-vault": {
      "command": "node",
      "args": ["...mcp-server.mjs"]
    }
  }
}`}</pre>
                        </div>
                        <button
                            onClick={copyConfig}
                            className="w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {configCopied ? (
                                <>
                                    <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Copy Full Config
                                </>
                            )}
                        </button>
                        <p className="text-xs text-zinc-600 mt-3">
                            Config file location:<br />
                            <code className="text-zinc-500">~/Library/Application Support/Claude/claude_desktop_config.json</code>
                        </p>
                    </div>
                </div>

                {/* Logs Panel */}
                <div className="lg:col-span-2">
                    <div className="glass-card rounded-xl p-6 h-full">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
                                Message Log
                                {logs.length > 0 && (
                                    <span className="ml-2 text-xs text-zinc-600 font-normal">({logs.length} entries)</span>
                                )}
                            </h2>
                            <button
                                onClick={clearLogs}
                                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                                Clear
                            </button>
                        </div>

                        <div className="bg-zinc-950 rounded-lg h-[600px] overflow-y-auto font-mono text-xs">
                            {logs.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-zinc-600">
                                    <p>No log entries. Connect to start monitoring.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-zinc-800/50">
                                    {logs.map((log) => (
                                        <div key={log.id} className="p-3 hover:bg-zinc-900/50 transition-colors">
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className={`${getLogTypeColor(log.type)} font-bold`}>
                                                    {getLogTypeIcon(log.type)}
                                                </span>
                                                <span className="text-zinc-500">
                                                    {log.timestamp.toLocaleTimeString()}
                                                </span>
                                                {log.method && (
                                                    <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded">
                                                        {log.method}
                                                    </span>
                                                )}
                                                <span className={`text-xs uppercase ${getLogTypeColor(log.type)}`}>
                                                    {log.type}
                                                </span>
                                            </div>
                                            <pre className="text-zinc-400 whitespace-pre-wrap break-all pl-6 max-h-48 overflow-y-auto">
                                                {log.data}
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Help Section */}
            <div className="mt-8 p-6 border border-zinc-800 rounded-xl bg-zinc-900/30">
                <h3 className="text-sm font-semibold text-white mb-3">Using the MCP Server</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-zinc-400">
                    <div>
                        <p className="font-medium text-zinc-300 mb-1">1. Start the server</p>
                        <code className="text-xs text-violet-400 bg-zinc-950 px-2 py-1 rounded block">
                            node mcp-server.mjs
                        </code>
                    </div>
                    <div>
                        <p className="font-medium text-zinc-300 mb-1">2. Configure Claude Desktop</p>
                        <p className="text-xs">Add the config above to enable integration</p>
                    </div>
                    <div>
                        <p className="font-medium text-zinc-300 mb-1">3. Use in conversations</p>
                        <p className="text-xs">Claude will automatically use your profile context</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
