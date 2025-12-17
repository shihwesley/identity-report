'use client';

import { useState, useEffect } from 'react';
import { createWalletClient, custom } from 'viem';
import { polygon, polygonAmoy } from 'viem/chains';

// --- EIP-6963 Types ---
interface EIP6963ProviderDetail {
    info: {
        uuid: string;
        name: string;
        icon: string;
        rdns: string;
    };
    provider: any;
}

interface EIP6963AnnounceProviderEvent extends CustomEvent {
    detail: EIP6963ProviderDetail;
}

declare global {
    interface WindowEventMap {
        'eip6963:announceProvider': EIP6963AnnounceProviderEvent;
    }
}

interface Props {
    onConnected?: (address: string) => void;
}

export default function ConnectWallet({ onConnected }: Props) {
    const [address, setAddress] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // EIP-6963 Discovered Providers
    const [providers, setProviders] = useState<EIP6963ProviderDetail[]>([]);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        // 1. Listen for EIP-6963 announcements using a standard event listener
        const onAnnounceProvider = (event: EIP6963AnnounceProviderEvent) => {
            setProviders(prev => {
                // Deduplicate by UUID
                if (prev.some(p => p.info.uuid === event.detail.info.uuid)) return prev;
                return [...prev, event.detail];
            });
        };

        window.addEventListener('eip6963:announceProvider', onAnnounceProvider);

        // 2. Dispatch request for providers
        window.dispatchEvent(new Event('eip6963:requestProvider'));

        // 3. Fallback: Check for legacy window.ethereum injection immediately
        // Some wallets might not support 6963 yet, or if only one is installed it might be here.
        // We'll treat 'window.ethereum' as a generic "Injected Wallet" if no 6963 providers appear,
        // OR we can list it alongside if we want.
        // For clean UI, we usually wait a beat to see if 6963 responds.

        // Also check if already connected to *something*
        checkConnection();

        return () => window.removeEventListener('eip6963:announceProvider', onAnnounceProvider);
    }, []);

    const checkConnection = async () => {
        // Basic check on the generic window.ethereum just to see if we are already permitted
        if (typeof window !== 'undefined' && window.ethereum) {
            try {
                const client = createWalletClient({
                    chain: polygonAmoy,
                    transport: custom(window.ethereum as any)
                });
                const [addr] = await client.getAddresses();
                if (addr) {
                    setAddress(addr);
                    onConnected?.(addr);
                }
            } catch (e) {
                // Ignore
            }
        }
    };

    const connectToProvider = async (provider: any) => {
        setIsConnecting(true);
        setError(null);
        try {
            const client = createWalletClient({
                chain: polygonAmoy,
                transport: custom(provider)
            });

            await client.requestAddresses();
            const [addr] = await client.getAddresses();

            // Switch chain logic similar to before, but using the specific provider
            try {
                await client.switchChain({ id: polygonAmoy.id });
            } catch (switchError: any) {
                if (switchError.code === 4902) {
                    try {
                        await client.addChain({ chain: polygonAmoy });
                    } catch (addError) {
                        console.error("Failed to add chain", addError);
                    }
                }
            }

            setAddress(addr);
            onConnected?.(addr);
            setShowModal(false);
        } catch (e: any) {
            setError(e.message || "Failed to connect");
        } finally {
            setIsConnecting(false);
        }
    };

    // Generic fallback connect (uses window.ethereum)
    const connectGeneric = () => {
        if (typeof window !== 'undefined' && window.ethereum) {
            connectToProvider(window.ethereum);
        } else {
            setError("No wallet found");
        }
    };

    const handleConnectClick = () => {
        setShowModal(true);
        // Re-dispatch request just in case
        window.dispatchEvent(new Event('eip6963:requestProvider'));
    };

    if (address) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full text-xs text-green-400 font-mono">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {address.slice(0, 6)}...{address.slice(-4)}
                <button
                    onClick={() => { setAddress(null); onConnected?.(''); }}
                    className="ml-2 hover:text-white text-green-500/50"
                    title="Disconnect"
                >
                    ×
                </button>
            </div>
        );
    }

    return (
        <div className="relative">
            <button
                onClick={handleConnectClick}
                disabled={isConnecting}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 shadow-[0_0_15px_-3px_rgba(124,58,237,0.4)] border border-violet-400/20"
            >
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                </span>
                {isConnecting ? 'INITIALIZING...' : 'CONNECT WALLET'}
            </button>

            {/* Wallet Selection Modal */}
            {showModal && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-[#111] border border-white/10 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-semibold text-white">Select Wallet</h3>
                        <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white">×</button>
                    </div>

                    <div className="flex flex-col gap-2">
                        {/* 1. EIP-6963 Detected Wallets */}
                        {providers.map((p) => (
                            <button
                                key={p.info.uuid}
                                onClick={() => connectToProvider(p.provider)}
                                className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                            >
                                <img src={p.info.icon} alt={p.info.name} className="w-6 h-6 rounded-md" />
                                <span className="text-sm text-zinc-200">{p.info.name}</span>
                            </button>
                        ))}

                        {/* 2. Generic/Legacy Fallback (MetaMask/Injected) */}
                        {providers.length === 0 && (
                            <button
                                onClick={connectGeneric}
                                className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                            >
                                <div className="w-6 h-6 rounded-md bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold text-xs">W</div>
                                <span className="text-sm text-zinc-200">Browser Wallet</span>
                            </button>
                        )}

                        {/* 3. Explicit Coinbase Button (Always Show if requested) */}
                        {!providers.some(p => p.info.name.toLowerCase().includes('coinbase')) && (
                            <button
                                onClick={() => {
                                    // Try to find Coinbase provider specifically
                                    const cb = (window as any).coinbaseWalletExtension ||
                                        ((window as any).ethereum?.isCoinbaseWallet ? (window as any).ethereum : undefined);

                                    if (cb) {
                                        connectToProvider(cb);
                                    } else {
                                        setError("Coinbase Wallet not found");
                                    }
                                }}
                                className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                            >
                                <div className="w-6 h-6 rounded-md bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">C</div>
                                <span className="text-sm text-zinc-200">Coinbase Wallet</span>
                            </button>
                        )}
                    </div>

                    {error && (
                        <div className="mt-3 pt-3 border-t border-white/5">
                            <p className="text-xs text-red-400">{error}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Backdrop for modal */}
            {showModal && (
                <div className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]" onClick={() => setShowModal(false)} />
            )}
        </div>
    );
}
