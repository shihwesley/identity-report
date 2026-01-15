/**
 * PublicLayout Component Tests
 *
 * Tests for the public layout component used on landing/auth pages
 * with full-width layout (no sidebar), glass nav bar, and footer.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { axe } from 'vitest-axe';

// ============================================================
// Mocks
// ============================================================

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

const TEST_CHILDREN = <div data-testid="test-children">Test Content</div>;

// ============================================================
// PublicLayout Component Tests
// ============================================================

describe('PublicLayout', () => {
  describe('Logo/Brand', () => {
    it('renders logo in navigation', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      // Shield icon for logo
      const logo = document.querySelector('.lucide-shield');
      expect(logo).toBeInTheDocument();
    });

    it('renders "Identity Report" title', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      // Title appears in both nav and footer; check nav specifically
      const navTitle = screen.getAllByText('Identity Report')[0];
      expect(navTitle).toBeInTheDocument();
      expect(navTitle).toHaveClass('text-lg');
    });

    it('logo links to home page', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      const brandLink = screen.getByRole('link', { name: /Identity Report/i });
      expect(brandLink).toHaveAttribute('href', '/');
    });
  });

  describe('Navigation Links', () => {
    it('renders Sign In link to /signin', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      const signInLink = screen.getByRole('link', { name: /Sign In/i });
      expect(signInLink).toBeInTheDocument();
      expect(signInLink).toHaveAttribute('href', '/signin');
    });

    it('renders Get Started link to /signup', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      const getStartedLink = screen.getByRole('link', { name: /Get Started/i });
      expect(getStartedLink).toBeInTheDocument();
      expect(getStartedLink).toHaveAttribute('href', '/signup');
    });

    it('Get Started button has primary styling', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      const getStartedLink = screen.getByRole('link', { name: /Get Started/i });
      expect(getStartedLink).toHaveClass('bg-primary');
      expect(getStartedLink).toHaveClass('text-white');
    });
  });

  describe('Children Rendering', () => {
    it('renders children content', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      expect(screen.getByTestId('test-children')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders children inside main element', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      const main = screen.getByRole('main');
      expect(within(main).getByTestId('test-children')).toBeInTheDocument();
    });

    it('renders multiple children', () => {
      render(
        <PublicLayout>
          <div data-testid="child-1">First</div>
          <div data-testid="child-2">Second</div>
        </PublicLayout>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });
  });

  describe('Navigation Bar Styling', () => {
    it('has fixed positioning', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      const nav = document.querySelector('nav');
      expect(nav).toHaveClass('fixed');
      expect(nav).toHaveClass('top-0');
      expect(nav).toHaveClass('left-0');
      expect(nav).toHaveClass('right-0');
    });

    it('has high z-index for overlay', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      const nav = document.querySelector('nav');
      expect(nav).toHaveClass('z-50');
    });
  });

  describe('No Sidebar (Unlike DashboardShell)', () => {
    it('has no sidebar/aside element', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      const aside = document.querySelector('aside');
      expect(aside).not.toBeInTheDocument();
    });

    it('has no complementary role element', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      const complementary = screen.queryByRole('complementary');
      expect(complementary).not.toBeInTheDocument();
    });

    it('main content is full width (no left margin for sidebar)', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      const main = screen.getByRole('main');
      // Should not have ml-64 or similar margin that indicates sidebar offset
      expect(main).not.toHaveClass('ml-64');
    });
  });

  describe('Footer', () => {
    it('renders footer element', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      const footer = document.querySelector('footer');
      expect(footer).toBeInTheDocument();
    });

    it('footer contains Identity Report branding', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      const footer = document.querySelector('footer');
      expect(within(footer!).getByText('Identity Report')).toBeInTheDocument();
    });

    it('footer contains tagline', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      expect(screen.getByText(/Own your AI context/i)).toBeInTheDocument();
    });
  });

  describe('Visual Structure', () => {
    it('has min-height screen', () => {
      const { container } = render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('min-h-screen');
    });

    it('main has padding-top for fixed nav', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      const main = screen.getByRole('main');
      expect(main).toHaveClass('pt-20');
    });

    it('has mesh-gradient background', () => {
      const { container } = render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('mesh-gradient');
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('uses nav element for navigation', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      const nav = document.querySelector('nav');
      expect(nav).toBeInTheDocument();
    });

    it('uses main element for content', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('uses footer element for footer', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      const footer = document.querySelector('footer');
      expect(footer).toBeInTheDocument();
    });

    it('all navigation links are keyboard focusable', () => {
      render(<PublicLayout>{TEST_CHILDREN}</PublicLayout>);

      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link).not.toHaveAttribute('tabindex', '-1');
      });
    });
  });
});
