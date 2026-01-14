import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { axe } from 'vitest-axe'
import { Features } from '@/components/home/Features'

describe('Features Component', () => {
  describe('Feature Cards', () => {
    it('renders all three feature cards', () => {
      render(<Features />)

      expect(screen.getByText('Works with Any AI')).toBeInTheDocument()
      expect(screen.getByText('Persistent Memory')).toBeInTheDocument()
      expect(screen.getByText('Import Everything')).toBeInTheDocument()
    })

    it('renders "Works with Any AI" description mentioning providers', () => {
      render(<Features />)
      expect(screen.getByText(/Claude.*ChatGPT.*Gemini.*MCP protocol/i)).toBeInTheDocument()
    })

    it('renders "Persistent Memory" description about remembering preferences', () => {
      render(<Features />)
      expect(screen.getByText(/remembers your preferences.*projects.*history/i)).toBeInTheDocument()
    })

    it('renders "Import Everything" description mentioning OpenAI, Anthropic, Google', () => {
      render(<Features />)
      expect(screen.getByText(/OpenAI.*Anthropic.*Google/i)).toBeInTheDocument()
    })
  })

  describe('Feature Icons', () => {
    it('renders Lucide icons for each feature', () => {
      const { container } = render(<Features />)
      // Lucide icons render as SVG elements
      const svgIcons = container.querySelectorAll('svg')
      expect(svgIcons.length).toBe(3)
    })
  })

  describe('Styling', () => {
    it('applies glass-card styling to feature cards', () => {
      const { container } = render(<Features />)
      const glassCards = container.querySelectorAll('.glass-card')
      expect(glassCards.length).toBe(3)
    })

    it('renders section header with title', () => {
      render(<Features />)
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Your AI, Your Rules')
    })

    it('renders section description', () => {
      render(<Features />)
      expect(screen.getByText(/portable.*encrypted identity/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<Features />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
