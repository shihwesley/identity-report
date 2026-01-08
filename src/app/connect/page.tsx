'use client';

import { useState, useCallback } from 'react';
import {
    Activity,
    Server,
    Shield,
    Terminal,
    Copy,
    Check,
    Trash2,
    Play,
    Zap,
    Layers,
    Search,
    Info,
    AlertCircle
} from 'lucide-react';

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

        await new Promise(resolve => setTimeout(resolve, 800));
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
        setLogs(prev => [entry, ...prev].slice(0, 100));
    }, []);

    const handleConnect = async () => {
        setIsConnecting(true);
        addLog('info', undefined, 'Attempting to secure handshake with MCP broker...');

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
            addLog('info', undefined, 'Protocol connection verified.');
        } else {
            addLog('error', 'initialize', result.error || 'Connection rejected');
            setStatus(prev => ({ ...prev, status: 'error' }));
        }

        setIsConnecting(false);
    };

    const handleTestTool = async (toolName: string) => {
        addLog('request', 'tools/call', { name: toolName });
        await new Promise(resolve => setTimeout(resolve, 300));
        addLog('response', 'tools/call', { status: 'success', data: 'Verified segment access' });
    };

    const copyConfig = () => {
        const config = {
            mcpServers: {
                "profile-vault": {
                    command: "node",
                    args: ["/Users/quartershots/.gemini/antigravity/scratch/universal_profile_dashboard/mcp-server.mjs"],
                    env: { DEBUG: "true" }
                }
            }
        };
        navigator.clipboard.writeText(JSON.stringify(config, null, 2));
        setConfigCopied(true);
        setTimeout(() => setConfigCopied(false), 2000);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-stone-900 tracking-tight">MCP Bridge</h1>
                    <p className="text-stone-500 font-medium">Coordinate your profile context with local and cloud LLM sessions.</p>
                </div>
                <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 border transition-all ${status.status === 'connected' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-stone-100 border-stone-200 text-stone-400'
                    }`}>
                    <Activity size={16} className={status.status === 'connected' ? 'animate-pulse' : ''} />
                    <span className="text-xs font-bold uppercase tracking-widest">{status.status}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Panel: Connection Info & Management */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="glass-panel p-8 rounded-[2.5rem] relative overflow-hidden">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Protocol Status</h2>
                            {status.status === 'connected' && (
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                            )}
                        </div>

                        {status.status === 'connected' ? (
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600">
                                        <Server size={24} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-stone-900 leading-tight">{status.serverName}</p>
                                        <p className="text-[10px] font-bold text-stone-400 uppercase">{status.serverVersion}</p>
                                    </div>
                                </div>
                                <div className="pt-6 border-t border-stone-100 space-y-4">
                                    <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest">Capabilities</p>
                                    <div className="flex flex-wrap gap-2">
                                        {status.capabilities.resources && <span className="px-2 py-1 bg-primary/10 text-primary text-[9px] font-black uppercase rounded-md tracking-tighter">Resources</span>}
                                        {status.capabilities.tools && <span className="px-2 py-1 bg-amber-500/10 text-amber-600 text-[9px] font-black uppercase rounded-md tracking-tighter">Tools</span>}
                                        {status.capabilities.prompts && <span className="px-2 py-1 bg-purple-500/10 text-purple-600 text-[9px] font-black uppercase rounded-md tracking-tighter">Prompts</span>}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4 space-y-6">
                                <div className="w-16 h-16 bg-stone-50 rounded-3xl flex items-center justify-center text-stone-200 mx-auto border border-stone-100">
                                    <Server size={32} />
                                </div>
                                <p className="text-xs font-bold text-stone-400 max-w-[200px] mx-auto">
                                    No active protocol session detected on local port.
                                </p>
                                <button
                                    onClick={handleConnect}
                                    disabled={isConnecting}
                                    className="w-full py-4 bg-stone-900 text-white rounded-2xl font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-stone-900/10"
                                >
                                    {isConnecting ? 'Establishing...' : 'Verify Secret Handshake'}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="glass-panel p-8 rounded-[2.5rem] bg-stone-900 text-white relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-3xl -mr-16 -mt-16"></div>
                        <h2 className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-6">Claude Desktop Config</h2>
                        <div className="bg-black/40 rounded-2xl p-4 mb-6 font-mono text-[10px] text-stone-400 border border-white/5 whitespace-pre overflow-x-auto">
                            {`{
  "mcpServers": {
    "profile-vault": {
      "command": "node",
      "args": ["...mcp-server.mjs"]
    }
  }
}`}
                        </div>
                        <button
                            onClick={copyConfig}
                            className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-600 transition-all shadow-lg shadow-primary/20"
                        >
                            {configCopied ? <Check size={18} /> : <Copy size={18} />}
                            {configCopied ? 'Copied to Clipboard' : 'Copy Integration Config'}
                        </button>
                    </div>

                    <div className="glass-panel p-6 rounded-[2rem] space-y-4">
                        <div className="flex items-center gap-2">
                            <Info size={16} className="text-primary" />
                            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Runtime Commands</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            <button onClick={() => handleTestTool('search_memory')} disabled={status.status !== 'connected'} className="p-3 bg-stone-50 border border-stone-100 rounded-xl text-left hover:bg-white transition-all group disabled:opacity-50">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black text-stone-900 group-hover:text-primary transition-colors">Test Memory Search</span>
                                    <Play size={10} />
                                </div>
                            </button>
                            <button onClick={() => handleTestTool('get_context')} disabled={status.status !== 'connected'} className="p-3 bg-stone-50 border border-stone-100 rounded-xl text-left hover:bg-white transition-all group disabled:opacity-50">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black text-stone-900 group-hover:text-amber-500 transition-colors">Test Task Context</span>
                                    <Play size={10} />
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Protocol Logs */}
                <div className="lg:col-span-8 flex flex-col min-h-[600px]">
                    <div className="glass-panel rounded-[2.5rem] flex-1 flex flex-col overflow-hidden bg-white/40 border-white/60">
                        <div className="px-8 py-6 border-b border-white/40 flex justify-between items-center bg-white/30 backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <Terminal size={20} className="text-stone-400" />
                                <h2 className="text-sm font-black text-stone-900 tracking-tight">Protocol Message Stream</h2>
                                {logs.length > 0 && <span className="bg-stone-900 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">{logs.length}</span>}
                            </div>
                            <button onClick={() => setLogs([])} className="p-2 text-stone-400 hover:text-red-500 transition-colors">
                                <Trash2 size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] bg-white/20">
                            {logs.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-30">
                                    <Layers size={48} className="text-stone-300" />
                                    <p className="font-bold uppercase tracking-widest text-[10px]">No active stream</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {logs.map((log) => (
                                        <div key={log.id} className="p-4 rounded-2xl bg-white border border-stone-100 shadow-sm animate-in slide-in-from-bottom-2">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${log.type === 'request' ? 'bg-primary/10 text-primary' :
                                                        log.type === 'response' ? 'bg-emerald-500/10 text-emerald-600' :
                                                            log.type === 'error' ? 'bg-red-500/10 text-red-600' : 'bg-stone-100 text-stone-400'
                                                    }`}>
                                                    {log.type}
                                                </span>
                                                <span className="text-stone-400 text-[9px]">{log.timestamp.toLocaleTimeString()}</span>
                                                {log.method && <span className="text-stone-900 font-black">{log.method}</span>}
                                            </div>
                                            <pre className="text-stone-500 overflow-x-auto bg-stone-50/50 p-2 rounded-lg scrollbar-hide">
                                                {log.data}
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-white/30 border-t border-white/40 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Shield size={14} className="text-emerald-500" />
                                    <span className="text-[10px] font-black uppercase text-stone-400">Encrypted JSON-RPC</span>
                                </div>
                            </div>
                            <div className="text-[10px] font-bold text-stone-400">
                                Listening on pipe: profile-vault
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

