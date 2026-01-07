/**
 * IdentityCard Component Tests
 *
 * Tests for the identity card that displays user profile information
 * including display name, DID, memories, and permissions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IdentityCard } from '@/components/dashboard/IdentityCard';
import { PortableProfile, VaultStatus } from '@/lib/types';
import { MOCK_PROFILES } from '../../fixtures/test-vectors';

// ============================================================
// Test Utilities
// ============================================================

function createMockProfile(overrides: Partial<PortableProfile> = {}): PortableProfile {
  return {
    identity: {
      displayName: 'Test User',
      fullName: 'Test User Full Name',
      email: 'test@example.com',
      location: 'San Francisco',
      role: 'Developer',
    },
    preferences: [],
    shortTermMemory: [],
    longTermMemory: [],
    projects: [],
    conversations: [],
    insights: [],
    activeGrants: [],
    ...overrides,
  };
}

// ============================================================
// IdentityCard Component Tests
// ============================================================

describe('IdentityCard', () => {
  describe('Locked State', () => {
    it('shows vault locked message when profile is null', () => {
      render(
        <IdentityCard
          profile={null}
          did={null}
          status="locked"
        />
      );

      expect(screen.getByText('Vault Locked')).toBeInTheDocument();
      expect(screen.getByText('Identity encryption keys are not active.')).toBeInTheDocument();
    });

    it('has appropriate styling for locked state', () => {
      const { container } = render(
        <IdentityCard
          profile={null}
          did={null}
          status="locked"
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('border-red-200');
    });

    it('does not show profile information when locked', () => {
      render(
        <IdentityCard
          profile={null}
          did={null}
          status="locked"
        />
      );

      expect(screen.queryByText('Verified')).not.toBeInTheDocument();
      expect(screen.queryByText('Memories')).not.toBeInTheDocument();
    });
  });

  describe('Unlocked State with Profile', () => {
    const mockProfile = createMockProfile();
    const mockDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';

    it('displays user display name', () => {
      render(
        <IdentityCard
          profile={mockProfile}
          did={mockDid}
          status="unlocked"
        />
      );

      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('displays verified badge', () => {
      render(
        <IdentityCard
          profile={mockProfile}
          did={mockDid}
          status="unlocked"
        />
      );

      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('displays DID', () => {
      render(
        <IdentityCard
          profile={mockProfile}
          did={mockDid}
          status="unlocked"
        />
      );

      expect(screen.getByText(mockDid)).toBeInTheDocument();
    });

    it('displays initials avatar', () => {
      render(
        <IdentityCard
          profile={mockProfile}
          did={mockDid}
          status="unlocked"
        />
      );

      // "Test User" should generate "TU"
      expect(screen.getByText('TU')).toBeInTheDocument();
    });

    it('generates correct initials for single word name', () => {
      const singleNameProfile = createMockProfile({
        identity: {
          ...mockProfile.identity,
          displayName: 'Alice',
        },
      });

      render(
        <IdentityCard
          profile={singleNameProfile}
          did={mockDid}
          status="unlocked"
        />
      );

      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('limits initials to two characters', () => {
      const longNameProfile = createMockProfile({
        identity: {
          ...mockProfile.identity,
          displayName: 'Alice Bob Charlie',
        },
      });

      render(
        <IdentityCard
          profile={longNameProfile}
          did={mockDid}
          status="unlocked"
        />
      );

      expect(screen.getByText('AB')).toBeInTheDocument();
    });
  });

  describe('Memory Count', () => {
    const mockDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';

    it('displays zero memories when arrays are empty', () => {
      const profile = createMockProfile();

      render(
        <IdentityCard
          profile={profile}
          did={mockDid}
          status="unlocked"
        />
      );

      expect(screen.getByText('Memories')).toBeInTheDocument();
      // There are multiple '0' values on the page, verify at least one exists
      const zeroElements = screen.getAllByText('0');
      expect(zeroElements.length).toBeGreaterThan(0);
    });

    it('counts short-term memories', () => {
      const profile = createMockProfile({
        shortTermMemory: [
          {
            id: 'mem-1',
            timestamp: new Date().toISOString(),
            content: 'Memory 1',
            tags: [],
            type: 'technical',
            sourceModel: 'claude-3',
            sourceProvider: 'anthropic',
            confidence: 0.9,
          },
          {
            id: 'mem-2',
            timestamp: new Date().toISOString(),
            content: 'Memory 2',
            tags: [],
            type: 'personal',
            sourceModel: 'claude-3',
            sourceProvider: 'anthropic',
            confidence: 0.85,
          },
        ],
      });

      render(
        <IdentityCard
          profile={profile}
          did={mockDid}
          status="unlocked"
        />
      );

      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('counts long-term memories', () => {
      const profile = createMockProfile({
        longTermMemory: [
          {
            id: 'mem-long-1',
            timestamp: new Date().toISOString(),
            content: 'Long-term memory 1',
            tags: [],
            type: 'fact',
            sourceModel: 'claude-3',
            sourceProvider: 'anthropic',
            confidence: 0.95,
          },
        ],
      });

      render(
        <IdentityCard
          profile={profile}
          did={mockDid}
          status="unlocked"
        />
      );

      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('combines short-term and long-term memory counts', () => {
      const profile = createMockProfile({
        shortTermMemory: [
          {
            id: 'mem-1',
            timestamp: new Date().toISOString(),
            content: 'Short-term',
            tags: [],
            type: 'technical',
            sourceModel: 'claude-3',
            sourceProvider: 'anthropic',
            confidence: 0.9,
          },
        ],
        longTermMemory: [
          {
            id: 'mem-long-1',
            timestamp: new Date().toISOString(),
            content: 'Long-term',
            tags: [],
            type: 'fact',
            sourceModel: 'claude-3',
            sourceProvider: 'anthropic',
            confidence: 0.95,
          },
          {
            id: 'mem-long-2',
            timestamp: new Date().toISOString(),
            content: 'Long-term 2',
            tags: [],
            type: 'preference',
            sourceModel: 'claude-3',
            sourceProvider: 'anthropic',
            confidence: 0.88,
          },
        ],
      });

      render(
        <IdentityCard
          profile={profile}
          did={mockDid}
          status="unlocked"
        />
      );

      // 1 short-term + 2 long-term = 3
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('Permissions Count', () => {
    const mockDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';

    it('displays zero permissions when no grants', () => {
      const profile = createMockProfile();

      render(
        <IdentityCard
          profile={profile}
          did={mockDid}
          status="unlocked"
        />
      );

      expect(screen.getByText('Permissions')).toBeInTheDocument();
      // The count for both memories and permissions appears
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(1);
    });

    it('displays active grants count', () => {
      const profile = createMockProfile({
        activeGrants: [
          {
            id: 'grant-1',
            grantee: 'Claude 3',
            permissions: ['read_identity', 'read_memory'],
            expiresAt: Date.now() + 86400000,
            signature: 'sig-1',
          },
          {
            id: 'grant-2',
            grantee: 'GPT-4',
            permissions: ['read_identity'],
            expiresAt: Date.now() + 86400000,
            signature: 'sig-2',
          },
        ],
      });

      render(
        <IdentityCard
          profile={profile}
          did={mockDid}
          status="unlocked"
        />
      );

      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('Test Fixtures', () => {
    const mockDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';

    it('renders minimal profile from fixtures', () => {
      render(
        <IdentityCard
          profile={MOCK_PROFILES.minimal as unknown as PortableProfile}
          did={mockDid}
          status="unlocked"
        />
      );

      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('renders complete profile from fixtures', () => {
      render(
        <IdentityCard
          profile={MOCK_PROFILES.complete as unknown as PortableProfile}
          did={mockDid}
          status="unlocked"
        />
      );

      expect(screen.getByText('Alice Developer')).toBeInTheDocument();
      expect(screen.getByText('AD')).toBeInTheDocument();
    });

    it('shows correct memory count for complete profile', () => {
      render(
        <IdentityCard
          profile={MOCK_PROFILES.complete as unknown as PortableProfile}
          did={mockDid}
          status="unlocked"
        />
      );

      // complete profile has 1 shortTermMemory + 1 longTermMemory = 2
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('shows correct permission count for complete profile', () => {
      render(
        <IdentityCard
          profile={MOCK_PROFILES.complete as unknown as PortableProfile}
          did={mockDid}
          status="unlocked"
        />
      );

      // complete profile has 1 activeGrant
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    const mockProfile = createMockProfile();
    const mockDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';

    it('has proper container styling for unlocked state', () => {
      const { container } = render(
        <IdentityCard
          profile={mockProfile}
          did={mockDid}
          status="unlocked"
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('rounded-xl');
      expect(card).toHaveClass('border');
    });

    it('displays avatar with ring styling', () => {
      const { container } = render(
        <IdentityCard
          profile={mockProfile}
          did={mockDid}
          status="unlocked"
        />
      );

      const avatar = container.querySelector('.ring-4');
      expect(avatar).toBeInTheDocument();
    });

    it('displays DID with monospace font', () => {
      render(
        <IdentityCard
          profile={mockProfile}
          did={mockDid}
          status="unlocked"
        />
      );

      const didElement = screen.getByText(mockDid);
      expect(didElement).toHaveClass('font-mono');
    });
  });

  describe('Accessibility', () => {
    const mockProfile = createMockProfile();
    const mockDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';

    it('uses semantic heading for display name', () => {
      render(
        <IdentityCard
          profile={mockProfile}
          did={mockDid}
          status="unlocked"
        />
      );

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Test User');
    });

    it('uses semantic heading for locked state', () => {
      render(
        <IdentityCard
          profile={null}
          did={null}
          status="locked"
        />
      );

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Vault Locked');
    });
  });

  describe('Status Variations', () => {
    const mockProfile = createMockProfile();
    const mockDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';

    it('renders correctly with syncing status', () => {
      render(
        <IdentityCard
          profile={mockProfile}
          did={mockDid}
          status="syncing"
        />
      );

      // Should still show profile info when syncing
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('renders correctly with unlocked status', () => {
      render(
        <IdentityCard
          profile={mockProfile}
          did={mockDid}
          status="unlocked"
        />
      );

      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    const mockDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';

    it('handles undefined memory arrays gracefully', () => {
      const profile = {
        identity: {
          displayName: 'Test',
          fullName: 'Test',
          email: '',
          location: '',
          role: '',
        },
        preferences: [],
        shortTermMemory: undefined,
        longTermMemory: undefined,
        projects: [],
        conversations: [],
        insights: [],
        activeGrants: [],
      } as unknown as PortableProfile;

      render(
        <IdentityCard
          profile={profile}
          did={mockDid}
          status="unlocked"
        />
      );

      // Should display 0 memories (multiple '0' values may exist on the page)
      const zeroElements = screen.getAllByText('0');
      expect(zeroElements.length).toBeGreaterThan(0);
    });

    it('handles undefined activeGrants gracefully', () => {
      const profile = {
        identity: {
          displayName: 'Test',
          fullName: 'Test',
          email: '',
          location: '',
          role: '',
        },
        preferences: [],
        shortTermMemory: [],
        longTermMemory: [],
        projects: [],
        conversations: [],
        insights: [],
        activeGrants: undefined,
      } as unknown as PortableProfile;

      render(
        <IdentityCard
          profile={profile}
          did={mockDid}
          status="unlocked"
        />
      );

      // Should render without errors
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('handles empty display name', () => {
      const profile = createMockProfile({
        identity: {
          displayName: '',
          fullName: '',
          email: '',
          location: '',
          role: '',
        },
      });

      render(
        <IdentityCard
          profile={profile}
          did={mockDid}
          status="unlocked"
        />
      );

      // Should render without crashing
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });
  });
});
