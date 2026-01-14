import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { MnemonicAuth } from '@/components/auth/MnemonicAuth'

const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('MnemonicAuth', () => {
  it('renders mnemonic textarea and password input', () => {
    render(<MnemonicAuth />)

    expect(screen.getByLabelText(/recovery phrase/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/vault password/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/12-word recovery phrase/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/enter your vault password/i)).toBeInTheDocument()
  })

  it('shows error when mnemonic has fewer than 12 words', async () => {
    const user = userEvent.setup()
    render(<MnemonicAuth />)

    await user.type(screen.getByLabelText(/recovery phrase/i), 'abandon abandon abandon')
    await user.type(screen.getByLabelText(/vault password/i), 'testpassword')
    await user.click(screen.getByRole('button', { name: /unlock vault/i }))

    expect(screen.getByText('Please enter all 12 words of your recovery phrase')).toBeInTheDocument()
  })

  it('shows error when mnemonic is empty', async () => {
    const user = userEvent.setup()
    render(<MnemonicAuth />)

    await user.type(screen.getByLabelText(/vault password/i), 'testpassword')
    await user.click(screen.getByRole('button', { name: /unlock vault/i }))

    expect(screen.getByText('Please enter all 12 words of your recovery phrase')).toBeInTheDocument()
  })

  it('shows error when password is empty', async () => {
    const user = userEvent.setup()
    render(<MnemonicAuth />)

    await user.type(screen.getByLabelText(/recovery phrase/i), TEST_MNEMONIC)
    await user.click(screen.getByRole('button', { name: /unlock vault/i }))

    expect(screen.getByText('Please enter your vault password')).toBeInTheDocument()
  })

  it('calls onSubmit with mnemonic and password when valid', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<MnemonicAuth onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/recovery phrase/i), TEST_MNEMONIC)
    await user.type(screen.getByLabelText(/vault password/i), 'testpassword')
    await user.click(screen.getByRole('button', { name: /unlock vault/i }))

    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith(TEST_MNEMONIC, 'testpassword')
  })

  it('trims whitespace from mnemonic before validation and submission', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<MnemonicAuth onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/recovery phrase/i), `  ${TEST_MNEMONIC}  `)
    await user.type(screen.getByLabelText(/vault password/i), 'testpassword')
    await user.click(screen.getByRole('button', { name: /unlock vault/i }))

    expect(onSubmit).toHaveBeenCalledWith(TEST_MNEMONIC, 'testpassword')
  })

  it('clears error on successful submission', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<MnemonicAuth onSubmit={onSubmit} />)

    // First, trigger error
    await user.click(screen.getByRole('button', { name: /unlock vault/i }))
    expect(screen.getByText('Please enter all 12 words of your recovery phrase')).toBeInTheDocument()

    // Then fill form and submit
    await user.type(screen.getByLabelText(/recovery phrase/i), TEST_MNEMONIC)
    await user.type(screen.getByLabelText(/vault password/i), 'testpassword')
    await user.click(screen.getByRole('button', { name: /unlock vault/i }))

    expect(screen.queryByText('Please enter all 12 words of your recovery phrase')).not.toBeInTheDocument()
  })

  it('disables button when isLoading=true', () => {
    render(<MnemonicAuth isLoading={true} />)

    const submitButton = screen.getByRole('button', { name: /unlocking vault/i })
    expect(submitButton).toBeDisabled()
  })

  it('shows spinner when loading', () => {
    render(<MnemonicAuth isLoading={true} />)

    expect(screen.getByText('Unlocking Vault...')).toBeInTheDocument()
    const button = screen.getByRole('button')
    expect(button.querySelector('svg')).toBeInTheDocument()
  })

  it('shows "Unlock Vault" text when not loading', () => {
    render(<MnemonicAuth isLoading={false} />)

    expect(screen.getByRole('button', { name: 'Unlock Vault' })).toBeInTheDocument()
  })

  it('does not call onSubmit when not provided', async () => {
    const user = userEvent.setup()
    render(<MnemonicAuth />)

    await user.type(screen.getByLabelText(/recovery phrase/i), TEST_MNEMONIC)
    await user.type(screen.getByLabelText(/vault password/i), 'testpassword')

    // Should not throw when onSubmit is undefined
    await expect(
      user.click(screen.getByRole('button', { name: /unlock vault/i }))
    ).resolves.not.toThrow()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<MnemonicAuth />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('has no accessibility violations when loading', async () => {
    const { container } = render(<MnemonicAuth isLoading={true} />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('has no accessibility violations with error displayed', async () => {
    const user = userEvent.setup()
    const { container } = render(<MnemonicAuth />)

    await user.click(screen.getByRole('button', { name: /unlock vault/i }))

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
