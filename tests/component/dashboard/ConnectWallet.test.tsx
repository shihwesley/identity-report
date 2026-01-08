/**
 * ConnectWallet Component Tests
 *
 * Tests for the wallet connection component that supports
 * EIP-6963 multi-wallet discovery and legacy wallet connection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import ConnectWallet from '@/components/dashboard/ConnectWallet';

// ============================================================
// Mocks
// ============================================================

// Mock viem
vi.mock('viem', () => ({
  createWalletClient: vi.fn(() => ({
    getAddresses: vi.fn().mockResolvedValue([]),
    requestAddresses: vi.fn().mockResolvedValue(['0x1234567890123456789012345678901234567890']),
    switchChain: vi.fn().mockResolvedValue(undefined),
    addChain: vi.fn().mockResolvedValue(undefined),
  })),
  custom: vi.fn((provider) => ({ provider })),
}));

vi.mock('viem/chains', () => ({
  polygon: { id: 137, name: 'Polygon' },
  polygonAmoy: { id: 80002, name: 'Polygon Amoy' },
}));

// Mock EIP-6963 provider
interface MockEIP6963Provider {
  request: ReturnType<typeof vi.fn>;
}

interface MockEIP6963ProviderDetail {
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  };
  provider: MockEIP6963Provider;
}

function createMockProvider(name: string, uuid: string): MockEIP6963ProviderDetail {
  return {
    info: {
      uuid,
      name,
      icon: 'data:image/svg+xml,<svg></svg>',
      rdns: `com.${name.toLowerCase().replace(/\s+/g, '')}`,
    },
    provider: {
      request: vi.fn().mockResolvedValue(['0x1234567890123456789012345678901234567890']),
    },
  };
}

// Store original window.ethereum
let originalEthereum: unknown;
let originalDispatchEvent: typeof window.dispatchEvent;
let eventListeners: Map<string, Set<EventListener>>;

// ============================================================
// Test Setup
// ============================================================

describe('ConnectWallet', () => {
  const mockOnConnected = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Store original values
    originalEthereum = (window as unknown as { ethereum?: unknown }).ethereum;
    originalDispatchEvent = window.dispatchEvent.bind(window);
    eventListeners = new Map();

    // Mock window.ethereum
    (window as unknown as { ethereum: MockEIP6963Provider }).ethereum = {
      request: vi.fn().mockResolvedValue(['0x1234567890123456789012345678901234567890']),
    };

    // Mock addEventListener to capture EIP-6963 listener
    const originalAddEventListener = window.addEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'eip6963:announceProvider') {
        const listeners = eventListeners.get(type) || new Set();
        listeners.add(listener as EventListener);
        eventListeners.set(type, listeners);
      }
      return originalAddEventListener(type, listener, options);
    });

    // Mock dispatchEvent
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
      if (event.type === 'eip6963:requestProvider') {
        // Don't auto-announce providers - let tests control this
        return true;
      }
      return originalDispatchEvent(event);
    });
  });

  afterEach(() => {
    // Restore original values
    if (originalEthereum !== undefined) {
      (window as unknown as { ethereum: unknown }).ethereum = originalEthereum;
    } else {
      delete (window as unknown as { ethereum?: unknown }).ethereum;
    }

    vi.restoreAllMocks();
  });

  // Helper to announce an EIP-6963 provider
  function announceProvider(provider: MockEIP6963ProviderDetail) {
    const listeners = eventListeners.get('eip6963:announceProvider');
    if (listeners) {
      const event = new CustomEvent('eip6963:announceProvider', {
        detail: provider,
      });
      listeners.forEach((listener) => listener(event));
    }
  }

  describe('Initial State', () => {
    it('renders connect button when not connected', () => {
      render(<ConnectWallet onConnected={mockOnConnected} />);

      expect(screen.getByRole('button', { name: /CONNECT WALLET/i })).toBeInTheDocument();
    });

    it('shows animated indicator on connect button', () => {
      const { container } = render(<ConnectWallet onConnected={mockOnConnected} />);

      expect(container.querySelector('.animate-ping')).toBeInTheDocument();
    });

    it('should have no accessibility violations', async () => {
      const { container } = render(<ConnectWallet onConnected={mockOnConnected} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('dispatches EIP-6963 request on mount', () => {
      render(<ConnectWallet onConnected={mockOnConnected} />);

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'eip6963:requestProvider' })
      );
    });
  });

  describe('Wallet Selection Modal', () => {
    it('opens modal when connect button is clicked', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet onConnected={mockOnConnected} />);

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));

      expect(screen.getByText('Select Wallet')).toBeInTheDocument();
    });

    it('shows browser wallet option when no EIP-6963 providers', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet onConnected={mockOnConnected} />);

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));

      expect(screen.getByText('Browser Wallet')).toBeInTheDocument();
    });

    it('shows Coinbase Wallet option', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet onConnected={mockOnConnected} />);

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));

      expect(screen.getByText('Coinbase Wallet')).toBeInTheDocument();
    });

    it('closes modal when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet onConnected={mockOnConnected} />);

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));
      expect(screen.getByText('Select Wallet')).toBeInTheDocument();

      // Find and click the close button (the X in the modal header)
      const closeButton = screen.getByRole('button', { name: /Close/i });
      if (closeButton) {
        await user.click(closeButton);
      }

      await waitFor(() => {
        expect(screen.queryByText('Select Wallet')).not.toBeInTheDocument();
      });
    });

    it('closes modal when backdrop is clicked', async () => {
      const user = userEvent.setup();
      const { container } = render(<ConnectWallet onConnected={mockOnConnected} />);

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));
      expect(screen.getByText('Select Wallet')).toBeInTheDocument();

      // Click the backdrop
      const backdrop = container.querySelector('.fixed.inset-0.z-40');
      if (backdrop) {
        await user.click(backdrop);
      }

      await waitFor(() => {
        expect(screen.queryByText('Select Wallet')).not.toBeInTheDocument();
      });
    });
  });

  describe('EIP-6963 Provider Discovery', () => {
    it('displays discovered EIP-6963 providers', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet onConnected={mockOnConnected} />);

      // Announce a provider
      act(() => {
        announceProvider(createMockProvider('MetaMask', 'metamask-uuid'));
      });

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));

      expect(screen.getByText('MetaMask')).toBeInTheDocument();
    });

    it('displays multiple discovered providers', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet onConnected={mockOnConnected} />);

      // Announce multiple providers
      act(() => {
        announceProvider(createMockProvider('MetaMask', 'metamask-uuid'));
        announceProvider(createMockProvider('Rainbow', 'rainbow-uuid'));
      });

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));

      expect(screen.getByText('MetaMask')).toBeInTheDocument();
      expect(screen.getByText('Rainbow')).toBeInTheDocument();
    });

    it('deduplicates providers by UUID', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet onConnected={mockOnConnected} />);

      // Announce same provider twice
      act(() => {
        announceProvider(createMockProvider('MetaMask', 'same-uuid'));
        announceProvider(createMockProvider('MetaMask', 'same-uuid'));
      });

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));

      const metamaskButtons = screen.getAllByText('MetaMask');
      expect(metamaskButtons).toHaveLength(1);
    });

    it('shows provider icon', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet onConnected={mockOnConnected} />);

      act(() => {
        announceProvider(createMockProvider('MetaMask', 'metamask-uuid'));
      });

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));

      const icon = screen.getByAltText('MetaMask');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('src', 'data:image/svg+xml,<svg></svg>');
    });
  });

  describe('Wallet Connection', () => {
    it('connects via browser wallet', async () => {
      const user = userEvent.setup();
      const { createWalletClient } = await import('viem');

      let isConnected = false;
      (createWalletClient as ReturnType<typeof vi.fn>).mockReturnValue({
        getAddresses: vi.fn().mockImplementation(() =>
          Promise.resolve(isConnected ? ['0xAbCdEf1234567890123456789012345678901234'] : [])
        ),
        requestAddresses: vi.fn().mockImplementation(() => {
          isConnected = true;
          return Promise.resolve(['0xAbCdEf1234567890123456789012345678901234']);
        }),
        switchChain: vi.fn().mockResolvedValue(undefined),
        addChain: vi.fn().mockResolvedValue(undefined),
      });

      render(<ConnectWallet onConnected={mockOnConnected} />);

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));
      await user.click(screen.getByText('Browser Wallet'));

      await waitFor(() => {
        expect(mockOnConnected).toHaveBeenCalledWith('0xAbCdEf1234567890123456789012345678901234');
      });
    });

    it('connects via EIP-6963 provider', async () => {
      const user = userEvent.setup();
      const { createWalletClient } = await import('viem');

      let isConnected = false;
      (createWalletClient as ReturnType<typeof vi.fn>).mockReturnValue({
        getAddresses: vi.fn().mockImplementation(() =>
          Promise.resolve(isConnected ? ['0x9876543210fedcba9876543210fedcba98765432'] : [])
        ),
        requestAddresses: vi.fn().mockImplementation(() => {
          isConnected = true;
          return Promise.resolve(['0x9876543210fedcba9876543210fedcba98765432']);
        }),
        switchChain: vi.fn().mockResolvedValue(undefined),
        addChain: vi.fn().mockResolvedValue(undefined),
      });

      render(<ConnectWallet onConnected={mockOnConnected} />);

      act(() => {
        announceProvider(createMockProvider('MetaMask', 'metamask-uuid'));
      });

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));
      await user.click(screen.getByText('MetaMask'));

      await waitFor(() => {
        expect(mockOnConnected).toHaveBeenCalled();
      });
    });

    it('shows connecting state during connection', async () => {
      const user = userEvent.setup();
      const { createWalletClient } = await import('viem');

      // Create a delayed promise
      let resolveConnection: (value: string[]) => void;
      const connectionPromise = new Promise<string[]>((resolve) => {
        resolveConnection = resolve;
      });

      (createWalletClient as ReturnType<typeof vi.fn>).mockReturnValue({
        getAddresses: vi.fn().mockResolvedValue([]),
        requestAddresses: vi.fn().mockReturnValue(connectionPromise),
        switchChain: vi.fn().mockResolvedValue(undefined),
        addChain: vi.fn().mockResolvedValue(undefined),
      });

      render(<ConnectWallet onConnected={mockOnConnected} />);

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));
      await user.click(screen.getByText('Browser Wallet'));

      // Should show connecting state
      expect(screen.getByText('INITIALIZING...')).toBeInTheDocument();

      // Resolve the connection
      act(() => {
        resolveConnection!(['0x1234567890123456789012345678901234567890']);
      });
    });
  });

  describe('Connected State', () => {
    it('shows connected address when connected', async () => {
      const user = userEvent.setup();
      const { createWalletClient } = await import('viem');

      // Initially not connected (empty getAddresses), then connected after requestAddresses
      let isConnected = false;
      (createWalletClient as ReturnType<typeof vi.fn>).mockReturnValue({
        getAddresses: vi.fn().mockImplementation(() =>
          Promise.resolve(isConnected ? ['0xAbCdEf1234567890123456789012345678901234'] : [])
        ),
        requestAddresses: vi.fn().mockImplementation(() => {
          isConnected = true;
          return Promise.resolve(['0xAbCdEf1234567890123456789012345678901234']);
        }),
        switchChain: vi.fn().mockResolvedValue(undefined),
        addChain: vi.fn().mockResolvedValue(undefined),
      });

      render(<ConnectWallet onConnected={mockOnConnected} />);

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));
      await user.click(screen.getByText('Browser Wallet'));

      await waitFor(() => {
        expect(screen.getByText(/0xAbCd/)).toBeInTheDocument();
        expect(screen.getByText(/1234/)).toBeInTheDocument();
      });
    });

    it('shows truncated address format', async () => {
      const user = userEvent.setup();
      const { createWalletClient } = await import('viem');

      let isConnected = false;
      (createWalletClient as ReturnType<typeof vi.fn>).mockReturnValue({
        getAddresses: vi.fn().mockImplementation(() =>
          Promise.resolve(isConnected ? ['0xAbCdEf1234567890123456789012345678901234'] : [])
        ),
        requestAddresses: vi.fn().mockImplementation(() => {
          isConnected = true;
          return Promise.resolve(['0xAbCdEf1234567890123456789012345678901234']);
        }),
        switchChain: vi.fn().mockResolvedValue(undefined),
        addChain: vi.fn().mockResolvedValue(undefined),
      });

      render(<ConnectWallet onConnected={mockOnConnected} />);

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));
      await user.click(screen.getByText('Browser Wallet'));

      await waitFor(() => {
        // Should show first 6 chars + ... + last 4 chars
        const addressElement = screen.getByText(/0xAbCd.*1234/);
        expect(addressElement).toBeInTheDocument();
      });
    });

    it('shows green indicator when connected', async () => {
      const user = userEvent.setup();
      const { createWalletClient } = await import('viem');

      let isConnected = false;
      (createWalletClient as ReturnType<typeof vi.fn>).mockReturnValue({
        getAddresses: vi.fn().mockImplementation(() =>
          Promise.resolve(isConnected ? ['0x1234567890123456789012345678901234567890'] : [])
        ),
        requestAddresses: vi.fn().mockImplementation(() => {
          isConnected = true;
          return Promise.resolve(['0x1234567890123456789012345678901234567890']);
        }),
        switchChain: vi.fn().mockResolvedValue(undefined),
        addChain: vi.fn().mockResolvedValue(undefined),
      });

      const { container } = render(<ConnectWallet onConnected={mockOnConnected} />);

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));
      await user.click(screen.getByText('Browser Wallet'));

      await waitFor(() => {
        expect(container.querySelector('.bg-green-500')).toBeInTheDocument();
      });
    });

    it('allows disconnecting', async () => {
      const user = userEvent.setup();
      const { createWalletClient } = await import('viem');

      let isConnected = false;
      (createWalletClient as ReturnType<typeof vi.fn>).mockReturnValue({
        getAddresses: vi.fn().mockImplementation(() =>
          Promise.resolve(isConnected ? ['0x1234567890123456789012345678901234567890'] : [])
        ),
        requestAddresses: vi.fn().mockImplementation(() => {
          isConnected = true;
          return Promise.resolve(['0x1234567890123456789012345678901234567890']);
        }),
        switchChain: vi.fn().mockResolvedValue(undefined),
        addChain: vi.fn().mockResolvedValue(undefined),
      });

      render(<ConnectWallet onConnected={mockOnConnected} />);

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));
      await user.click(screen.getByText('Browser Wallet'));

      await waitFor(() => {
        expect(screen.queryByText(/0x1234/)).toBeInTheDocument();
      });

      // Find and click disconnect button
      const disconnectButton = screen.getByTitle('Disconnect');
      await user.click(disconnectButton);

      expect(mockOnConnected).toHaveBeenLastCalledWith('');
      expect(screen.getByRole('button', { name: /CONNECT WALLET/i })).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('shows error when wallet connection fails', async () => {
      const user = userEvent.setup();
      const { createWalletClient } = await import('viem');

      (createWalletClient as ReturnType<typeof vi.fn>).mockReturnValue({
        getAddresses: vi.fn().mockResolvedValue([]),
        requestAddresses: vi.fn().mockRejectedValue(new Error('User rejected')),
        switchChain: vi.fn().mockResolvedValue(undefined),
        addChain: vi.fn().mockResolvedValue(undefined),
      });

      render(<ConnectWallet onConnected={mockOnConnected} />);

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));
      await user.click(screen.getByText('Browser Wallet'));

      await waitFor(() => {
        expect(screen.getByText('User rejected')).toBeInTheDocument();
      });
    });

    it('shows error when no wallet is found', async () => {
      const user = userEvent.setup();

      // Remove window.ethereum
      delete (window as unknown as { ethereum?: unknown }).ethereum;

      render(<ConnectWallet onConnected={mockOnConnected} />);

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));
      await user.click(screen.getByText('Browser Wallet'));

      await waitFor(() => {
        expect(screen.getByText('No wallet found')).toBeInTheDocument();
      });
    });

    it('shows error when Coinbase wallet not found', async () => {
      const user = userEvent.setup();

      render(<ConnectWallet onConnected={mockOnConnected} />);

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));
      await user.click(screen.getByText('Coinbase Wallet'));

      await waitFor(() => {
        expect(screen.getByText('Coinbase Wallet not found')).toBeInTheDocument();
      });
    });
  });

  describe('Chain Switching', () => {
    it('attempts to switch to Polygon Amoy chain', async () => {
      const user = userEvent.setup();
      const { createWalletClient } = await import('viem');
      const mockSwitchChain = vi.fn().mockResolvedValue(undefined);

      let isConnected = false;
      (createWalletClient as ReturnType<typeof vi.fn>).mockReturnValue({
        getAddresses: vi.fn().mockImplementation(() =>
          Promise.resolve(isConnected ? ['0x1234567890123456789012345678901234567890'] : [])
        ),
        requestAddresses: vi.fn().mockImplementation(() => {
          isConnected = true;
          return Promise.resolve(['0x1234567890123456789012345678901234567890']);
        }),
        switchChain: mockSwitchChain,
        addChain: vi.fn().mockResolvedValue(undefined),
      });

      render(<ConnectWallet onConnected={mockOnConnected} />);

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));
      await user.click(screen.getByText('Browser Wallet'));

      await waitFor(() => {
        expect(mockSwitchChain).toHaveBeenCalledWith({ id: 80002 });
      });
    });

    it('adds chain if not found (error 4902)', async () => {
      const user = userEvent.setup();
      const { createWalletClient } = await import('viem');
      const mockAddChain = vi.fn().mockResolvedValue(undefined);

      let isConnected = false;
      (createWalletClient as ReturnType<typeof vi.fn>).mockReturnValue({
        getAddresses: vi.fn().mockImplementation(() =>
          Promise.resolve(isConnected ? ['0x1234567890123456789012345678901234567890'] : [])
        ),
        requestAddresses: vi.fn().mockImplementation(() => {
          isConnected = true;
          return Promise.resolve(['0x1234567890123456789012345678901234567890']);
        }),
        switchChain: vi.fn().mockRejectedValue({ code: 4902 }),
        addChain: mockAddChain,
      });

      render(<ConnectWallet onConnected={mockOnConnected} />);

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));
      await user.click(screen.getByText('Browser Wallet'));

      await waitFor(() => {
        expect(mockAddChain).toHaveBeenCalled();
      });
    });
  });

  describe('Auto-Connection', () => {
    it('checks for existing connection on mount', async () => {
      const { createWalletClient } = await import('viem');

      (createWalletClient as ReturnType<typeof vi.fn>).mockReturnValue({
        getAddresses: vi.fn().mockResolvedValue(['0xAlreadyConnected123456789012345678901234']),
        requestAddresses: vi.fn().mockResolvedValue([]),
        switchChain: vi.fn().mockResolvedValue(undefined),
        addChain: vi.fn().mockResolvedValue(undefined),
      });

      render(<ConnectWallet onConnected={mockOnConnected} />);

      await waitFor(() => {
        expect(mockOnConnected).toHaveBeenCalledWith('0xAlreadyConnected123456789012345678901234');
      });
    });
  });

  describe('Accessibility', () => {
    it('connect button has accessible name', () => {
      render(<ConnectWallet onConnected={mockOnConnected} />);

      expect(screen.getByRole('button', { name: /CONNECT WALLET/i })).toBeInTheDocument();
    });

    it('disconnect button has accessible title', async () => {
      const user = userEvent.setup();
      const { createWalletClient } = await import('viem');

      let isConnected = false;
      (createWalletClient as ReturnType<typeof vi.fn>).mockReturnValue({
        getAddresses: vi.fn().mockImplementation(() =>
          Promise.resolve(isConnected ? ['0x1234567890123456789012345678901234567890'] : [])
        ),
        requestAddresses: vi.fn().mockImplementation(() => {
          isConnected = true;
          return Promise.resolve(['0x1234567890123456789012345678901234567890']);
        }),
        switchChain: vi.fn().mockResolvedValue(undefined),
        addChain: vi.fn().mockResolvedValue(undefined),
      });

      render(<ConnectWallet onConnected={mockOnConnected} />);

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));
      await user.click(screen.getByText('Browser Wallet'));

      await waitFor(() => {
        expect(screen.getByTitle('Disconnect')).toBeInTheDocument();
      });
    });

    it('wallet buttons in modal are keyboard accessible', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet onConnected={mockOnConnected} />);

      await user.click(screen.getByRole('button', { name: /CONNECT WALLET/i }));

      const browserWalletButton = screen.getByText('Browser Wallet');
      expect(browserWalletButton.closest('button')).toBeInTheDocument();
    });
  });
});
