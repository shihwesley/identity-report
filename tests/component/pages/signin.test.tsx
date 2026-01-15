/**
 * SignIn Page Component Tests
 *
 * Tests for the sign-in page with tabbed auth methods:
 * Wallet, Email, and Recovery (mnemonic).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import SignInPage from '@/app/(public)/signin/page';

// ============================================================
// Mocks
// ============================================================

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock session
vi.mock('@/lib/auth/session', () => ({
  setVaultSession: vi.fn(),
}));

// Mock auth components to simplify testing
vi.mock('@/components/auth/WalletAuth', () => ({
  WalletAuth: ({ onConnect }: { onConnect?: (address: string) => void }) => (
    <div data-testid="wallet-auth">
      <button onClick={() => onConnect?.('0x1234')}>MetaMask</button>
    </div>
  ),
}));

vi.mock('@/components/auth/EmailAuth', () => ({
  EmailAuth: ({ onSubmit, isLoading }: { onSubmit?: (email: string, password: string) => void; isLoading?: boolean }) => (
    <div data-testid="email-auth">
      <input type="email" placeholder="Email" aria-label="email" />
      <input type="password" placeholder="Password" aria-label="password" />
      <button onClick={() => onSubmit?.('test@example.com', 'password')} disabled={isLoading}>
        Sign In
      </button>
    </div>
  ),
}));

vi.mock('@/components/auth/MnemonicAuth', () => ({
  MnemonicAuth: ({ onSubmit, isLoading }: { onSubmit?: (mnemonic: string, password: string) => void; isLoading?: boolean }) => (
    <div data-testid="mnemonic-auth">
      <textarea placeholder="Recovery phrase" aria-label="recovery phrase" />
      <button onClick={() => onSubmit?.('word1 word2 ...', 'password')} disabled={isLoading}>
        Restore Vault
      </button>
    </div>
  ),
}));

// ============================================================
// SignIn Page Tests
// ============================================================

describe('SignInPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Header', () => {
    it('renders Welcome Back heading', () => {
      render(<SignInPage />);

      expect(screen.getByRole('heading', { name: /Welcome Back/i })).toBeInTheDocument();
    });

    it('renders subtitle text', () => {
      render(<SignInPage />);

      expect(screen.getByText(/Sign in to access your identity vault/i)).toBeInTheDocument();
    });
  });

  describe('Auth Tabs', () => {
    it('renders three auth tabs: Wallet, Email, Recovery', () => {
      render(<SignInPage />);

      // Check for all three tabs by their visible text (shown on larger screens)
      expect(screen.getByRole('button', { name: /Wallet/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Email/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Recovery/i })).toBeInTheDocument();
    });

    it('shows Wallet tab content by default (MetaMask visible)', () => {
      render(<SignInPage />);

      // Wallet auth component should be visible
      expect(screen.getByTestId('wallet-auth')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /MetaMask/i })).toBeInTheDocument();

      // Other auth methods should NOT be visible
      expect(screen.queryByTestId('email-auth')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mnemonic-auth')).not.toBeInTheDocument();
    });

    it('switches to Email tab when clicked', async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      // Click Email tab
      await user.click(screen.getByRole('button', { name: /Email/i }));

      // Email auth should now be visible
      expect(screen.getByTestId('email-auth')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();

      // Wallet auth should NOT be visible
      expect(screen.queryByTestId('wallet-auth')).not.toBeInTheDocument();
    });

    it('switches to Recovery tab when clicked', async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      // Click Recovery tab
      await user.click(screen.getByRole('button', { name: /Recovery/i }));

      // Mnemonic auth should now be visible
      expect(screen.getByTestId('mnemonic-auth')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Recovery phrase')).toBeInTheDocument();

      // Wallet auth should NOT be visible
      expect(screen.queryByTestId('wallet-auth')).not.toBeInTheDocument();
    });

    it('can switch between all tabs', async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      // Start with Wallet
      expect(screen.getByTestId('wallet-auth')).toBeInTheDocument();

      // Go to Email
      await user.click(screen.getByRole('button', { name: /Email/i }));
      expect(screen.getByTestId('email-auth')).toBeInTheDocument();

      // Go to Recovery
      await user.click(screen.getByRole('button', { name: /Recovery/i }));
      expect(screen.getByTestId('mnemonic-auth')).toBeInTheDocument();

      // Back to Wallet
      await user.click(screen.getByRole('button', { name: /Wallet/i }));
      expect(screen.getByTestId('wallet-auth')).toBeInTheDocument();
    });
  });

  describe('Footer Links', () => {
    it('renders Sign Up link for new users', () => {
      render(<SignInPage />);

      const signUpLink = screen.getByRole('link', { name: /Sign Up/i });
      expect(signUpLink).toBeInTheDocument();
      expect(signUpLink).toHaveAttribute('href', '/signup');
    });

    it('renders "Don\'t have an account?" text', () => {
      render(<SignInPage />);

      expect(screen.getByText(/Don't have an account\?/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<SignInPage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('tab buttons are keyboard accessible', async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      // Tab to the Email button and press Enter
      const emailTab = screen.getByRole('button', { name: /Email/i });
      emailTab.focus();
      await user.keyboard('{Enter}');

      expect(screen.getByTestId('email-auth')).toBeInTheDocument();
    });
  });
});
