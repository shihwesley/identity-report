import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { axe } from 'vitest-axe'
import { OAuthButtons } from '@/components/auth/OAuthButtons'

const mockSignIn = vi.fn()

vi.mock('next-auth/react', () => ({
  signIn: (provider: string, options: Record<string, unknown>) => mockSignIn(provider, options)
}))

describe('OAuthButtons', () => {
  beforeEach(() => {
    mockSignIn.mockClear()
    mockSignIn.mockResolvedValue(undefined)
  })

  it('renders Google and GitHub buttons', () => {
    render(<OAuthButtons />)

    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /github/i })).toBeInTheDocument()
  })

  it('calls signIn with google provider on Google click', async () => {
    const user = userEvent.setup()
    render(<OAuthButtons />)

    await user.click(screen.getByRole('button', { name: /google/i }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledOnce()
      expect(mockSignIn).toHaveBeenCalledWith('google', { callbackUrl: '/onboarding?email=true' })
    })
  })

  it('calls signIn with github provider on GitHub click', async () => {
    const user = userEvent.setup()
    render(<OAuthButtons />)

    await user.click(screen.getByRole('button', { name: /github/i }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledOnce()
      expect(mockSignIn).toHaveBeenCalledWith('github', { callbackUrl: '/onboarding?email=true' })
    })
  })

  it('disables buttons while loading', async () => {
    const user = userEvent.setup()
    // Keep signIn pending to maintain loading state
    mockSignIn.mockImplementation(() => new Promise(() => {}))

    render(<OAuthButtons />)

    const googleButton = screen.getByRole('button', { name: /google/i })
    const githubButton = screen.getByRole('button', { name: /github/i })

    // Initially enabled
    expect(googleButton).not.toBeDisabled()
    expect(githubButton).not.toBeDisabled()

    // Click to trigger loading
    await user.click(googleButton)

    // Both buttons disabled during loading
    await waitFor(() => {
      expect(googleButton).toBeDisabled()
      expect(githubButton).toBeDisabled()
    })
  })

  it('shows spinner for clicked provider during loading', async () => {
    const user = userEvent.setup()
    mockSignIn.mockImplementation(() => new Promise(() => {}))

    render(<OAuthButtons />)

    const googleButton = screen.getByRole('button', { name: /google/i })
    await user.click(googleButton)

    // Google button shows spinner (animated div), GitHub shows icon
    await waitFor(() => {
      const spinner = googleButton.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<OAuthButtons />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
