/**
 * SignUp Page Component Tests
 *
 * Tests for the sign-up page with three options:
 * Recovery Phrase (recommended), Wallet, and Email.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import SignUpPage from '@/app/(public)/signup/page';

// ============================================================
// Mocks
// ============================================================

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock auth components to simplify testing
vi.mock('@/components/auth/OAuthButtons', () => ({
  OAuthButtons: () => (
    <div data-testid="oauth-buttons">
      <button>Google</button>
      <button>GitHub</button>
    </div>
  ),
}));

vi.mock('@/components/auth/WalletAuth', () => ({
  WalletAuth: ({ onConnect }: { onConnect?: (address: string) => void }) => (
    <div data-testid="wallet-auth">
      <button onClick={() => onConnect?.('0x1234')}>Connect Wallet</button>
    </div>
  ),
}));

// ============================================================
// SignUp Page Tests
// ============================================================

describe('SignUpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Header', () => {
    it('renders "Create Your Vault" heading', () => {
      render(<SignUpPage />);

      expect(screen.getByRole('heading', { name: /Create Your Vault/i })).toBeInTheDocument();
    });

    it('renders subtitle text', () => {
      render(<SignUpPage />);

      expect(screen.getByText(/Choose how to create your identity/i)).toBeInTheDocument();
    });
  });

  describe('Signup Options', () => {
    it('renders three signup options', () => {
      render(<SignUpPage />);

      // All three options should be visible as buttons
      expect(screen.getByRole('button', { name: /Create with Recovery Phrase/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create with Wallet/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create with Email/i })).toBeInTheDocument();
    });

    it('shows Recovery Phrase option as recommended', () => {
      render(<SignUpPage />);

      // The "Recommended" badge should appear with the Recovery Phrase option
      expect(screen.getByText('Recommended')).toBeInTheDocument();

      // Verify it's associated with the Recovery Phrase option
      const recoveryOption = screen.getByRole('button', { name: /Create with Recovery Phrase/i });
      expect(recoveryOption).toContainElement(screen.getByText('Recommended'));
    });

    it('shows descriptions for each option', () => {
      render(<SignUpPage />);

      expect(screen.getByText(/Generate a secure 12-word phrase/i)).toBeInTheDocument();
      expect(screen.getByText(/Use MetaMask or Coinbase Wallet/i)).toBeInTheDocument();
      expect(screen.getByText(/Quick setup with Google or GitHub/i)).toBeInTheDocument();
    });
  });

  describe('Option Selection', () => {
    it('selects Recovery Phrase option when clicked', async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      const recoveryOption = screen.getByRole('button', { name: /Create with Recovery Phrase/i });
      await user.click(recoveryOption);

      // Continue button should be enabled (not showing wallet or email UI)
      const continueButton = screen.getByRole('button', { name: /Continue/i });
      expect(continueButton).toBeInTheDocument();
      expect(continueButton).not.toBeDisabled();
    });

    it('shows Wallet UI when wallet option selected', async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      const walletOption = screen.getByRole('button', { name: /Create with Wallet/i });
      await user.click(walletOption);

      // Wallet auth component should appear
      expect(screen.getByTestId('wallet-auth')).toBeInTheDocument();
    });

    it('shows OAuth buttons when email option selected', async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      const emailOption = screen.getByRole('button', { name: /Create with Email/i });
      await user.click(emailOption);

      // OAuth buttons should appear
      expect(screen.getByTestId('oauth-buttons')).toBeInTheDocument();
      expect(screen.getByText(/Continue with/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('navigates to /onboarding when Recovery Phrase clicked and Continue pressed', async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      // Select Recovery Phrase option
      const recoveryOption = screen.getByRole('button', { name: /Create with Recovery Phrase/i });
      await user.click(recoveryOption);

      // Click Continue button
      const continueButton = screen.getByRole('button', { name: /Continue/i });
      await user.click(continueButton);

      // Should navigate to onboarding
      expect(mockPush).toHaveBeenCalledWith('/onboarding');
    });

    it('does not navigate when no option is selected', async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      // Continue button should be disabled when no selection
      const continueButton = screen.getByRole('button', { name: /Continue/i });
      expect(continueButton).toBeDisabled();

      // Try clicking anyway
      await user.click(continueButton);

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Footer Links', () => {
    it('renders Sign In link for existing users', () => {
      render(<SignUpPage />);

      const signInLink = screen.getByRole('link', { name: /Sign In/i });
      expect(signInLink).toBeInTheDocument();
      expect(signInLink).toHaveAttribute('href', '/signin');
    });

    it('renders "Already have an account?" text', () => {
      render(<SignUpPage />);

      expect(screen.getByText(/Already have an account\?/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<SignUpPage />);
      // Exclude heading-order rule: page uses h3 for option titles (design choice)
      const results = await axe(container, {
        rules: { 'heading-order': { enabled: false } },
      });
      expect(results).toHaveNoViolations();
    });

    it('option buttons are keyboard accessible', async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      // Focus the recovery option and press Enter
      const recoveryOption = screen.getByRole('button', { name: /Create with Recovery Phrase/i });
      recoveryOption.focus();
      await user.keyboard('{Enter}');

      // Continue button should now be enabled
      const continueButton = screen.getByRole('button', { name: /Continue/i });
      expect(continueButton).not.toBeDisabled();
    });

    it('can navigate through options with keyboard', async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      // Tab to first option
      await user.tab();

      // Select with Space
      await user.keyboard(' ');

      // Continue button should be enabled
      const continueButton = screen.getByRole('button', { name: /Continue/i });
      expect(continueButton).not.toBeDisabled();
    });
  });
});
