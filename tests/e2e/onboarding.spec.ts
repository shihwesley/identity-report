import { test, expect, Page } from '@playwright/test'

/**
 * E2E tests for the Onboarding flow
 *
 * Tests cover:
 * - Initial welcome screen
 * - Creating a new vault with mnemonic generation
 * - Restoring vault from recovery phrase
 * - Password setup and validation
 * - Completion and navigation to dashboard
 * - Mobile responsive behavior
 */

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/onboarding')
  })

  test.describe('Welcome Screen', () => {
    test('displays welcome screen with branding', async ({ page }) => {
      // Check page title and branding
      await expect(page.getByText('Profile Vault')).toBeVisible()
      await expect(page.getByText('Your portable AI conversation identity')).toBeVisible()

      // Check welcome message
      await expect(page.getByText('Welcome')).toBeVisible()
      await expect(page.getByText(/Create a secure vault/)).toBeVisible()
    })

    test('shows both create and restore options', async ({ page }) => {
      const createButton = page.getByRole('button', { name: /Create New Vault/i })
      const restoreButton = page.getByRole('button', { name: /Restore from Recovery Phrase/i })

      await expect(createButton).toBeVisible()
      await expect(restoreButton).toBeVisible()
      await expect(createButton).toBeEnabled()
      await expect(restoreButton).toBeEnabled()
    })

    test('displays security information', async ({ page }) => {
      await expect(page.getByText(/encrypted locally/i)).toBeVisible()
      await expect(page.getByText(/recovery phrase and password/i)).toBeVisible()
    })
  })

  test.describe('Create New Vault Flow', () => {
    test('clicking Create New Vault shows loading state then mnemonic', async ({ page }) => {
      const createButton = page.getByRole('button', { name: /Create New Vault/i })
      await createButton.click()

      // Wait for mnemonic generation
      await expect(page.getByText('Save Your Recovery Phrase')).toBeVisible({ timeout: 5000 })
    })

    test('displays 12-word mnemonic phrase', async ({ page }) => {
      await page.getByRole('button', { name: /Create New Vault/i }).click()

      // Wait for mnemonic display
      await expect(page.getByText('Save Your Recovery Phrase')).toBeVisible({ timeout: 5000 })

      // Check that 12 words are displayed (each in its own container with index)
      const wordContainers = page.locator('.grid.grid-cols-3 > div')
      await expect(wordContainers).toHaveCount(12)

      // Verify word indices 1-12 are shown
      for (let i = 1; i <= 12; i++) {
        await expect(page.getByText(`${i}.`)).toBeVisible()
      }
    })

    test('shows warning about not sharing recovery phrase', async ({ page }) => {
      await page.getByRole('button', { name: /Create New Vault/i }).click()
      await expect(page.getByText('Save Your Recovery Phrase')).toBeVisible({ timeout: 5000 })

      await expect(page.getByText(/Never share this phrase/i)).toBeVisible()
      await expect(page.getByText(/access your vault/i)).toBeVisible()
    })

    test('confirmation button proceeds to password step', async ({ page }) => {
      await page.getByRole('button', { name: /Create New Vault/i }).click()
      await expect(page.getByText('Save Your Recovery Phrase')).toBeVisible({ timeout: 5000 })

      const confirmButton = page.getByRole('button', { name: /I've Saved My Recovery Phrase/i })
      await confirmButton.click()

      await expect(page.getByText('Set Your Password')).toBeVisible()
    })
  })

  test.describe('Restore Flow', () => {
    test('clicking Restore shows recovery phrase input', async ({ page }) => {
      await page.getByRole('button', { name: /Restore from Recovery Phrase/i }).click()

      await expect(page.getByText('Enter Recovery Phrase')).toBeVisible()
      await expect(page.getByText('12-word recovery phrase')).toBeVisible()
    })

    test('displays textarea for mnemonic input', async ({ page }) => {
      await page.getByRole('button', { name: /Restore from Recovery Phrase/i }).click()

      const textarea = page.getByPlaceholder(/word1 word2/i)
      await expect(textarea).toBeVisible()
      await expect(textarea).toBeEditable()
    })

    test('back button returns to welcome screen', async ({ page }) => {
      await page.getByRole('button', { name: /Restore from Recovery Phrase/i }).click()
      await expect(page.getByText('Enter Recovery Phrase')).toBeVisible()

      await page.getByRole('button', { name: /Back/i }).click()
      await expect(page.getByText('Welcome')).toBeVisible()
    })

    test('continue button is disabled when textarea is empty', async ({ page }) => {
      await page.getByRole('button', { name: /Restore from Recovery Phrase/i }).click()

      const continueButton = page.getByRole('button', { name: /Continue/i })
      await expect(continueButton).toBeDisabled()
    })

    test('continue button is enabled when mnemonic is entered', async ({ page }) => {
      await page.getByRole('button', { name: /Restore from Recovery Phrase/i }).click()

      const textarea = page.getByPlaceholder(/word1 word2/i)
      await textarea.fill('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')

      const continueButton = page.getByRole('button', { name: /Continue/i })
      await expect(continueButton).toBeEnabled()
    })

    test('shows error for invalid mnemonic', async ({ page }) => {
      await page.getByRole('button', { name: /Restore from Recovery Phrase/i }).click()

      const textarea = page.getByPlaceholder(/word1 word2/i)
      await textarea.fill('invalid invalid invalid invalid invalid invalid invalid invalid invalid invalid invalid invalid')

      await page.getByRole('button', { name: /Continue/i }).click()

      // Wait for validation error
      await expect(page.getByText(/Invalid recovery phrase/i)).toBeVisible({ timeout: 5000 })
    })

    test('valid mnemonic proceeds to password step', async ({ page }) => {
      await page.getByRole('button', { name: /Restore from Recovery Phrase/i }).click()

      const textarea = page.getByPlaceholder(/word1 word2/i)
      await textarea.fill('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')

      await page.getByRole('button', { name: /Continue/i }).click()

      await expect(page.getByText('Set Your Password')).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Password Setup', () => {
    async function navigateToPasswordStep(page: Page) {
      await page.getByRole('button', { name: /Create New Vault/i }).click()
      await expect(page.getByText('Save Your Recovery Phrase')).toBeVisible({ timeout: 5000 })
      await page.getByRole('button', { name: /I've Saved My Recovery Phrase/i }).click()
      await expect(page.getByText('Set Your Password')).toBeVisible()
    }

    test('displays password form with both fields', async ({ page }) => {
      await navigateToPasswordStep(page)

      await expect(page.getByLabel(/^Password$/i)).toBeVisible()
      await expect(page.getByLabel(/Confirm Password/i)).toBeVisible()
      await expect(page.getByPlaceholder(/At least 8 characters/i)).toBeVisible()
    })

    test('Create Vault button is disabled when passwords are empty', async ({ page }) => {
      await navigateToPasswordStep(page)

      const createButton = page.getByRole('button', { name: /Create Vault/i })
      await expect(createButton).toBeDisabled()
    })

    test('Create Vault button is disabled when only password is filled', async ({ page }) => {
      await navigateToPasswordStep(page)

      await page.getByPlaceholder(/At least 8 characters/i).fill('password123')

      const createButton = page.getByRole('button', { name: /Create Vault/i })
      await expect(createButton).toBeDisabled()
    })

    test('shows error for password less than 8 characters', async ({ page }) => {
      await navigateToPasswordStep(page)

      await page.getByPlaceholder(/At least 8 characters/i).fill('short')
      await page.getByPlaceholder(/Confirm your password/i).fill('short')

      await page.getByRole('button', { name: /Create Vault/i }).click()

      await expect(page.getByText(/at least 8 characters/i)).toBeVisible()
    })

    test('shows error when passwords do not match', async ({ page }) => {
      await navigateToPasswordStep(page)

      await page.getByPlaceholder(/At least 8 characters/i).fill('password123')
      await page.getByPlaceholder(/Confirm your password/i).fill('different456')

      await page.getByRole('button', { name: /Create Vault/i }).click()

      await expect(page.getByText(/Passwords do not match/i)).toBeVisible()
    })

    test('valid password proceeds to completion screen', async ({ page }) => {
      await navigateToPasswordStep(page)

      await page.getByPlaceholder(/At least 8 characters/i).fill('securepass123')
      await page.getByPlaceholder(/Confirm your password/i).fill('securepass123')

      await page.getByRole('button', { name: /Create Vault/i }).click()

      // Wait for vault creation
      await expect(page.getByText('Vault Created!')).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Completion Screen', () => {
    async function navigateToCompletion(page: Page) {
      await page.getByRole('button', { name: /Create New Vault/i }).click()
      await expect(page.getByText('Save Your Recovery Phrase')).toBeVisible({ timeout: 5000 })
      await page.getByRole('button', { name: /I've Saved My Recovery Phrase/i }).click()
      await expect(page.getByText('Set Your Password')).toBeVisible()
      await page.getByPlaceholder(/At least 8 characters/i).fill('securepass123')
      await page.getByPlaceholder(/Confirm your password/i).fill('securepass123')
      await page.getByRole('button', { name: /Create Vault/i }).click()
      await expect(page.getByText('Vault Created!')).toBeVisible({ timeout: 10000 })
    }

    test('displays success message and DID', async ({ page }) => {
      await navigateToCompletion(page)

      await expect(page.getByText('Vault Created!')).toBeVisible()
      await expect(page.getByText(/Your Profile Vault is ready/i)).toBeVisible()
      await expect(page.getByText(/DID.*Decentralized ID/i)).toBeVisible()
      await expect(page.getByText(/did:key:z/i)).toBeVisible()
    })

    test('Go to Dashboard button navigates home', async ({ page }) => {
      await navigateToCompletion(page)

      await page.getByRole('button', { name: /Go to Dashboard/i }).click()

      await expect(page).toHaveURL('/')
    })
  })

  test.describe('Mobile Responsive', () => {
    test.use({ viewport: { width: 375, height: 667 } })

    test('welcome screen is usable on mobile', async ({ page }) => {
      await expect(page.getByText('Profile Vault')).toBeVisible()
      await expect(page.getByRole('button', { name: /Create New Vault/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Restore from Recovery Phrase/i })).toBeVisible()
    })

    test('mnemonic display is readable on mobile', async ({ page }) => {
      await page.getByRole('button', { name: /Create New Vault/i }).click()
      await expect(page.getByText('Save Your Recovery Phrase')).toBeVisible({ timeout: 5000 })

      // Verify mnemonic grid is visible
      const wordContainers = page.locator('.grid.grid-cols-3 > div')
      await expect(wordContainers.first()).toBeVisible()
    })

    test('password form works on mobile', async ({ page }) => {
      await page.getByRole('button', { name: /Create New Vault/i }).click()
      await expect(page.getByText('Save Your Recovery Phrase')).toBeVisible({ timeout: 5000 })
      await page.getByRole('button', { name: /I've Saved My Recovery Phrase/i }).click()

      const passwordInput = page.getByPlaceholder(/At least 8 characters/i)
      await expect(passwordInput).toBeVisible()
      await passwordInput.tap()
      await passwordInput.fill('mobilepassword123')
    })
  })

  test.describe('Error States', () => {
    test('handles mnemonic generation failure gracefully', async ({ page }) => {
      // Mock the import to fail
      await page.route('**/vault/identity*', (route) => {
        route.abort()
      })

      await page.getByRole('button', { name: /Create New Vault/i }).click()

      // Check error handling
      await expect(page.getByText(/Failed to generate wallet/i)).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Full User Journey', () => {
    test('complete vault creation journey', async ({ page }) => {
      // Start at welcome
      await expect(page.getByText('Welcome')).toBeVisible()

      // Create new vault
      await page.getByRole('button', { name: /Create New Vault/i }).click()
      await expect(page.getByText('Save Your Recovery Phrase')).toBeVisible({ timeout: 5000 })

      // Capture mnemonic words for verification
      const wordContainers = page.locator('.grid.grid-cols-3 > div .font-mono')
      const words: string[] = []
      for (let i = 0; i < 12; i++) {
        const word = await wordContainers.nth(i).textContent()
        if (word) words.push(word)
      }
      expect(words).toHaveLength(12)

      // Confirm mnemonic saved
      await page.getByRole('button', { name: /I've Saved My Recovery Phrase/i }).click()
      await expect(page.getByText('Set Your Password')).toBeVisible()

      // Set password
      await page.getByPlaceholder(/At least 8 characters/i).fill('mysecurepassword')
      await page.getByPlaceholder(/Confirm your password/i).fill('mysecurepassword')
      await page.getByRole('button', { name: /Create Vault/i }).click()

      // Verify completion
      await expect(page.getByText('Vault Created!')).toBeVisible({ timeout: 10000 })

      // Navigate to dashboard
      await page.getByRole('button', { name: /Go to Dashboard/i }).click()
      await expect(page).toHaveURL('/')
    })

    test('complete vault restore journey', async ({ page }) => {
      const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

      // Start at welcome
      await expect(page.getByText('Welcome')).toBeVisible()

      // Click restore
      await page.getByRole('button', { name: /Restore from Recovery Phrase/i }).click()
      await expect(page.getByText('Enter Recovery Phrase')).toBeVisible()

      // Enter mnemonic
      await page.getByPlaceholder(/word1 word2/i).fill(testMnemonic)
      await page.getByRole('button', { name: /Continue/i }).click()

      // Set password
      await expect(page.getByText('Set Your Password')).toBeVisible({ timeout: 5000 })
      await page.getByPlaceholder(/At least 8 characters/i).fill('restoredpassword')
      await page.getByPlaceholder(/Confirm your password/i).fill('restoredpassword')
      await page.getByRole('button', { name: /Create Vault/i }).click()

      // Verify completion
      await expect(page.getByText('Vault Created!')).toBeVisible({ timeout: 10000 })
    })
  })
})
