/**
 * SyncStatus Component Tests
 *
 * Tests for sync status UI components including:
 * - SyncStatusIndicator: Compact status display
 * - SyncStatusBanner: Blocked state banner
 * - SyncStatusPanel: Detailed sync status modal
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import {
  SyncStatusIndicator,
  SyncStatusBanner,
  SyncStatusPanel,
} from '@/components/dashboard/SyncStatus';
import { SyncQueueStatus, DeadLetterEntry } from '@/lib/sync/queue';

// ============================================================
// Mocks
// ============================================================

const mockQueueStatus: SyncQueueStatus = {
  pending: 0,
  processing: 0,
  failed: 0,
  deadLetter: 0,
  isOnline: true,
  isSyncing: false,
  isBlocked: false,
  queueCapacity: {
    used: 10,
    max: 100,
  },
};

const mockDeadLetterEntries: DeadLetterEntry[] = [
  {
    id: 'dl-1',
    type: 'update',
    entity: 'memory',
    entityId: 'mem-123',
    failedAt: Date.now() - 3600000,
    lastError: 'Network timeout',
    attempts: 3,
    purgeAt: Date.now() + 86400000 * 7,
  },
  {
    id: 'dl-2',
    type: 'create',
    entity: 'conversation',
    entityId: 'conv-456',
    failedAt: Date.now() - 7200000,
    lastError: 'Server error: 500',
    attempts: 5,
    purgeAt: Date.now() + 86400000 * 5,
  },
];

const mockSubscribe = vi.fn(() => vi.fn());
const mockForceSync = vi.fn();
const mockClearQueue = vi.fn();
const mockRetryDeadLetter = vi.fn();
const mockDismissDeadLetter = vi.fn();
const mockRetryAllDeadLetter = vi.fn();
const mockGetDeadLetterEntries = vi.fn(() => []);

vi.mock('@/lib/sync/queue', () => ({
  getSyncQueue: vi.fn(() => ({
    getStatus: vi.fn(() => mockQueueStatus),
    subscribe: mockSubscribe,
    forceSync: mockForceSync,
    clearQueue: mockClearQueue,
    retryDeadLetter: mockRetryDeadLetter,
    dismissDeadLetter: mockDismissDeadLetter,
    retryAllDeadLetter: mockRetryAllDeadLetter,
    getDeadLetterEntries: mockGetDeadLetterEntries,
  })),
  SyncQueue: vi.fn(),
}));

// ============================================================
// Test Utilities
// ============================================================

function updateMockStatus(updates: Partial<SyncQueueStatus>) {
  Object.assign(mockQueueStatus, updates);
}

function resetMockStatus() {
  Object.assign(mockQueueStatus, {
    pending: 0,
    processing: 0,
    failed: 0,
    deadLetter: 0,
    isOnline: true,
    isSyncing: false,
    isBlocked: false,
    queueCapacity: { used: 10, max: 100 },
  });
}

// ============================================================
// SyncStatusIndicator Tests
// ============================================================

describe('SyncStatusIndicator', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockStatus();
  });

  describe('Status Display', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<SyncStatusIndicator onClick={mockOnClick} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('shows synced status when idle and online', () => {
      render(<SyncStatusIndicator onClick={mockOnClick} />);

      expect(screen.getByText('Synced')).toBeInTheDocument();
    });

    it('shows syncing status with spinner when syncing', () => {
      updateMockStatus({ isSyncing: true });
      const { container } = render(<SyncStatusIndicator onClick={mockOnClick} />);

      expect(screen.getByText('Syncing...')).toBeInTheDocument();
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('shows offline status when not online', () => {
      updateMockStatus({ isOnline: false });
      render(<SyncStatusIndicator onClick={mockOnClick} />);

      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('shows queue full status when blocked', () => {
      updateMockStatus({ isBlocked: true });
      render(<SyncStatusIndicator onClick={mockOnClick} />);

      expect(screen.getByText('Queue Full')).toBeInTheDocument();
    });

    it('shows pending count when items pending', () => {
      updateMockStatus({ pending: 5 });
      render(<SyncStatusIndicator onClick={mockOnClick} />);

      expect(screen.getByText('5 pending')).toBeInTheDocument();
    });

    it('shows dead letter badge when there are failed items', () => {
      updateMockStatus({ deadLetter: 3 });
      render(<SyncStatusIndicator onClick={mockOnClick} />);

      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('Color Coding', () => {
    it('uses green color when synced', () => {
      const { container } = render(<SyncStatusIndicator onClick={mockOnClick} />);

      const button = container.querySelector('button');
      expect(button).toHaveClass('text-green-500');
    });

    it('uses blue color when syncing', () => {
      updateMockStatus({ isSyncing: true });
      const { container } = render(<SyncStatusIndicator onClick={mockOnClick} />);

      const button = container.querySelector('button');
      expect(button).toHaveClass('text-blue-500');
    });

    it('uses gray color when offline', () => {
      updateMockStatus({ isOnline: false });
      const { container } = render(<SyncStatusIndicator onClick={mockOnClick} />);

      const button = container.querySelector('button');
      expect(button).toHaveClass('text-gray-500');
    });

    it('uses red color when blocked', () => {
      updateMockStatus({ isBlocked: true });
      const { container } = render(<SyncStatusIndicator onClick={mockOnClick} />);

      const button = container.querySelector('button');
      expect(button).toHaveClass('text-red-500');
    });

    it('uses amber color when has pending items', () => {
      updateMockStatus({ pending: 3 });
      const { container } = render(<SyncStatusIndicator onClick={mockOnClick} />);

      const button = container.querySelector('button');
      expect(button).toHaveClass('text-amber-500');
    });
  });

  describe('Interactions', () => {
    it('calls onClick when clicked', async () => {
      const user = userEvent.setup();
      render(<SyncStatusIndicator onClick={mockOnClick} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('has accessible title attribute', () => {
      render(<SyncStatusIndicator onClick={mockOnClick} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Sync Status: Synced');
    });
  });

  describe('Subscription', () => {
    it('subscribes to queue updates on mount', () => {
      render(<SyncStatusIndicator onClick={mockOnClick} />);

      expect(mockSubscribe).toHaveBeenCalled();
    });

    it('unsubscribes on unmount', () => {
      const unsubscribe = vi.fn();
      mockSubscribe.mockReturnValue(unsubscribe);

      const { unmount } = render(<SyncStatusIndicator onClick={mockOnClick} />);
      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });
});

// ============================================================
// SyncStatusBanner Tests
// ============================================================

describe('SyncStatusBanner', () => {
  const mockOnOpenDetails = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockStatus();
  });

  describe('Visibility', () => {
    it('should have no accessibility violations when blocked', async () => {
      updateMockStatus({
        isBlocked: true,
        queueCapacity: { used: 100, max: 100 },
      });
      const { container } = render(<SyncStatusBanner onOpenDetails={mockOnOpenDetails} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('does not render when not blocked', () => {
      const { container } = render(<SyncStatusBanner onOpenDetails={mockOnOpenDetails} />);

      expect(container.firstChild).toBeNull();
    });

    it('renders when blocked', () => {
      updateMockStatus({
        isBlocked: true,
        queueCapacity: { used: 100, max: 100 },
      });
      render(<SyncStatusBanner onOpenDetails={mockOnOpenDetails} />);

      expect(screen.getByText(/Sync queue full/)).toBeInTheDocument();
    });
  });

  describe('Content', () => {
    beforeEach(() => {
      updateMockStatus({
        isBlocked: true,
        queueCapacity: { used: 100, max: 100 },
      });
    });

    it('shows queue capacity information', () => {
      render(<SyncStatusBanner onOpenDetails={mockOnOpenDetails} />);

      expect(screen.getByText(/100\/100/)).toBeInTheDocument();
    });

    it('shows Details button when handler provided', () => {
      render(<SyncStatusBanner onOpenDetails={mockOnOpenDetails} />);

      expect(screen.getByRole('button', { name: /Details/i })).toBeInTheDocument();
    });

    it('shows Sync Now button when online', () => {
      render(<SyncStatusBanner onOpenDetails={mockOnOpenDetails} />);

      expect(screen.getByRole('button', { name: /Sync Now/i })).toBeInTheDocument();
    });

    it('shows Offline text when not online', () => {
      updateMockStatus({ isOnline: false });
      render(<SyncStatusBanner onOpenDetails={mockOnOpenDetails} />);

      expect(screen.getByRole('button', { name: /Offline/i })).toBeInTheDocument();
    });

    it('shows Clear Queue button', () => {
      render(<SyncStatusBanner onOpenDetails={mockOnOpenDetails} />);

      expect(screen.getByRole('button', { name: /Clear Queue/i })).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    beforeEach(() => {
      updateMockStatus({
        isBlocked: true,
        isOnline: true,
        queueCapacity: { used: 100, max: 100 },
      });
    });

    it('calls onOpenDetails when Details clicked', async () => {
      const user = userEvent.setup();
      render(<SyncStatusBanner onOpenDetails={mockOnOpenDetails} />);

      await user.click(screen.getByRole('button', { name: /Details/i }));

      expect(mockOnOpenDetails).toHaveBeenCalled();
    });

    it('calls forceSync when Sync Now clicked', async () => {
      const user = userEvent.setup();
      render(<SyncStatusBanner onOpenDetails={mockOnOpenDetails} />);

      await user.click(screen.getByRole('button', { name: /Sync Now/i }));

      expect(mockForceSync).toHaveBeenCalled();
    });

    it('shows Syncing text while syncing', async () => {
      const user = userEvent.setup();
      mockForceSync.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<SyncStatusBanner onOpenDetails={mockOnOpenDetails} />);

      await user.click(screen.getByRole('button', { name: /Sync Now/i }));

      expect(screen.getByText('Syncing...')).toBeInTheDocument();
    });

    it('disables Sync Now when offline', () => {
      updateMockStatus({ isOnline: false });
      render(<SyncStatusBanner onOpenDetails={mockOnOpenDetails} />);

      const syncButton = screen.getByRole('button', { name: /Offline/i });
      expect(syncButton).toBeDisabled();
    });
  });

  describe('Clear Queue Confirmation', () => {
    beforeEach(() => {
      updateMockStatus({
        isBlocked: true,
        queueCapacity: { used: 100, max: 100 },
      });
    });

    it('shows confirmation dialog before clearing', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(<SyncStatusBanner onOpenDetails={mockOnOpenDetails} />);

      await user.click(screen.getByRole('button', { name: /Clear Queue/i }));

      expect(confirmSpy).toHaveBeenCalledWith(
        'This will permanently delete all pending changes. Are you sure?'
      );
      expect(mockClearQueue).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('clears queue when confirmed', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(<SyncStatusBanner onOpenDetails={mockOnOpenDetails} />);

      await user.click(screen.getByRole('button', { name: /Clear Queue/i }));

      expect(mockClearQueue).toHaveBeenCalled();

      confirmSpy.mockRestore();
    });
  });
});

// ============================================================
// SyncStatusPanel Tests
// ============================================================

describe('SyncStatusPanel', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockStatus();
    mockGetDeadLetterEntries.mockReturnValue([]);
  });

  describe('Visibility', () => {
    it('should have no accessibility violations when open', async () => {
      const { container } = render(
        <SyncStatusPanel isOpen={true} onClose={mockOnClose} />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('does not render when not open', () => {
      const { container } = render(
        <SyncStatusPanel isOpen={false} onClose={mockOnClose} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders when open', () => {
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      // "Sync Status" may appear as both panel title and status label
      expect(screen.getAllByText('Sync Status').length).toBeGreaterThan(0);
    });
  });

  describe('Header', () => {
    it('shows close button', () => {
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument();
    });

    it('calls onClose when close button clicked', async () => {
      const user = userEvent.setup();
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      // Find the close button (the X button in header)
      const closeButton = screen.getByRole('button', { name: /Close/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Tabs', () => {
    it('shows Status and Failed tabs', () => {
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('button', { name: /Status/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Failed/i })).toBeInTheDocument();
    });

    it('shows dead letter count in Failed tab', () => {
      updateMockStatus({ deadLetter: 5 });
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText(/Failed \(5\)/)).toBeInTheDocument();
    });

    it('switches between tabs', async () => {
      const user = userEvent.setup();
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      const failedTab = screen.getByRole('button', { name: /Failed/i });
      await user.click(failedTab);

      expect(screen.getByText('No failed operations')).toBeInTheDocument();
    });
  });

  describe('Status Tab', () => {
    it('shows connection status', () => {
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Connection')).toBeInTheDocument();
      expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('shows offline when not connected', () => {
      updateMockStatus({ isOnline: false });
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('shows sync status', () => {
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      // Panel header and status label may appear multiple times
      expect(screen.getAllByText('Sync Status').length).toBeGreaterThan(0);
      // "Idle" may appear multiple times (header, status row)
      expect(screen.getAllByText('Idle').length).toBeGreaterThan(0);
    });

    it('shows syncing when in progress', () => {
      updateMockStatus({ isSyncing: true });
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      expect(screen.getAllByText('Syncing...').length).toBeGreaterThan(0);
    });

    it('shows queue capacity', () => {
      updateMockStatus({ queueCapacity: { used: 25, max: 100 } });
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Queue')).toBeInTheDocument();
      expect(screen.getByText('25 / 100')).toBeInTheDocument();
    });

    it('shows queue progress bar', () => {
      updateMockStatus({ queueCapacity: { used: 50, max: 100 } });
      const { container } = render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      const progressBar = container.querySelector('.h-2.rounded-full.bg-blue-500, .h-2.rounded-full.bg-red-500');
      expect(progressBar).toBeInTheDocument();
    });

    it('shows red progress bar when blocked', () => {
      updateMockStatus({ isBlocked: true, queueCapacity: { used: 100, max: 100 } });
      const { container } = render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      const progressBar = container.querySelector('.bg-red-500');
      expect(progressBar).toBeInTheDocument();
    });

    it('shows detailed counts', () => {
      updateMockStatus({
        pending: 10,
        processing: 2,
        failed: 3,
        deadLetter: 1,
      });
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Processing')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Retrying')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('Dead Letter')).toBeInTheDocument();
    });
  });

  describe('Failed Tab', () => {
    beforeEach(() => {
      mockGetDeadLetterEntries.mockReturnValue(mockDeadLetterEntries);
      updateMockStatus({ deadLetter: 2 });
    });

    it('shows empty state when no failed items', async () => {
      const user = userEvent.setup();
      mockGetDeadLetterEntries.mockReturnValue([]);
      updateMockStatus({ deadLetter: 0 });

      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      await user.click(screen.getByRole('button', { name: /Failed/i }));

      expect(screen.getByText('No failed operations')).toBeInTheDocument();
    });

    it('shows failed items', async () => {
      const user = userEvent.setup();
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      await user.click(screen.getByRole('button', { name: /Failed/i }));

      expect(screen.getByText(/update memory/i)).toBeInTheDocument();
      expect(screen.getByText(/create conversation/i)).toBeInTheDocument();
    });

    it('shows error message for each item', async () => {
      const user = userEvent.setup();
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      await user.click(screen.getByRole('button', { name: /Failed/i }));

      expect(screen.getByText('Network timeout')).toBeInTheDocument();
      expect(screen.getByText('Server error: 500')).toBeInTheDocument();
    });

    it('shows Retry All button', async () => {
      const user = userEvent.setup();
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      await user.click(screen.getByRole('button', { name: /Failed/i }));

      expect(screen.getByRole('button', { name: /Retry All/i })).toBeInTheDocument();
    });

    it('calls retryAllDeadLetter when Retry All clicked', async () => {
      const user = userEvent.setup();
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      await user.click(screen.getByRole('button', { name: /Failed/i }));
      await user.click(screen.getByRole('button', { name: /Retry All/i }));

      expect(mockRetryAllDeadLetter).toHaveBeenCalled();
    });

    it('shows Retry button for each item', async () => {
      const user = userEvent.setup();
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      await user.click(screen.getByRole('button', { name: /Failed/i }));

      const retryButtons = screen.getAllByRole('button', { name: /^Retry$/i });
      expect(retryButtons).toHaveLength(2);
    });

    it('calls retryDeadLetter for specific item', async () => {
      const user = userEvent.setup();
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      await user.click(screen.getByRole('button', { name: /Failed/i }));
      const retryButtons = screen.getAllByRole('button', { name: /^Retry$/i });
      await user.click(retryButtons[0]);

      expect(mockRetryDeadLetter).toHaveBeenCalledWith('dl-1');
    });

    it('shows Dismiss button for each item', async () => {
      const user = userEvent.setup();
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      await user.click(screen.getByRole('button', { name: /Failed/i }));

      const dismissButtons = screen.getAllByRole('button', { name: /Dismiss/i });
      expect(dismissButtons).toHaveLength(2);
    });

    it('calls dismissDeadLetter for specific item', async () => {
      const user = userEvent.setup();
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      await user.click(screen.getByRole('button', { name: /Failed/i }));
      const dismissButtons = screen.getAllByRole('button', { name: /Dismiss/i });
      await user.click(dismissButtons[0]);

      expect(mockDismissDeadLetter).toHaveBeenCalledWith('dl-1');
    });

    it('shows auto-delete countdown', async () => {
      const user = userEvent.setup();
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      await user.click(screen.getByRole('button', { name: /Failed/i }));

      // Multiple entries may have auto-delete countdowns
      const autoDeleteElements = screen.getAllByText(/Auto-delete in \d+ days/);
      expect(autoDeleteElements.length).toBeGreaterThan(0);
    });
  });

  describe('Subscription', () => {
    it('subscribes to queue updates on mount', () => {
      render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);

      expect(mockSubscribe).toHaveBeenCalled();
    });

    it('unsubscribes on unmount', () => {
      const unsubscribe = vi.fn();
      mockSubscribe.mockReturnValue(unsubscribe);

      const { unmount } = render(<SyncStatusPanel isOpen={true} onClose={mockOnClose} />);
      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });
});
