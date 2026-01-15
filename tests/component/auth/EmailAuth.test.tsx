import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { EmailAuth } from '@/components/auth/EmailAuth'

// Mock OAuthButtons to isolate EmailAuth testing
vi.mock('@/components/auth/OAuthButtons', () => ({
  OAuthButtons: () => <div data-testid="oauth-buttons">OAuth Buttons</div>
}))

describe('EmailAuth', () => {
  it('renders email and password inputs', () => {
    render(<EmailAuth />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument()
  })

  it('shows error when submitting empty form', async () => {
    const user = userEvent.setup()
    render(<EmailAuth />)

    const submitButton = screen.getByRole('button', { name: 'Sign In' })
    await user.click(submitButton)

    expect(screen.getByText('Please fill in all fields')).toBeInTheDocument()
  })

  it('shows error when submitting with only email', async () => {
    const user = userEvent.setup()
    render(<EmailAuth />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(screen.getByText('Please fill in all fields')).toBeInTheDocument()
  })

  it('shows error when submitting with only password', async () => {
    const user = userEvent.setup()
    render(<EmailAuth />)

    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(screen.getByText('Please fill in all fields')).toBeInTheDocument()
  })

  it('calls onSubmit with email and password when valid', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<EmailAuth onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith('test@example.com', 'secret123')
  })

  it('clears error on successful submission', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<EmailAuth onSubmit={onSubmit} />)

    // First, trigger error
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(screen.getByText('Please fill in all fields')).toBeInTheDocument()

    // Then fill form and submit
    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(screen.queryByText('Please fill in all fields')).not.toBeInTheDocument()
  })

  it('disables button when isLoading=true', () => {
    render(<EmailAuth isLoading={true} />)

    const submitButton = screen.getByRole('button', { name: /signing in/i })
    expect(submitButton).toBeDisabled()
  })

  it('shows spinner when loading', () => {
    render(<EmailAuth isLoading={true} />)

    expect(screen.getByText('Signing in...')).toBeInTheDocument()
    // Loader2 icon from lucide-react renders as SVG with animate-spin class
    const button = screen.getByRole('button')
    expect(button.querySelector('svg')).toBeInTheDocument()
  })

  it('shows "Sign In" text when not loading', () => {
    render(<EmailAuth isLoading={false} />)

    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
  })

  it('does not call onSubmit when not provided', async () => {
    const user = userEvent.setup()
    render(<EmailAuth />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')

    // Should not throw when onSubmit is undefined
    await expect(
      user.click(screen.getByRole('button', { name: 'Sign In' }))
    ).resolves.not.toThrow()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<EmailAuth />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('has no accessibility violations when loading', async () => {
    const { container } = render(<EmailAuth isLoading={true} />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('has no accessibility violations with error displayed', async () => {
    const user = userEvent.setup()
    const { container } = render(<EmailAuth />)

    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
