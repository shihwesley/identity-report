/**
 * Sidebar Component Tests
 *
 * Tests for the navigation sidebar component that displays
 * the main application navigation and user profile section.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from '@/components/Sidebar';
import { axe } from 'vitest-axe';

// ============================================================
// Mocks
// ============================================================

// Mock next/navigation
const mockUsePathname = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

// Mock next/link to use regular anchor for testing
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// ============================================================
// Test Data
// ============================================================

const NAV_ITEMS = [
  { label: 'Command Center', href: '/', icon: 'grid' },
  { label: 'Profile Editor', href: '/profile', icon: 'user' },
  { label: 'Memory Graph', href: '/memory', icon: 'network' },
  { label: 'Active Chat', href: '/chat', icon: 'message-circle' },
  { label: 'Import Data', href: '/import', icon: 'upload' },
  { label: 'MCP Connect', href: '/connect', icon: 'plug' },
];

// ============================================================
// Sidebar Component Tests
// ============================================================

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/');
  });

  describe('Structure', () => {
    it('renders the sidebar container', () => {
      render(<Sidebar />);

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toBeInTheDocument();
    });

    it('has fixed positioning', () => {
      render(<Sidebar />);

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveClass('fixed');
      expect(sidebar).toHaveClass('left-0');
      expect(sidebar).toHaveClass('top-0');
    });

    it('has full height', () => {
      render(<Sidebar />);

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveClass('h-screen');
    });

    it('has appropriate width', () => {
      render(<Sidebar />);

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveClass('w-64');
    });
  });

  describe('Header', () => {
    it('displays the application title and version', () => {
      render(<Sidebar />);
      expect(screen.getByText('Identity')).toBeInTheDocument();
      expect(screen.getByText(/Report v2.0/)).toBeInTheDocument();
    });

    it('displays the logo icon', () => {
      render(<Sidebar />);
      // Logo is now a Shield icon inside a gradient box
      const logo = document.querySelector('.lucide-shield');
      expect(logo).toBeInTheDocument();
    });

    it('renders title as part of brand link', () => {
      render(<Sidebar />);
      const brandLink = screen.getByRole('link', { name: /Identity Report v2.0/i });
      expect(brandLink).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('renders all navigation items', () => {
      render(<Sidebar />);

      NAV_ITEMS.forEach(({ label }) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it('renders navigation links with correct hrefs', () => {
      render(<Sidebar />);

      NAV_ITEMS.forEach(({ label, href }) => {
        const link = screen.getByText(label).closest('a');
        expect(link).toHaveAttribute('href', href);
      });
    });

    it('renders navigation as a nav element', () => {
      render(<Sidebar />);

      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
    });

    it('contains all navigation links in the nav element', () => {
      render(<Sidebar />);

      const nav = screen.getByRole('navigation');
      NAV_ITEMS.forEach(({ label }) => {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Icons', () => {
    it('displays Command Center icon', () => {
      render(<Sidebar />);
      const commandCenterLink = screen.getByText('Command Center').closest('a');
      expect(within(commandCenterLink!).getByTestId('icon-grid')).toBeInTheDocument();
    });

    it('displays Profile Editor icon', () => {
      render(<Sidebar />);
      const profileLink = screen.getByText('Profile Editor').closest('a');
      expect(within(profileLink!).getByTestId('icon-user')).toBeInTheDocument();
    });

    it('displays Memory Graph icon', () => {
      render(<Sidebar />);
      const memoryLink = screen.getByText('Memory Graph').closest('a');
      expect(within(memoryLink!).getByTestId('icon-network')).toBeInTheDocument();
    });

    it('displays Active Chat icon', () => {
      render(<Sidebar />);
      const chatLink = screen.getByText('Active Chat').closest('a');
      expect(within(chatLink!).getByTestId('icon-message-circle')).toBeInTheDocument();
    });

    it('displays Import Data icon', () => {
      render(<Sidebar />);
      const importLink = screen.getByText('Import Data').closest('a');
      expect(within(importLink!).getByTestId('icon-upload')).toBeInTheDocument();
    });

    it('displays MCP Connect icon', () => {
      render(<Sidebar />);
      const mcpLink = screen.getByText('MCP Connect').closest('a');
      expect(within(mcpLink!).getByTestId('icon-plug')).toBeInTheDocument();
    });
  });

  describe('Active State', () => {
    it('highlights Command Center when on root path', () => {
      mockUsePathname.mockReturnValue('/');
      render(<Sidebar />);

      const commandCenterLink = screen.getByText('Command Center').closest('a');
      expect(commandCenterLink).toHaveClass('bg-primary/10');
      expect(commandCenterLink).toHaveClass('text-primary');
    });

    it('highlights Profile Editor when on /profile path', () => {
      mockUsePathname.mockReturnValue('/profile');
      render(<Sidebar />);

      const profileLink = screen.getByText('Profile Editor').closest('a');
      expect(profileLink).toHaveClass('bg-primary/10');
    });

    it('highlights Memory Graph when on /memory path', () => {
      mockUsePathname.mockReturnValue('/memory');
      render(<Sidebar />);

      const memoryLink = screen.getByText('Memory Graph').closest('a');
      expect(memoryLink).toHaveClass('bg-primary/10');
    });

    it('highlights Active Chat when on /chat path', () => {
      mockUsePathname.mockReturnValue('/chat');
      render(<Sidebar />);

      const chatLink = screen.getByText('Active Chat').closest('a');
      expect(chatLink).toHaveClass('bg-primary/10');
    });

    it('highlights Import Data when on /import path', () => {
      mockUsePathname.mockReturnValue('/import');
      render(<Sidebar />);

      const importLink = screen.getByText('Import Data').closest('a');
      expect(importLink).toHaveClass('bg-primary/10');
    });

    it('highlights MCP Connect when on /connect path', () => {
      mockUsePathname.mockReturnValue('/connect');
      render(<Sidebar />);

      const mcpLink = screen.getByText('MCP Connect').closest('a');
      expect(mcpLink).toHaveClass('bg-primary/10');
    });

    it('does not highlight inactive items', () => {
      mockUsePathname.mockReturnValue('/profile');
      render(<Sidebar />);

      const commandCenterLink = screen.getByText('Command Center').closest('a');
      expect(commandCenterLink).not.toHaveClass('bg-primary/10');
      expect(commandCenterLink).toHaveClass('text-stone-500');
    });

    it('only one item is active at a time', () => {
      mockUsePathname.mockReturnValue('/memory');
      render(<Sidebar />);

      const allLinks = screen.getAllByRole('link');
      const activeLinks = allLinks.filter((link) =>
        link.classList.contains('bg-primary/10')
      );

      expect(activeLinks).toHaveLength(1);
    });
  });

  describe('User Profile Section', () => {
    it('displays user initials', () => {
      render(<Sidebar />);

      expect(screen.getByText('QS')).toBeInTheDocument();
    });

    it('displays username', () => {
      render(<Sidebar />);

      expect(screen.getByText('QuarterShot')).toBeInTheDocument();
    });

    it('displays plan type', () => {
      render(<Sidebar />);

      expect(screen.getByText('Pro Plan')).toBeInTheDocument();
    });

    it('renders avatar with styling', () => {
      const { container } = render(<Sidebar />);

      const avatar = container.querySelector('.w-10.h-10.rounded-full');
      expect(avatar).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('has border on the right side', () => {
      render(<Sidebar />);

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveClass('border-r');
    });

    it('has high z-index for overlay behavior', () => {
      render(<Sidebar />);

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveClass('z-50');
    });

    it('has flex column layout', () => {
      render(<Sidebar />);

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveClass('flex');
      expect(sidebar).toHaveClass('flex-col');
    });

    it('nav items have transition effects', () => {
      render(<Sidebar />);

      const nav = screen.getByRole('navigation');
      const links = within(nav).getAllByRole('link');
      links.forEach((link) => {
        expect(link).toHaveClass('transition-all');
      });
    });

    it('nav items have rounded corners', () => {
      render(<Sidebar />);

      const nav = screen.getByRole('navigation');
      const links = within(nav).getAllByRole('link');
      links.forEach((link) => {
        expect(link).toHaveClass('rounded-xl');
      });
    });
  });

  describe('Responsive Design', () => {
    it('uses stone and primary theme classes', () => {
      render(<Sidebar />);

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveClass('border-stone-200/50');
      expect(sidebar).toHaveClass('bg-white/70');
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<Sidebar />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('uses aside element for semantic meaning', () => {
      render(<Sidebar />);

      const sidebar = document.querySelector('aside');
      expect(sidebar).toBeInTheDocument();
    });

    it('uses nav element for navigation', () => {
      render(<Sidebar />);

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('all navigation items are links', () => {
      render(<Sidebar />);

      NAV_ITEMS.forEach(({ label }) => {
        const element = screen.getByText(label);
        expect(element.closest('a')).toBeInTheDocument();
      });
    });

    it('links are keyboard focusable', () => {
      render(<Sidebar />);

      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link).not.toHaveAttribute('tabindex', '-1');
      });
    });
  });

  describe('Path Matching', () => {
    it('handles exact path matching', () => {
      mockUsePathname.mockReturnValue('/');
      render(<Sidebar />);

      const commandCenterLink = screen.getByText('Command Center').closest('a');
      expect(commandCenterLink).toHaveClass('bg-primary/10');
    });

    it('does not match partial paths', () => {
      mockUsePathname.mockReturnValue('/profile/settings');
      render(<Sidebar />);

      // /profile/settings should not match /profile exactly
      const profileLink = screen.getByText('Profile Editor').closest('a');
      expect(profileLink).not.toHaveClass('bg-[#1E90FF]/10');
    });

    it('handles unknown paths gracefully', () => {
      mockUsePathname.mockReturnValue('/unknown-route');
      render(<Sidebar />);

      // No items should be active
      const allLinks = screen.getAllByRole('link');
      const activeLinks = allLinks.filter((link) =>
        link.classList.contains('bg-[#1E90FF]/10')
      );

      expect(activeLinks).toHaveLength(0);
    });
  });

  describe('Link Behavior', () => {
    it('links navigate to correct pages', () => {
      render(<Sidebar />);

      expect(screen.getByText('Command Center').closest('a')).toHaveAttribute('href', '/');
      expect(screen.getByText('Profile Editor').closest('a')).toHaveAttribute('href', '/profile');
      expect(screen.getByText('Memory Graph').closest('a')).toHaveAttribute('href', '/memory');
      expect(screen.getByText('Active Chat').closest('a')).toHaveAttribute('href', '/chat');
      expect(screen.getByText('Import Data').closest('a')).toHaveAttribute('href', '/import');
      expect(screen.getByText('MCP Connect').closest('a')).toHaveAttribute('href', '/connect');
    });
  });

  describe('Visual Hierarchy', () => {
    it('footer section has top border', () => {
      const { container } = render(<Sidebar />);

      const footerSection = container.querySelector('.mt-auto');
      expect(footerSection).toBeInTheDocument();
    });

    it('nav section takes available space', () => {
      const { container } = render(<Sidebar />);

      const nav = container.querySelector('nav');
      expect(nav).toHaveClass('flex-1');
    });
  });

  describe('Icon and Label Layout', () => {
    it('icons and labels are horizontally aligned', () => {
      render(<Sidebar />);

      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link).toHaveClass('flex');
        expect(link).toHaveClass('items-center');
      });
    });

    it('has gap between icon and label container', () => {
      render(<Sidebar />);

      const nav = screen.getByRole('navigation');
      const links = within(nav).getAllByRole('link');
      links.forEach((link) => {
        const iconLabelContainer = link.querySelector('div');
        expect(iconLabelContainer).toHaveClass('gap-3');
      });
    });
  });
});
