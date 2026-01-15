import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { CTASection } from '@/components/home/CTASection'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}))

describe('CTASection Component', () => {
  describe('Content', () => {
    it('renders CTA headline "Ready to own your AI identity?"', () => {
      render(<CTASection />)
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Ready to own your AI identity?')
    })
  })

  describe('CTAs', () => {
    it('renders Create Your Vault button linking to /signup', () => {
      render(<CTASection />)
      const ctaLink = screen.getByRole('link', { name: /Create Your Vault/i })
      expect(ctaLink).toBeInTheDocument()
      expect(ctaLink).toHaveAttribute('href', '/signup')
    })

    it('renders Sign In link for existing users linking to /signin', () => {
      render(<CTASection />)
      const signInLink = screen.getByRole('link', { name: /Sign In/i })
      expect(signInLink).toBeInTheDocument()
      expect(signInLink).toHaveAttribute('href', '/signin')
    })
  })

  describe('Visual Elements', () => {
    it('has gradient styling on primary CTA', () => {
      render(<CTASection />)
      const ctaLink = screen.getByRole('link', { name: /Create Your Vault/i })
      // Primary CTA has bg-primary with shadow-primary/25 for gradient effect
      expect(ctaLink).toHaveClass('bg-primary')
      expect(ctaLink).toHaveClass('shadow-xl')
      expect(ctaLink).toHaveClass('shadow-primary/25')
    })
  })

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<CTASection />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
