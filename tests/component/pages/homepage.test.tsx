/**
 * Homepage Page Component Tests
 *
 * Tests for the public homepage that composes Hero, Features, and CTASection components.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import HomePage from '@/app/(public)/page';

// ============================================================
// Mocks
// ============================================================

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock Hero component
vi.mock('@/components/home/Hero', () => ({
  Hero: () => (
    <section data-testid="hero-section">
      <h1>Own Your AI Context</h1>
      <p>Your conversations, memories, and insights</p>
      <a href="/signup">Get Started</a>
    </section>
  ),
}));

// Mock Features component
vi.mock('@/components/home/Features', () => ({
  Features: () => (
    <section data-testid="features-section" id="features">
      <h2>Your AI, Your Rules</h2>
      <div>Works with Any AI</div>
      <div>Persistent Memory</div>
      <div>Import Everything</div>
    </section>
  ),
}));

// Mock CTASection component
vi.mock('@/components/home/CTASection', () => ({
  CTASection: () => (
    <section data-testid="cta-section">
      <h2>Ready to own your AI identity?</h2>
      <a href="/signup">Create Your Vault</a>
      <a href="/signin">Already have an account? Sign In</a>
    </section>
  ),
}));

// ============================================================
// Homepage Tests
// ============================================================

describe('HomePage', () => {
  describe('Hero Section', () => {
    it('renders Hero section', () => {
      render(<HomePage />);

      expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    });

    it('displays headline visible', () => {
      render(<HomePage />);

      expect(screen.getByRole('heading', { name: /Own Your AI Context/i })).toBeInTheDocument();
    });
  });

  describe('Features Section', () => {
    it('renders Features section', () => {
      render(<HomePage />);

      expect(screen.getByTestId('features-section')).toBeInTheDocument();
    });

    it('displays features heading', () => {
      render(<HomePage />);

      expect(screen.getByRole('heading', { name: /Your AI, Your Rules/i })).toBeInTheDocument();
    });
  });

  describe('CTA Section', () => {
    it('renders CTA section', () => {
      render(<HomePage />);

      expect(screen.getByTestId('cta-section')).toBeInTheDocument();
    });

    it('displays CTA heading', () => {
      render(<HomePage />);

      expect(screen.getByRole('heading', { name: /Ready to own your AI identity/i })).toBeInTheDocument();
    });
  });

  describe('Page Composition', () => {
    it('renders all three sections in correct order', () => {
      const { container } = render(<HomePage />);

      const sections = container.querySelectorAll('section');
      expect(sections).toHaveLength(3);

      // Verify order by testids
      expect(sections[0]).toHaveAttribute('data-testid', 'hero-section');
      expect(sections[1]).toHaveAttribute('data-testid', 'features-section');
      expect(sections[2]).toHaveAttribute('data-testid', 'cta-section');
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<HomePage />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
