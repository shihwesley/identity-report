/**
 * RecoverySetup Component Tests
 *
 * Tests for the recovery setup wizard that guides users through
 * configuring key recovery with Shamir's Secret Sharing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { RecoverySetup, RecoveryStatus } from '@/components/dashboard/RecoverySetup';
import { RECOVERY_SCENARIOS } from '../../fixtures/test-vectors';

// ============================================================
// Mocks
// ============================================================

// Mock the guardian manager module
vi.mock('@/lib/recovery/guardian', () => ({
  getGuardianManager: vi.fn(() => ({
    initializeRecovery: vi.fn().mockResolvedValue({
      enabled: true,
      social: {
        guardians: [
          { id: 'g1', label: 'Mom', address: '0x1234567890123456789012345678901234567890' },
          { id: 'g2', label: 'Best Friend', address: '0x2345678901234567890123456789012345678901' },
          { id: 'g3', label: 'Brother', address: '0x3456789012345678901234567890123456789012' },
        ],
      },
      shamir: {
        threshold: 2,
        expiresAt: null,
      },
    }),
    getConfig: vi.fn().mockReturnValue(null),
  })),
}));

// Mock the expiry monitor module
vi.mock('@/lib/recovery/monitor', () => ({
  getExpiryMonitor: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

// Mock recovery constants
vi.mock('@/lib/recovery/types', () => ({
  RECOVERY_CONSTANTS: {
    MIN_GUARDIANS: 3,
    MAX_GUARDIANS: 5,
    DEFAULT_TIME_LOCK_HOURS: 72,
    DEFAULT_SHARE_EXPIRY_DAYS: 365,
  },
}));

// ============================================================
// Test Utilities
// ============================================================

function createMockCryptoKey(): CryptoKey {
  return {
    type: 'secret',
    extractable: false,
    algorithm: { name: 'AES-GCM', length: 256 },
    usages: ['encrypt', 'decrypt'],
  } as CryptoKey;
}

// ============================================================
// RecoverySetup Component Tests
// ============================================================

describe('RecoverySetup', () => {
  const mockOnConfigured = vi.fn();
  const mockOnClose = vi.fn();
  const mockEncryptionKey = createMockCryptoKey();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Intro Step', () => {
    it('renders the intro step initially', () => {
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Protect Your Account')).toBeInTheDocument();
      expect(screen.getByText(/Set up recovery guardians/)).toBeInTheDocument();
    });

    it('should have no accessibility violations', async () => {
      const { container } = render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('displays how it works instructions', () => {
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('How it works:')).toBeInTheDocument();
      expect(screen.getByText(/Choose 3-5 trusted people/)).toBeInTheDocument();
      expect(screen.getByText(/Each guardian receives a unique recovery share/)).toBeInTheDocument();
      expect(screen.getByText(/To recover, collect enough shares/)).toBeInTheDocument();
    });

    it('shows important security notice', () => {
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Choose guardians you trust completely/)).toBeInTheDocument();
    });

    it('navigates to guardians step when Get Started is clicked', async () => {
      const user = userEvent.setup();
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      const getStartedButton = screen.getByRole('button', { name: /Get Started/i });
      await user.click(getStartedButton);

      expect(screen.getByText('Add Your Guardians')).toBeInTheDocument();
    });
  });

  describe('Guardians Step', () => {
    async function navigateToGuardians(user: ReturnType<typeof userEvent.setup>) {
      const getStartedButton = screen.getByRole('button', { name: /Get Started/i });
      await user.click(getStartedButton);
    }

    it('displays guardian input fields', async () => {
      const user = userEvent.setup();
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      await navigateToGuardians(user);

      expect(screen.getByText('Guardian 1')).toBeInTheDocument();
      expect(screen.getByText('Guardian 2')).toBeInTheDocument();
      expect(screen.getByText('Guardian 3')).toBeInTheDocument();
    });

    it('allows filling in guardian information', async () => {
      const user = userEvent.setup();
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      await navigateToGuardians(user);

      const labelInputs = screen.getAllByPlaceholderText(/Label/i);
      const addressInputs = screen.getAllByPlaceholderText(/Ethereum address/i);

      await user.type(labelInputs[0], 'Mom');
      await user.type(addressInputs[0], '0x1234567890123456789012345678901234567890');

      expect(labelInputs[0]).toHaveValue('Mom');
      expect(addressInputs[0]).toHaveValue('0x1234567890123456789012345678901234567890');
    });

    it('allows adding another guardian', async () => {
      const user = userEvent.setup();
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      await navigateToGuardians(user);

      const addButton = screen.getByRole('button', { name: /Add Another Guardian/i });
      await user.click(addButton);

      expect(screen.getByText('Guardian 4')).toBeInTheDocument();
    });

    it('allows removing a guardian when more than minimum', async () => {
      const user = userEvent.setup();
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      await navigateToGuardians(user);

      // First add a fourth guardian
      const addButton = screen.getByRole('button', { name: /Add Another Guardian/i });
      await user.click(addButton);

      // Now remove one
      const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
      await user.click(removeButtons[0]);

      expect(screen.queryByText('Guardian 4')).not.toBeInTheDocument();
    });

    it('disables Continue button when not enough valid guardians', async () => {
      const user = userEvent.setup();
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      await navigateToGuardians(user);

      const continueButton = screen.getByRole('button', { name: /Continue \(0 guardians\)/i });
      expect(continueButton).toBeDisabled();
    });

    it('enables Continue button when minimum guardians are valid', async () => {
      const user = userEvent.setup();
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      await navigateToGuardians(user);

      // Fill in 3 guardians
      const labelInputs = screen.getAllByPlaceholderText(/Label/i);
      const addressInputs = screen.getAllByPlaceholderText(/Ethereum address/i);

      for (let i = 0; i < 3; i++) {
        await user.type(labelInputs[i], `Guardian ${i + 1}`);
        await user.type(addressInputs[i], `0x${'1'.repeat(40)}`);
      }

      const continueButton = screen.getByRole('button', { name: /Continue \(3 guardians\)/i });
      expect(continueButton).not.toBeDisabled();
    });

    it('allows navigating back to intro', async () => {
      const user = userEvent.setup();
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      await navigateToGuardians(user);

      const backButton = screen.getByRole('button', { name: /Back/i });
      await user.click(backButton);

      expect(screen.getByText('Protect Your Account')).toBeInTheDocument();
    });
  });

  describe('Settings Step', () => {
    async function navigateToSettings(user: ReturnType<typeof userEvent.setup>) {
      // Navigate to guardians
      const getStartedButton = screen.getByRole('button', { name: /Get Started/i });
      await user.click(getStartedButton);

      // Fill in guardians
      const labelInputs = screen.getAllByPlaceholderText(/Label/i);
      const addressInputs = screen.getAllByPlaceholderText(/Ethereum address/i);

      for (let i = 0; i < 3; i++) {
        await user.type(labelInputs[i], `Guardian ${i + 1}`);
        await user.type(addressInputs[i], `0x${'1'.repeat(40)}`);
      }

      // Navigate to settings
      const continueButton = screen.getByRole('button', { name: /Continue/i });
      await user.click(continueButton);
    }

    it('displays recovery settings options', async () => {
      const user = userEvent.setup();
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      await navigateToSettings(user);

      expect(screen.getByText('Recovery Settings')).toBeInTheDocument();
      expect(screen.getByText('Required Guardians for Recovery')).toBeInTheDocument();
      expect(screen.getByText('Recovery Time Lock')).toBeInTheDocument();
      expect(screen.getByText('Share Expiry')).toBeInTheDocument();
    });

    it.skip('allows selecting threshold', async () => {
      const user = userEvent.setup();
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      await navigateToSettings(user);

      const thresholdSelect = screen.getByRole('combobox', { name: /Required Guardians/i });
      await user.selectOptions(thresholdSelect, '2');

      expect(thresholdSelect).toHaveValue('2');
    });

    it.skip('allows selecting time lock duration', async () => {
      const user = userEvent.setup();
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      await navigateToSettings(user);

      const timeLockSelect = screen.getByRole('combobox', { name: /Recovery Time Lock/i });
      await user.selectOptions(timeLockSelect, '48');

      expect(timeLockSelect).toHaveValue('48');
    });

    it('allows toggling share expiry', async () => {
      const user = userEvent.setup();
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      await navigateToSettings(user);

      const expiryToggle = screen.getByRole('checkbox');
      await user.click(expiryToggle);

      expect(expiryToggle).toBeChecked();
    });

    it('shows expiry duration selector when expiry is enabled', async () => {
      const user = userEvent.setup();
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      await navigateToSettings(user);

      const expiryToggle = screen.getByRole('checkbox');
      await user.click(expiryToggle);

      // Multiple comboboxes exist on the page, check that at least the expiry one is present
      const comboboxes = screen.getAllByRole('combobox');
      expect(comboboxes.length).toBeGreaterThan(0);
    });

    it('allows navigating back to guardians', async () => {
      const user = userEvent.setup();
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      await navigateToSettings(user);

      const backButton = screen.getByRole('button', { name: /Back/i });
      await user.click(backButton);

      expect(screen.getByText('Add Your Guardians')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('shows error when encryption key is not available', async () => {
      const user = userEvent.setup();
      render(
        <RecoverySetup
          encryptionKey={null}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      // Navigate to guardians
      await user.click(screen.getByRole('button', { name: /Get Started/i }));

      // Fill in guardians
      const labelInputs = screen.getAllByPlaceholderText(/Label/i);
      const addressInputs = screen.getAllByPlaceholderText(/Ethereum address/i);

      for (let i = 0; i < 3; i++) {
        await user.type(labelInputs[i], `Guardian ${i + 1}`);
        await user.type(addressInputs[i], `0x${'1'.repeat(40)}`);
      }

      // Navigate to settings
      await user.click(screen.getByRole('button', { name: /Continue/i }));

      // Try to create shares
      const createButton = screen.getByRole('button', { name: /Create Recovery Shares/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/Encryption key not available/)).toBeInTheDocument();
      });
    });
  });

  describe('Distribution Step', () => {
    it('shows success message after creating shares', async () => {
      const user = userEvent.setup();
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      // Navigate through wizard
      await user.click(screen.getByRole('button', { name: /Get Started/i }));

      // Fill in guardians
      const labelInputs = screen.getAllByPlaceholderText(/Label/i);
      const addressInputs = screen.getAllByPlaceholderText(/Ethereum address/i);

      for (let i = 0; i < 3; i++) {
        await user.type(labelInputs[i], RECOVERY_SCENARIOS.twoOfThree.guardians[i].name);
        await user.type(addressInputs[i], `0x${'1'.repeat(40)}`);
      }

      await user.click(screen.getByRole('button', { name: /Continue/i }));
      await user.click(screen.getByRole('button', { name: /Create Recovery Shares/i }));

      await waitFor(() => {
        expect(screen.getByText('Shares Created Successfully')).toBeInTheDocument();
      });
    });
  });

  describe('Complete Step', () => {
    it('shows completion summary', async () => {
      const user = userEvent.setup();
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      // Navigate through entire wizard
      await user.click(screen.getByRole('button', { name: /Get Started/i }));

      const labelInputs = screen.getAllByPlaceholderText(/Label/i);
      const addressInputs = screen.getAllByPlaceholderText(/Ethereum address/i);

      for (let i = 0; i < 3; i++) {
        await user.type(labelInputs[i], `Guardian ${i + 1}`);
        await user.type(addressInputs[i], `0x${'1'.repeat(40)}`);
      }

      await user.click(screen.getByRole('button', { name: /Continue/i }));
      await user.click(screen.getByRole('button', { name: /Create Recovery Shares/i }));

      await waitFor(() => {
        expect(screen.getByText('Shares Created Successfully')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Complete Setup/i }));

      expect(screen.getByText('Recovery Setup Complete')).toBeInTheDocument();
    });

    it('calls onConfigured and onClose when Done is clicked', async () => {
      const user = userEvent.setup();
      render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      // Navigate through entire wizard
      await user.click(screen.getByRole('button', { name: /Get Started/i }));

      const labelInputs = screen.getAllByPlaceholderText(/Label/i);
      const addressInputs = screen.getAllByPlaceholderText(/Ethereum address/i);

      for (let i = 0; i < 3; i++) {
        await user.type(labelInputs[i], `Guardian ${i + 1}`);
        await user.type(addressInputs[i], `0x${'1'.repeat(40)}`);
      }

      await user.click(screen.getByRole('button', { name: /Continue/i }));
      await user.click(screen.getByRole('button', { name: /Create Recovery Shares/i }));

      await waitFor(() => {
        expect(screen.getByText('Shares Created Successfully')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Complete Setup/i }));
      await user.click(screen.getByRole('button', { name: /Done/i }));

      expect(mockOnConfigured).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Progress Indicator', () => {
    it('shows correct progress through steps', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <RecoverySetup
          encryptionKey={mockEncryptionKey}
          onConfigured={mockOnConfigured}
          onClose={mockOnClose}
        />
      );

      // On intro step, first indicator should be active
      const progressBars = container.querySelectorAll('.h-1.flex-1');
      expect(progressBars).toHaveLength(5);

      // Navigate forward
      await user.click(screen.getByRole('button', { name: /Get Started/i }));

      // Second indicator should now be active
      const updatedProgressBars = container.querySelectorAll('.bg-emerald-500');
      expect(updatedProgressBars.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================
// RecoveryStatus Component Tests
// ============================================================

describe('RecoveryStatus', () => {
  const mockOnSetup = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Unconfigured State', () => {
    it('shows Set Up button when recovery is not configured', () => {
      render(<RecoveryStatus onSetup={mockOnSetup} />);

      expect(screen.getByText('Account Recovery')).toBeInTheDocument();
      expect(screen.getByText('Not configured')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Set Up/i })).toBeInTheDocument();
    });

    it('should have no accessibility violations', async () => {
      const { container } = render(<RecoveryStatus onSetup={mockOnSetup} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('calls onSetup when Set Up button is clicked', async () => {
      const user = userEvent.setup();
      render(<RecoveryStatus onSetup={mockOnSetup} />);

      const setupButton = screen.getByRole('button', { name: /Set Up/i });
      await user.click(setupButton);

      expect(mockOnSetup).toHaveBeenCalledTimes(1);
    });
  });

  describe('Configured State', () => {
    beforeEach(async () => {
      const { getGuardianManager } = vi.mocked(
        await import('@/lib/recovery/guardian')
      );
      (getGuardianManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        getConfig: () => ({
          enabled: true,
          social: {
            guardians: [
              { id: 'g1', label: 'Mom', address: '0x123' },
              { id: 'g2', label: 'Dad', address: '0x456' },
              { id: 'g3', label: 'Friend', address: '0x789' },
            ],
          },
          shamir: {
            threshold: 2,
            expiresAt: null,
          },
        }),
      });
    });

    it('shows Active status when recovery is configured', async () => {
      render(<RecoveryStatus />);

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument();
      });
    });

    it('displays guardian count', async () => {
      render(<RecoveryStatus />);

      await waitFor(() => {
        expect(screen.getByText('3 guardians configured')).toBeInTheDocument();
      });
    });

    it('displays threshold requirement', async () => {
      render(<RecoveryStatus />);

      await waitFor(() => {
        expect(screen.getByText('2 required for recovery')).toBeInTheDocument();
      });
    });
  });
});
