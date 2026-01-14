import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { axe } from 'vitest-axe'
import { WalletAuth } from '@/components/auth/WalletAuth'

describe('WalletAuth', () => {
  beforeEach(() => {
    // Reset window.ethereum before each test
    // @ts-expect-error - mocking ethereum
    delete window.ethereum
  })

  it('renders MetaMask and Coinbase wallet buttons', () => {
    render(<WalletAuth />)

    expect(screen.getByRole('button', { name: /metamask/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /coinbase wallet/i })).toBeInTheDocument()
    expect(screen.getByText('🦊')).toBeInTheDocument()
    expect(screen.getByText('💼')).toBeInTheDocument()
  })

  it('shows error when no wallet detected', async () => {
    const user = userEvent.setup()
    render(<WalletAuth />)

    await user.click(screen.getByRole('button', { name: /metamask/i }))

    expect(
      screen.getByText('No wallet detected. Please install MetaMask or Coinbase Wallet.')
    ).toBeInTheDocument()
  })

  it('connects wallet and calls onConnect with address', async () => {
    const mockAddress = '0x1234567890abcdef1234567890abcdef12345678'
    // @ts-expect-error - mocking ethereum
    window.ethereum = {
      request: vi.fn().mockResolvedValue([mockAddress])
    }

    const user = userEvent.setup()
    const onConnect = vi.fn()
    render(<WalletAuth onConnect={onConnect} />)

    await user.click(screen.getByRole('button', { name: /metamask/i }))

    await waitFor(() => {
      expect(onConnect).toHaveBeenCalledOnce()
      expect(onConnect).toHaveBeenCalledWith(mockAddress)
    })

    // @ts-expect-error - accessing mock
    expect(window.ethereum.request).toHaveBeenCalledWith({
      method: 'eth_requestAccounts'
    })
  })

  it('shows spinner while connecting', async () => {
    // Create a promise that doesn't resolve immediately
    let resolveRequest: (value: string[]) => void
    const pendingPromise = new Promise<string[]>(resolve => {
      resolveRequest = resolve
    })

    // @ts-expect-error - mocking ethereum
    window.ethereum = {
      request: vi.fn().mockReturnValue(pendingPromise)
    }

    const user = userEvent.setup()
    render(<WalletAuth />)

    await user.click(screen.getByRole('button', { name: /metamask/i }))

    // Spinner should be visible (animate-spin class on the div)
    const metamaskButton = screen.getByRole('button', { name: /metamask/i })
    expect(metamaskButton.querySelector('.animate-spin')).toBeInTheDocument()

    // Resolve to cleanup
    resolveRequest!(['0x1234'])
  })

  it('disables all buttons while connecting', async () => {
    let resolveRequest: (value: string[]) => void
    const pendingPromise = new Promise<string[]>(resolve => {
      resolveRequest = resolve
    })

    // @ts-expect-error - mocking ethereum
    window.ethereum = {
      request: vi.fn().mockReturnValue(pendingPromise)
    }

    const user = userEvent.setup()
    render(<WalletAuth />)

    await user.click(screen.getByRole('button', { name: /metamask/i }))

    // Both buttons should be disabled
    const metamaskButton = screen.getByRole('button', { name: /metamask/i })
    const coinbaseButton = screen.getByRole('button', { name: /coinbase wallet/i })

    expect(metamaskButton).toBeDisabled()
    expect(coinbaseButton).toBeDisabled()

    // Resolve to cleanup
    resolveRequest!(['0x1234'])
  })

  it('shows error on connection failure', async () => {
    // @ts-expect-error - mocking ethereum
    window.ethereum = {
      request: vi.fn().mockRejectedValue(new Error('User rejected'))
    }

    const user = userEvent.setup()
    render(<WalletAuth />)

    await user.click(screen.getByRole('button', { name: /metamask/i }))

    await waitFor(() => {
      expect(
        screen.getByText('Failed to connect wallet. Please try again.')
      ).toBeInTheDocument()
    })
  })

  it('re-enables buttons after connection failure', async () => {
    // @ts-expect-error - mocking ethereum
    window.ethereum = {
      request: vi.fn().mockRejectedValue(new Error('User rejected'))
    }

    const user = userEvent.setup()
    render(<WalletAuth />)

    await user.click(screen.getByRole('button', { name: /metamask/i }))

    await waitFor(() => {
      const metamaskButton = screen.getByRole('button', { name: /metamask/i })
      const coinbaseButton = screen.getByRole('button', { name: /coinbase wallet/i })

      expect(metamaskButton).not.toBeDisabled()
      expect(coinbaseButton).not.toBeDisabled()
    })
  })

  it('works without onConnect callback', async () => {
    const mockAddress = '0x1234567890abcdef1234567890abcdef12345678'
    // @ts-expect-error - mocking ethereum
    window.ethereum = {
      request: vi.fn().mockResolvedValue([mockAddress])
    }

    const user = userEvent.setup()
    render(<WalletAuth />)

    // Should not throw when onConnect is undefined
    await expect(
      user.click(screen.getByRole('button', { name: /metamask/i }))
    ).resolves.not.toThrow()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<WalletAuth />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('has no accessibility violations with error displayed', async () => {
    const user = userEvent.setup()
    const { container } = render(<WalletAuth />)

    await user.click(screen.getByRole('button', { name: /metamask/i }))

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
