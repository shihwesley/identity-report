/**
 * ConflictResolution Component Tests
 *
 * Tests for the conflict resolution UI that allows users to resolve
 * sync conflicts with local, remote, or custom merge options.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConflictResolution, SyncStatus, TabAuthorityIndicator } from '@/components/dashboard/ConflictResolution';
import { Conflict, ConflictEntityType, Resolution } from '@/lib/sync/types';
import { MemoryFragment, UserInsight } from '@/lib/types';
import { MOCK_PROFILES, SYNC_SCENARIOS } from '../../fixtures/test-vectors';

// ============================================================
// Test Utilities
// ============================================================

function createMockConflict(
  type: ConflictEntityType,
  id: string = 'conflict-1',
  options: Partial<Conflict> = {}
): Conflict {
  // Create type-appropriate default versions
  const defaultVersions: Record<ConflictEntityType, { local: unknown; remote: unknown }> = {
    memory: {
      local: { content: 'Local content', tags: ['local'], type: 'technical' },
      remote: { content: 'Remote content', tags: ['remote'], type: 'technical' }
    },
    conversation: {
      local: { title: 'Local convo', messages: [] },
      remote: { title: 'Remote convo', messages: [] }
    },
    insight: {
      local: { content: 'Local insight', confidence: 0.8 },
      remote: { content: 'Remote insight', confidence: 0.9 }
    },
    preference: {
      local: { key: 'theme', value: 'dark' },
      remote: { key: 'theme', value: 'light' }
    },
    project: {
      local: { name: 'Local project' },
      remote: { name: 'Remote project' }
    },
    identity: {
      local: { displayName: 'Local name' },
      remote: { displayName: 'Remote name' }
    }
  };

  const versions = defaultVersions[type] || { local: {}, remote: {} };

  const baseConflict: Conflict = {
    id,
    type,
    entityId: `entity-${id}`,
    localVersion: versions.local,
    remoteVersion: versions.remote,
    autoMergeable: false,
    conflictingFields: ['content'],
    localModifiedAt: Date.now() - 1000,
    remoteModifiedAt: Date.now(),
    ...options,
  };

  return baseConflict;
}

function createMemoryConflict(id: string = 'memory-conflict-1'): Conflict {
  const localMemory: MemoryFragment = {
    id: 'mem-1',
    timestamp: new Date().toISOString(),
    content: 'Local memory content',
    tags: ['local', 'test'],
    type: 'technical',
    sourceModel: 'claude-3',
    sourceProvider: 'anthropic',
    confidence: 0.9,
  };

  const remoteMemory: MemoryFragment = {
    id: 'mem-1',
    timestamp: new Date().toISOString(),
    content: 'Remote memory content',
    tags: ['remote', 'test'],
    type: 'technical',
    sourceModel: 'claude-3',
    sourceProvider: 'anthropic',
    confidence: 0.85,
  };

  return createMockConflict('memory', id, {
    localVersion: localMemory,
    remoteVersion: remoteMemory,
    conflictingFields: ['content', 'tags'],
  });
}

function createInsightConflict(id: string = 'insight-conflict-1'): Conflict {
  const localInsight: UserInsight = {
    id: 'insight-1',
    category: 'preference',
    content: 'User prefers functional programming',
    confidence: 0.85,
    derivedFrom: ['conv-1'],
    createdAt: Date.now() - 1000,
    updatedAt: Date.now() - 1000,
  };

  const remoteInsight: UserInsight = {
    id: 'insight-1',
    category: 'preference',
    content: 'User prefers object-oriented programming',
    confidence: 0.78,
    derivedFrom: ['conv-1', 'conv-2'],
    createdAt: Date.now() - 1000,
    updatedAt: Date.now(),
  };

  return createMockConflict('insight', id, {
    localVersion: localInsight,
    remoteVersion: remoteInsight,
    conflictingFields: ['content', 'confidence'],
  });
}

// ============================================================
// ConflictResolution Component Tests
// ============================================================

describe('ConflictResolution', () => {
  const mockOnResolve = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the conflict resolution modal with header', () => {
      const conflicts = [createMemoryConflict()];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Resolve Sync Conflicts')).toBeInTheDocument();
      expect(screen.getByText('0 of 1 conflicts resolved')).toBeInTheDocument();
    });

    it('displays progress bar based on resolved conflicts', () => {
      const conflicts = [createMemoryConflict('1'), createMemoryConflict('2')];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('0 of 2 conflicts resolved')).toBeInTheDocument();
    });

    it('renders all conflict cards', () => {
      const conflicts = [
        createMemoryConflict('memory-1'),
        createInsightConflict('insight-1'),
      ];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('memory Conflict')).toBeInTheDocument();
      expect(screen.getByText('insight Conflict')).toBeInTheDocument();
    });

    it('displays conflicting fields for each conflict', () => {
      const conflicts = [createMemoryConflict()];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Fields: content, tags')).toBeInTheDocument();
    });

    it('shows correct icons for different conflict types', () => {
      const conflicts = [
        createMockConflict('memory', '1'),
        createMockConflict('conversation', '2'),
        createMockConflict('insight', '3'),
        createMockConflict('preference', '4'),
      ];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      // Check that all conflict types are rendered
      expect(screen.getByText('memory Conflict')).toBeInTheDocument();
      expect(screen.getByText('conversation Conflict')).toBeInTheDocument();
      expect(screen.getByText('insight Conflict')).toBeInTheDocument();
      expect(screen.getByText('preference Conflict')).toBeInTheDocument();
    });
  });

  describe('Resolution Actions', () => {
    it('allows selecting local version', async () => {
      const user = userEvent.setup();
      const conflicts = [createMemoryConflict()];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      const localButton = screen.getByRole('button', { name: /Local Version/i });
      await user.click(localButton);

      expect(screen.getByText('1 of 1 conflicts resolved')).toBeInTheDocument();
    });

    it('allows selecting remote version', async () => {
      const user = userEvent.setup();
      const conflicts = [createMemoryConflict()];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      const remoteButton = screen.getByRole('button', { name: /Remote Version/i });
      await user.click(remoteButton);

      expect(screen.getByText('1 of 1 conflicts resolved')).toBeInTheDocument();
    });

    it('shows resolved badge after selecting a version', async () => {
      const user = userEvent.setup();
      const conflicts = [createMemoryConflict()];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      const localButton = screen.getByRole('button', { name: /Local Version/i });
      await user.click(localButton);

      expect(screen.getByText('Resolved: local')).toBeInTheDocument();
    });

    it('allows changing resolution choice', async () => {
      const user = userEvent.setup();
      const conflicts = [createMemoryConflict()];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      // First select local
      const localButton = screen.getByRole('button', { name: /Local Version/i });
      await user.click(localButton);
      expect(screen.getByText('Resolved: local')).toBeInTheDocument();

      // Then change to remote
      const remoteButton = screen.getByRole('button', { name: /Remote Version/i });
      await user.click(remoteButton);
      expect(screen.getByText('Resolved: remote')).toBeInTheDocument();
    });
  });

  describe('Edit & Merge Mode', () => {
    it('shows Edit & Merge button for unresolved conflicts', () => {
      const conflicts = [createMemoryConflict()];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('button', { name: /Edit & Merge/i })).toBeInTheDocument();
    });

    it('enters edit mode when Edit & Merge is clicked', async () => {
      const user = userEvent.setup();
      const conflicts = [createMemoryConflict()];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit & Merge/i });
      await user.click(editButton);

      expect(screen.getByText('Base version to edit:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Local' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remote' })).toBeInTheDocument();
    });

    it('allows switching between local and remote base in edit mode', async () => {
      const user = userEvent.setup();
      const conflicts = [createMemoryConflict()];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit & Merge/i });
      await user.click(editButton);

      const remoteBaseButton = screen.getByRole('button', { name: 'Remote' });
      await user.click(remoteBaseButton);

      // Verify remote button is now selected (has different styling)
      expect(remoteBaseButton).toHaveClass('bg-blue-600');
    });

    it('allows canceling edit mode', async () => {
      const user = userEvent.setup();
      const conflicts = [createMemoryConflict()];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit & Merge/i });
      await user.click(editButton);

      // Wait for edit mode to appear
      expect(screen.getByText('Base version to edit:')).toBeInTheDocument();

      // Find all Cancel buttons - the inner one is the last one within the edit area
      const cancelButtons = screen.getAllByRole('button', { name: /Cancel/i });
      // The edit mode cancel button should be the one with specific styling (text-zinc-400)
      const innerCancelButton = cancelButtons.find(btn =>
        btn.className.includes('text-zinc-400') && btn.className.includes('hover:text-white')
      ) || cancelButtons[cancelButtons.length - 1];

      await user.click(innerCancelButton);

      // Wait for state to update
      await waitFor(() => {
        expect(screen.queryByText('Base version to edit:')).not.toBeInTheDocument();
      });
    });

    it('allows applying custom resolution', async () => {
      const user = userEvent.setup();
      const conflicts = [createMemoryConflict()];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit & Merge/i });
      await user.click(editButton);

      // Modify content - there are multiple textboxes, get the first one (content textarea)
      const textboxes = screen.getAllByRole('textbox');
      const contentTextarea = textboxes[0];
      await user.clear(contentTextarea);
      await user.type(contentTextarea, 'Custom merged content');

      const applyButton = screen.getByRole('button', { name: /Apply Custom/i });
      await user.click(applyButton);

      expect(screen.getByText('Resolved: custom')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('disables Apply Resolutions button when not all conflicts resolved', () => {
      const conflicts = [createMemoryConflict('1'), createMemoryConflict('2')];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      const applyButton = screen.getByRole('button', { name: /Apply Resolutions \(0\/2\)/i });
      expect(applyButton).toBeDisabled();
    });

    it('enables Apply Resolutions button when all conflicts resolved', async () => {
      const user = userEvent.setup();
      const conflicts = [createMemoryConflict()];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      const localButton = screen.getByRole('button', { name: /Local Version/i });
      await user.click(localButton);

      const applyButton = screen.getByRole('button', { name: /Apply Resolutions \(1\/1\)/i });
      expect(applyButton).not.toBeDisabled();
    });

    it('calls onResolve with all resolutions when submitted', async () => {
      const user = userEvent.setup();
      const conflicts = [createMemoryConflict()];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      const localButton = screen.getByRole('button', { name: /Local Version/i });
      await user.click(localButton);

      const applyButton = screen.getByRole('button', { name: /Apply Resolutions/i });
      await user.click(applyButton);

      expect(mockOnResolve).toHaveBeenCalledTimes(1);
      expect(mockOnResolve).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            conflictId: 'memory-conflict-1',
            choice: 'local',
            resolvedBy: 'user',
          }),
        ])
      );
    });

    it('calls onCancel when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      const conflicts = [createMemoryConflict()];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getAllByRole('button', { name: /Cancel/i })[0];
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multiple Conflicts', () => {
    it('tracks resolution progress correctly for multiple conflicts', async () => {
      const user = userEvent.setup();
      const conflicts = [
        createMemoryConflict('1'),
        createMemoryConflict('2'),
        createMemoryConflict('3'),
      ];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('0 of 3 conflicts resolved')).toBeInTheDocument();

      // Resolve first conflict
      const localButtons = screen.getAllByRole('button', { name: /Local Version/i });
      await user.click(localButtons[0]);
      expect(screen.getByText('1 of 3 conflicts resolved')).toBeInTheDocument();

      // Resolve second conflict
      await user.click(localButtons[1]);
      expect(screen.getByText('2 of 3 conflicts resolved')).toBeInTheDocument();

      // Resolve third conflict
      await user.click(localButtons[2]);
      expect(screen.getByText('3 of 3 conflicts resolved')).toBeInTheDocument();
    });

    it('includes all resolutions in final submission', async () => {
      const user = userEvent.setup();
      const conflicts = [
        createMemoryConflict('1'),
        createMemoryConflict('2'),
      ];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      // Resolve first as local, second as remote
      const localButtons = screen.getAllByRole('button', { name: /Local Version/i });
      const remoteButtons = screen.getAllByRole('button', { name: /Remote Version/i });

      await user.click(localButtons[0]);
      await user.click(remoteButtons[1]);

      const applyButton = screen.getByRole('button', { name: /Apply Resolutions/i });
      await user.click(applyButton);

      expect(mockOnResolve).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ conflictId: '1', choice: 'local' }),
          expect.objectContaining({ conflictId: '2', choice: 'remote' }),
        ])
      );
    });
  });

  describe('Memory Content Display', () => {
    it('displays memory content preview in version cards', () => {
      const conflicts = [createMemoryConflict()];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Local memory content')).toBeInTheDocument();
      expect(screen.getByText('Remote memory content')).toBeInTheDocument();
    });

    it('displays memory tags in version cards', () => {
      const conflicts = [createMemoryConflict()];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('local')).toBeInTheDocument();
      expect(screen.getByText('remote')).toBeInTheDocument();
    });
  });

  describe('Insight Content Display', () => {
    it('displays insight content and confidence in version cards', () => {
      const conflicts = [createInsightConflict()];
      render(
        <ConflictResolution
          conflicts={conflicts}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('User prefers functional programming')).toBeInTheDocument();
      expect(screen.getByText('User prefers object-oriented programming')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 85%')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 78%')).toBeInTheDocument();
    });
  });
});

// ============================================================
// SyncStatus Component Tests
// ============================================================

describe('SyncStatus', () => {
  const mockOnResolveConflicts = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Status Display', () => {
    it('displays idle status correctly', () => {
      const lastSyncedAt = Date.now();
      render(
        <SyncStatus
          status="idle"
          pendingConflicts={0}
          lastSyncedAt={lastSyncedAt}
        />
      );

      expect(screen.getByText('Synced')).toBeInTheDocument();
    });

    it('displays syncing status correctly', () => {
      render(
        <SyncStatus
          status="syncing"
          pendingConflicts={0}
          lastSyncedAt={null}
        />
      );

      expect(screen.getByText('Syncing...')).toBeInTheDocument();
    });

    it('displays conflict status with count', () => {
      render(
        <SyncStatus
          status="conflict"
          pendingConflicts={3}
          lastSyncedAt={null}
          onResolveConflicts={mockOnResolveConflicts}
        />
      );

      expect(screen.getByText('3 conflicts')).toBeInTheDocument();
    });

    it('displays singular conflict text for one conflict', () => {
      render(
        <SyncStatus
          status="conflict"
          pendingConflicts={1}
          lastSyncedAt={null}
          onResolveConflicts={mockOnResolveConflicts}
        />
      );

      expect(screen.getByText('1 conflict')).toBeInTheDocument();
    });

    it('displays error status correctly', () => {
      render(
        <SyncStatus
          status="error"
          pendingConflicts={0}
          lastSyncedAt={null}
        />
      );

      expect(screen.getByText('Sync error')).toBeInTheDocument();
    });

    it('displays offline status correctly', () => {
      render(
        <SyncStatus
          status="offline"
          pendingConflicts={0}
          lastSyncedAt={null}
        />
      );

      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  describe('Resolve Button', () => {
    it('shows Resolve button when there are conflicts and handler provided', () => {
      render(
        <SyncStatus
          status="conflict"
          pendingConflicts={2}
          lastSyncedAt={null}
          onResolveConflicts={mockOnResolveConflicts}
        />
      );

      expect(screen.getByRole('button', { name: /Resolve/i })).toBeInTheDocument();
    });

    it('does not show Resolve button when no conflicts', () => {
      render(
        <SyncStatus
          status="idle"
          pendingConflicts={0}
          lastSyncedAt={Date.now()}
          onResolveConflicts={mockOnResolveConflicts}
        />
      );

      expect(screen.queryByRole('button', { name: /Resolve/i })).not.toBeInTheDocument();
    });

    it('does not show Resolve button when no handler provided', () => {
      render(
        <SyncStatus
          status="conflict"
          pendingConflicts={2}
          lastSyncedAt={null}
        />
      );

      expect(screen.queryByRole('button', { name: /Resolve/i })).not.toBeInTheDocument();
    });

    it('calls onResolveConflicts when Resolve button clicked', async () => {
      const user = userEvent.setup();
      render(
        <SyncStatus
          status="conflict"
          pendingConflicts={2}
          lastSyncedAt={null}
          onResolveConflicts={mockOnResolveConflicts}
        />
      );

      const resolveButton = screen.getByRole('button', { name: /Resolve/i });
      await user.click(resolveButton);

      expect(mockOnResolveConflicts).toHaveBeenCalledTimes(1);
    });
  });

  describe('Last Synced Time', () => {
    it('shows last synced time when idle and timestamp provided', () => {
      const timestamp = new Date('2024-01-15T10:30:00').getTime();
      render(
        <SyncStatus
          status="idle"
          pendingConflicts={0}
          lastSyncedAt={timestamp}
        />
      );

      // Check that time is displayed (format depends on locale)
      expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
    });

    it('does not show last synced time when syncing', () => {
      const timestamp = Date.now();
      render(
        <SyncStatus
          status="syncing"
          pendingConflicts={0}
          lastSyncedAt={timestamp}
        />
      );

      // Should show syncing status, not the time
      expect(screen.getByText('Syncing...')).toBeInTheDocument();
    });
  });
});

// ============================================================
// TabAuthorityIndicator Component Tests
// ============================================================

describe('TabAuthorityIndicator', () => {
  describe('Visibility', () => {
    it('does not render when only one tab is open', () => {
      const { container } = render(
        <TabAuthorityIndicator hasAuthority={true} tabCount={1} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders when multiple tabs are open', () => {
      render(<TabAuthorityIndicator hasAuthority={true} tabCount={2} />);

      expect(screen.getByText('Write access')).toBeInTheDocument();
    });
  });

  describe('Authority Display', () => {
    it('shows Write access when has authority', () => {
      render(<TabAuthorityIndicator hasAuthority={true} tabCount={3} />);

      expect(screen.getByText('Write access')).toBeInTheDocument();
    });

    it('shows Read only when no authority', () => {
      render(<TabAuthorityIndicator hasAuthority={false} tabCount={3} />);

      expect(screen.getByText('Read only')).toBeInTheDocument();
    });

    it('displays tab count', () => {
      render(<TabAuthorityIndicator hasAuthority={true} tabCount={5} />);

      expect(screen.getByText('(5 tabs)')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('has green styling when has authority', () => {
      render(<TabAuthorityIndicator hasAuthority={true} tabCount={2} />);

      const container = screen.getByText('Write access').closest('div');
      expect(container).toHaveClass('bg-emerald-900/50');
    });

    it('has neutral styling when no authority', () => {
      render(<TabAuthorityIndicator hasAuthority={false} tabCount={2} />);

      const container = screen.getByText('Read only').closest('div');
      expect(container).toHaveClass('bg-zinc-800');
    });
  });
});
