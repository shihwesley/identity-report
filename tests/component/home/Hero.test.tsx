import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { Hero } from '@/components/home/Hero'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}))

describe('Hero Component', () => {
  describe('Content', () => {
    it('renders headline "Own Your AI Context"', () => {
      render(<Hero />)
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Own Your.*AI Context/i)
    })

    it('renders tagline about encrypted, portable, under control', () => {
      render(<Hero />)
      expect(screen.getByText(/encrypted.*portable.*under your control/i)).toBeInTheDocument()
    })

    it('renders badge "Privacy-First AI Context"', () => {
      render(<Hero />)
      expect(screen.getByText('Privacy-First AI Context')).toBeInTheDocument()
    })
  })

  describe('CTAs', () => {
    it('renders Get Started CTA button', () => {
      render(<Hero />)
      expect(screen.getByRole('link', { name: /Get Started/i })).toBeInTheDocument()
    })

    it('Get Started links to /signup', () => {
      render(<Hero />)
      const ctaLink = screen.getByRole('link', { name: /Get Started/i })
      expect(ctaLink).toHaveAttribute('href', '/signup')
    })

    it('renders Learn More button', () => {
      render(<Hero />)
      expect(screen.getByRole('button', { name: /Learn More/i })).toBeInTheDocument()
    })

    it('Learn More scrolls to features section on click', async () => {
      const user = userEvent.setup()
      const scrollIntoViewMock = vi.fn()
      const mockElement = document.createElement('div')
      mockElement.scrollIntoView = scrollIntoViewMock
      const getElementByIdSpy = vi.spyOn(document, 'getElementById').mockReturnValue(mockElement)

      render(<Hero />)
      const learnMoreBtn = screen.getByRole('button', { name: /Learn More/i })
      await user.click(learnMoreBtn)

      expect(document.getElementById).toHaveBeenCalledWith('features')
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' })

      getElementByIdSpy.mockRestore()
    })
  })

  describe('Visual Elements', () => {
    it('has gradient/blur background decorative elements', () => {
      const { container } = render(<Hero />)
      // Check for blur-3xl classes on decorative elements
      const blurElements = container.querySelectorAll('.blur-3xl')
      expect(blurElements.length).toBeGreaterThanOrEqual(1)
    })

    it('renders hero visual with glass-panel styling', () => {
      const { container } = render(<Hero />)
      expect(container.querySelector('.glass-panel')).toBeInTheDocument()
    })

    it('renders Identity Vault card', () => {
      render(<Hero />)
      expect(screen.getByText('Your Identity Vault')).toBeInTheDocument()
      expect(screen.getByText(/Encrypted.*Portable.*Yours/i)).toBeInTheDocument()
    })

    it('renders secure status indicator', () => {
      render(<Hero />)
      expect(screen.getByText('Secure')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<Hero />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
