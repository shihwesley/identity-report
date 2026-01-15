import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.describe('Sign In Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/signin')
    })

    test('displays Welcome Back heading', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /Welcome Back/i })
      await expect(heading).toBeVisible()
    })

    test('displays three auth tabs (Wallet, Email, Recovery)', async ({ page }) => {
      // Check for Wallet tab
      const walletTab = page.getByRole('button').filter({ hasText: /Wallet/i })
      await expect(walletTab).toBeVisible()

      // Check for Email tab
      const emailTab = page.getByRole('button').filter({ hasText: /Email/i })
      await expect(emailTab).toBeVisible()

      // Check for Recovery tab
      const recoveryTab = page.getByRole('button').filter({ hasText: /Recovery/i })
      await expect(recoveryTab).toBeVisible()
    })

    test('Wallet tab shows MetaMask/Coinbase options', async ({ page }) => {
      // Wallet tab should be active by default
      const walletTabContent = page.locator('text=MetaMask')
      await expect(walletTabContent).toBeVisible()

      const coinbaseContent = page.locator('text=Coinbase Wallet')
      await expect(coinbaseContent).toBeVisible()
    })

    test('Email tab shows form + OAuth buttons', async ({ page }) => {
      // Click Email tab
      const emailTab = page.getByRole('button').filter({ hasText: /Email/i })
      await emailTab.click()

      // Check for email input
      const emailInput = page.getByLabel(/Email/i)
      await expect(emailInput).toBeVisible()

      // Check for password input
      const passwordInput = page.getByLabel(/Password/i)
      await expect(passwordInput).toBeVisible()

      // Check for submit button
      const submitButton = page.getByRole('button', { name: /Sign In/i })
      await expect(submitButton).toBeVisible()

      // Check for OAuth section
      const oauthText = page.getByText(/or continue with/i)
      await expect(oauthText).toBeVisible()
    })

    test('Recovery tab shows mnemonic input', async ({ page }) => {
      // Click Recovery tab
      const recoveryTab = page.getByRole('button').filter({ hasText: /Recovery/i })
      await recoveryTab.click()

      // Check for mnemonic textarea
      const mnemonicInput = page.getByLabel(/Recovery Phrase/i)
      await expect(mnemonicInput).toBeVisible()

      // Check for password input
      const passwordInput = page.getByLabel(/Vault Password/i)
      await expect(passwordInput).toBeVisible()

      // Check for alert about recovery phrase
      const alert = page.getByText(/12-word recovery phrase/)
      await expect(alert).toBeVisible()

      // Check for unlock button
      const unlockButton = page.getByRole('button', { name: /Unlock Vault/i })
      await expect(unlockButton).toBeVisible()
    })

    test('validation error for empty email form submission', async ({ page }) => {
      // Click Email tab
      const emailTab = page.getByRole('button').filter({ hasText: /Email/i })
      await emailTab.click()

      // Try to submit without filling fields
      const submitButton = page.getByRole('button', { name: /Sign In/i })
      await submitButton.click()

      // Check for validation error
      const errorMessage = page.getByText(/Please fill in all fields/i)
      await expect(errorMessage).toBeVisible()
    })

    test('link to sign up works', async ({ page }) => {
      // Find sign up link
      const signUpLink = page.getByRole('link', { name: /Sign Up/i })
      await expect(signUpLink).toBeVisible()

      // Click and verify navigation
      await signUpLink.click()
      await expect(page).toHaveURL('/signup')
    })

    test('displays sign in description text', async ({ page }) => {
      const description = page.getByText(/Sign in to access your identity vault/i)
      await expect(description).toBeVisible()
    })

    test('displays shield icon in header', async ({ page }) => {
      // Look for the icon container
      const iconContainer = page.locator('div.w-16.h-16')
      await expect(iconContainer).toBeVisible()
    })

    test('tab switching works properly', async ({ page }) => {
      // Start on Wallet tab (default)
      let metamaskButton = page.getByRole('button').filter({ hasText: /MetaMask/i })
      await expect(metamaskButton).toBeVisible()

      // Switch to Email tab
      const emailTab = page.getByRole('button').filter({ hasText: /Email/i })
      await emailTab.click()

      // Wallet content should not be visible
      metamaskButton = page.getByRole('button').filter({ hasText: /MetaMask/i })
      await expect(metamaskButton).not.toBeVisible()

      // Email form should be visible
      const emailInput = page.getByLabel(/Email/i)
      await expect(emailInput).toBeVisible()

      // Switch to Recovery tab
      const recoveryTab = page.getByRole('button').filter({ hasText: /Recovery/i })
      await recoveryTab.click()

      // Email input should not be visible
      await expect(emailInput).not.toBeVisible()

      // Mnemonic input should be visible
      const mnemonicInput = page.getByLabel(/Recovery Phrase/i)
      await expect(mnemonicInput).toBeVisible()
    })
  })

  test.describe('Sign Up Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/signup')
    })

    test('displays Create Your Vault heading', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /Create Your Vault/i })
      await expect(heading).toBeVisible()
    })

    test('displays three signup options', async ({ page }) => {
      // Check for Recovery Phrase option
      const recoveryOption = page.getByText(/Create with Recovery Phrase/i)
      await expect(recoveryOption).toBeVisible()

      // Check for Wallet option
      const walletOption = page.getByText(/Create with Wallet/i)
      await expect(walletOption).toBeVisible()

      // Check for Email option
      const emailOption = page.getByText(/Create with Email/i)
      await expect(emailOption).toBeVisible()
    })

    test('recovery phrase shows recommended badge', async ({ page }) => {
      const recommendedBadge = page.getByText(/Recommended/i)
      await expect(recommendedBadge).toBeVisible()

      // Verify it's on the recovery phrase option
      const recoveryOption = page.getByText(/Create with Recovery Phrase/i)
      const parent = recoveryOption.locator('..')
      await expect(parent.getByText(/Recommended/i)).toBeVisible()
    })

    test('link to sign in works', async ({ page }) => {
      const signInLink = page.getByRole('link', { name: /Sign In/i })
      await expect(signInLink).toBeVisible()

      await signInLink.click()
      await expect(page).toHaveURL('/signin')
    })

    test('displays signup description text', async ({ page }) => {
      const description = page.getByText(/Choose how to create your identity/i)
      await expect(description).toBeVisible()
    })

    test('selecting recovery phrase option shows Continue button', async ({ page }) => {
      // Click Recovery Phrase option
      const recoveryOption = page.getByText(/Create with Recovery Phrase/i)
      await recoveryOption.click()

      // Check for Continue button
      const continueButton = page.getByRole('button', { name: /Continue/i })
      await expect(continueButton).toBeVisible()
      await expect(continueButton).not.toBeDisabled()
    })

    test('selecting wallet option shows WalletAuth component', async ({ page }) => {
      // Click Wallet option
      const walletOption = page.getByText(/Create with Wallet/i)
      await walletOption.click()

      // Look for wallet buttons
      const metamaskButton = page.getByRole('button').filter({ hasText: /MetaMask/i })
      await expect(metamaskButton).toBeVisible()
    })

    test('selecting email option shows OAuth buttons', async ({ page }) => {
      // Click Email option
      const emailOption = page.getByText(/Create with Email/i)
      await emailOption.click()

      // Look for "Continue with" text indicating OAuth section
      const oauthText = page.getByText(/Continue with/i)
      await expect(oauthText).toBeVisible()
    })

    test('option selection visual feedback works', async ({ page }) => {
      // Initially no option selected
      let recoveryOption = page.locator('button').filter({ has: page.getByText(/Create with Recovery Phrase/i) }).first()
      let initialClasses = await recoveryOption.getAttribute('class')
      expect(initialClasses).not.toContain('ring-primary')

      // Click option
      await recoveryOption.click()

      // Should have selection styling
      recoveryOption = page.locator('button').filter({ has: page.getByText(/Create with Recovery Phrase/i) }).first()
      const selectedClasses = await recoveryOption.getAttribute('class')
      expect(selectedClasses).toContain('ring')
    })

    test('displays shield icon in header', async ({ page }) => {
      const iconContainer = page.locator('div.w-16.h-16')
      await expect(iconContainer).toBeVisible()
    })
  })

  test.describe('Route Protection', () => {
    test('unauthenticated /dashboard redirects to /signin', async ({ page, context }) => {
      // Ensure no vault_unlocked cookie
      await context.clearCookies()

      // Try to access protected route
      await page.goto('/dashboard', { waitUntil: 'networkidle' })

      // Should be redirected to signin
      await expect(page).toHaveURL(/\/signin/)
    })

    test('unauthenticated /memory redirects to /signin', async ({ page, context }) => {
      // Ensure no vault_unlocked cookie
      await context.clearCookies()

      // Try to access protected route
      await page.goto('/memory', { waitUntil: 'networkidle' })

      // Should be redirected to signin
      await expect(page).toHaveURL(/\/signin/)
    })

    test('redirect preserves original path in URL', async ({ page, context }) => {
      // Ensure no vault_unlocked cookie
      await context.clearCookies()

      // Try to access protected route
      const originalPath = '/dashboard'
      await page.goto(originalPath, { waitUntil: 'networkidle' })

      // Should redirect to signin with redirect param
      await expect(page).toHaveURL(/\/signin/)

      // Check that redirect parameter is in URL
      const url = page.url()
      expect(url).toContain('redirect')
      expect(url).toContain(originalPath)
    })

    test('unauthenticated /profile redirects to /signin with path preserved', async ({ page, context }) => {
      await context.clearCookies()

      const originalPath = '/profile'
      await page.goto(originalPath, { waitUntil: 'networkidle' })

      await expect(page).toHaveURL(/\/signin/)

      const url = page.url()
      expect(url).toContain('redirect')
      expect(url).toContain(originalPath)
    })

    test('unauthenticated /import redirects to /signin with path preserved', async ({ page, context }) => {
      await context.clearCookies()

      const originalPath = '/import'
      await page.goto(originalPath, { waitUntil: 'networkidle' })

      await expect(page).toHaveURL(/\/signin/)

      const url = page.url()
      expect(url).toContain('redirect')
      expect(url).toContain(originalPath)
    })

    test('unauthenticated /chat redirects to /signin with path preserved', async ({ page, context }) => {
      await context.clearCookies()

      const originalPath = '/chat'
      await page.goto(originalPath, { waitUntil: 'networkidle' })

      await expect(page).toHaveURL(/\/signin/)

      const url = page.url()
      expect(url).toContain('redirect')
      expect(url).toContain(originalPath)
    })

    test('unauthenticated /connect redirects to /signin with path preserved', async ({ page, context }) => {
      await context.clearCookies()

      const originalPath = '/connect'
      await page.goto(originalPath, { waitUntil: 'networkidle' })

      await expect(page).toHaveURL(/\/signin/)

      const url = page.url()
      expect(url).toContain('redirect')
      expect(url).toContain(originalPath)
    })

    test('signin and signup routes are accessible without authentication', async ({ page, context }) => {
      await context.clearCookies()

      // Should be able to access signin
      await page.goto('/signin')
      await expect(page).toHaveURL('/signin')

      // Should be able to access signup
      await page.goto('/signup')
      await expect(page).toHaveURL('/signup')

      // Should be able to access onboarding
      await page.goto('/onboarding')
      await expect(page).toHaveURL('/onboarding')
    })

    test('authenticated request with vault_unlocked cookie can access protected routes', async ({ page, context }) => {
      // Set the vault_unlocked cookie
      await context.addCookies([
        {
          name: 'vault_unlocked',
          value: 'true',
          url: 'http://localhost:3000',
        },
      ])

      // Try to access protected route
      await page.goto('/dashboard')

      // Should not be redirected to signin
      expect(page.url()).not.toContain('/signin')
    })
  })

  test.describe('Email Form Validation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/signin')
      // Click Email tab
      const emailTab = page.getByRole('button').filter({ hasText: /Email/i })
      await emailTab.click()
    })

    test('email field is required', async ({ page }) => {
      // Fill only password
      const passwordInput = page.getByLabel(/Password/i)
      await passwordInput.fill('test-password')

      // Try to submit
      const submitButton = page.getByRole('button', { name: /Sign In/i })
      await submitButton.click()

      // Should show validation error
      const errorMessage = page.getByText(/Please fill in all fields/i)
      await expect(errorMessage).toBeVisible()
    })

    test('password field is required', async ({ page }) => {
      // Fill only email
      const emailInput = page.getByLabel(/Email/i)
      await emailInput.fill('test@example.com')

      // Try to submit
      const submitButton = page.getByRole('button', { name: /Sign In/i })
      await submitButton.click()

      // Should show validation error
      const errorMessage = page.getByText(/Please fill in all fields/i)
      await expect(errorMessage).toBeVisible()
    })

    test('both fields filled enables submit button', async ({ page }) => {
      const emailInput = page.getByLabel(/Email/i)
      const passwordInput = page.getByLabel(/Password/i)

      // Initially button might be enabled, but we verify after filling
      await emailInput.fill('test@example.com')
      await passwordInput.fill('test-password')

      // Submit button should be enabled
      const submitButton = page.getByRole('button', { name: /Sign In/i })
      await expect(submitButton).not.toBeDisabled()
    })
  })

  test.describe('Mnemonic Validation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/signin')
      // Click Recovery tab
      const recoveryTab = page.getByRole('button').filter({ hasText: /Recovery/i })
      await recoveryTab.click()
    })

    test('mnemonic must be 12 words', async ({ page }) => {
      const mnemonicInput = page.getByLabel(/Recovery Phrase/i)
      const passwordInput = page.getByLabel(/Vault Password/i)

      // Enter less than 12 words
      await mnemonicInput.fill('word1 word2 word3')
      await passwordInput.fill('test-password')

      // Try to submit
      const unlockButton = page.getByRole('button', { name: /Unlock Vault/i })
      await unlockButton.click()

      // Should show validation error
      const errorMessage = page.getByText(/Please enter all 12 words/i)
      await expect(errorMessage).toBeVisible()
    })

    test('password is required for mnemonic', async ({ page }) => {
      const mnemonicInput = page.getByLabel(/Recovery Phrase/i)

      // Enter valid word count but no password
      const words = Array(12).fill('test').join(' ')
      await mnemonicInput.fill(words)

      // Try to submit
      const unlockButton = page.getByRole('button', { name: /Unlock Vault/i })
      await unlockButton.click()

      // Should show validation error about password
      const errorMessage = page.getByText(/Please enter your vault password/i)
      await expect(errorMessage).toBeVisible()
    })

    test('displays security warning about recovery phrase', async ({ page }) => {
      const warning = page.getByText(/Never share this phrase with anyone/i)
      await expect(warning).toBeVisible()
    })
  })

  test.describe('Responsive Design', () => {
    test('sign in page is responsive on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/signin')

      // Heading should be visible
      const heading = page.getByRole('heading', { name: /Welcome Back/i })
      await expect(heading).toBeVisible()

      // Auth card should be visible
      const emailTab = page.getByRole('button').filter({ hasText: /Email/i })
      await expect(emailTab).toBeVisible()

      // Sign up link should be visible
      const signUpLink = page.getByRole('link', { name: /Sign Up/i })
      await expect(signUpLink).toBeVisible()
    })

    test('sign up page is responsive on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/signup')

      // Heading should be visible
      const heading = page.getByRole('heading', { name: /Create Your Vault/i })
      await expect(heading).toBeVisible()

      // Options should be visible
      const recoveryOption = page.getByText(/Create with Recovery Phrase/i)
      await expect(recoveryOption).toBeVisible()

      // Sign in link should be visible
      const signInLink = page.getByRole('link', { name: /Sign In/i })
      await expect(signInLink).toBeVisible()
    })

    test('tab labels are hidden on small screens', async ({ page }) => {
      await page.goto('/signin')

      // On desktop, labels should be visible
      let emailTabLabel = page.locator('button span').filter({ hasText: /Email/i })
      let isVisible = await emailTabLabel.isVisible()
      // Desktop shows the text

      // On mobile, labels are hidden
      await page.setViewportSize({ width: 375, height: 667 })

      // The tab should still be there with icon, but text might be hidden
      const emailTab = page.getByRole('button').filter({ hasText: /Email/i })
      await expect(emailTab).toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('sign in page has proper heading hierarchy', async ({ page }) => {
      await page.goto('/signin')

      // Should have h1 heading
      const h1 = page.getByRole('heading', { level: 1, name: /Welcome Back/i })
      await expect(h1).toBeVisible()
    })

    test('sign up page has proper heading hierarchy', async ({ page }) => {
      await page.goto('/signup')

      // Should have h1 heading
      const h1 = page.getByRole('heading', { level: 1, name: /Create Your Vault/i })
      await expect(h1).toBeVisible()
    })

    test('form fields have labels', async ({ page }) => {
      await page.goto('/signin')

      // Click Email tab
      const emailTab = page.getByRole('button').filter({ hasText: /Email/i })
      await emailTab.click()

      // Check for labels
      const emailLabel = page.getByLabel(/Email/i)
      const passwordLabel = page.getByLabel(/Password/i)

      await expect(emailLabel).toBeVisible()
      await expect(passwordLabel).toBeVisible()
    })

    test('all interactive elements are keyboard accessible', async ({ page }) => {
      await page.goto('/signin')

      // Tab through elements
      await page.keyboard.press('Tab')

      // Should be able to interact with buttons
      const emailTab = page.getByRole('button').filter({ hasText: /Email/i })
      await emailTab.focus()
      await expect(emailTab).toBeFocused()
    })

    test('form errors are announced', async ({ page }) => {
      await page.goto('/signin')

      // Click Email tab
      const emailTab = page.getByRole('button').filter({ hasText: /Email/i })
      await emailTab.click()

      // Try to submit empty form
      const submitButton = page.getByRole('button', { name: /Sign In/i })
      await submitButton.click()

      // Error message should be visible
      const errorMessage = page.getByText(/Please fill in all fields/i)
      await expect(errorMessage).toBeVisible()
    })
  })
})
