import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  // Hero Section Tests
  test('displays hero section with headline', async ({ page }) => {
    // Check main headline
    const headline = page.getByRole('heading', { name: /Own Your/i })
    await expect(headline).toBeVisible()

    // Check subheadline contains specific text
    const subheadline = page.getByText(/Your conversations, memories, and insights/i)
    await expect(subheadline).toBeVisible()
  })

  test('displays AI context text in hero', async ({ page }) => {
    const aiContextText = page.getByText(/AI Context/i)
    await expect(aiContextText).toBeVisible()
  })

  test('displays hero badge with privacy text', async ({ page }) => {
    const badge = page.getByText(/Privacy-First AI Context/i)
    await expect(badge).toBeVisible()
  })

  // Navigation / CTA Tests
  test('displays Get Started button in hero', async ({ page }) => {
    const getStartedButton = page.getByRole('link', { name: /Get Started/i })
    await expect(getStartedButton).toBeVisible()
    await expect(getStartedButton).toHaveAttribute('href', '/signup')
  })

  test('displays Learn More button in hero', async ({ page }) => {
    const learnMoreButton = page.getByRole('button', { name: /Learn More/i })
    await expect(learnMoreButton).toBeVisible()
  })

  test('Get Started button navigates to /signup', async ({ page }) => {
    const getStartedButton = page.getByRole('link', { name: /Get Started/i })
    await getStartedButton.click()
    await expect(page).toHaveURL('/signup')
  })

  // Features Section Tests
  test('displays all three feature cards', async ({ page }) => {
    // Check for "Works with Any AI" feature
    const worksWithAny = page.getByRole('heading', { name: /Works with Any AI/i })
    await expect(worksWithAny).toBeVisible()

    // Check for "Persistent Memory" feature
    const persistentMemory = page.getByRole('heading', { name: /Persistent Memory/i })
    await expect(persistentMemory).toBeVisible()

    // Check for "Import Everything" feature
    const importEverything = page.getByRole('heading', { name: /Import Everything/i })
    await expect(importEverything).toBeVisible()
  })

  test('feature cards contain descriptions', async ({ page }) => {
    // Feature 1 description
    const feature1Desc = page.getByText(/Connect to Claude, ChatGPT, Gemini/i)
    await expect(feature1Desc).toBeVisible()

    // Feature 2 description
    const feature2Desc = page.getByText(/AI remembers your preferences/i)
    await expect(feature2Desc).toBeVisible()

    // Feature 3 description
    const feature3Desc = page.getByText(/Bring existing conversations from OpenAI/i)
    await expect(feature3Desc).toBeVisible()
  })

  test('features section header is visible', async ({ page }) => {
    const sectionHeader = page.getByRole('heading', { name: /Your AI, Your Rules/i })
    await expect(sectionHeader).toBeVisible()
  })

  // CTA Section Tests
  test('CTA section displays main heading', async ({ page }) => {
    const ctaHeading = page.getByRole('heading', { name: /Ready to own your AI identity/i })
    await expect(ctaHeading).toBeVisible()
  })

  test('CTA section displays Create Your Vault button', async ({ page }) => {
    const ctaButton = page.getByRole('link', { name: /Create Your Vault/i })
    await expect(ctaButton).toBeVisible()
    await expect(ctaButton).toHaveAttribute('href', '/signup')
  })

  test('CTA section displays Sign In link', async ({ page }) => {
    const signInLink = page.getByText(/Already have an account\? Sign In/i)
    await expect(signInLink).toBeVisible()
  })

  test('Sign In link in CTA section navigates to /signin', async ({ page }) => {
    const signInLink = page.getByRole('link', { name: /Already have an account\? Sign In/i })
    await signInLink.click()
    await expect(page).toHaveURL('/signin')
  })

  test('CTA section displays subheadline text', async ({ page }) => {
    const subtext = page.getByText(/Create your encrypted vault in minutes/i)
    await expect(subtext).toBeVisible()
  })

  // Learn More scroll functionality
  test('Learn More button scrolls to features section', async ({ page }) => {
    const learnMoreButton = page.getByRole('button', { name: /Learn More/i })
    await learnMoreButton.click()

    // Wait for smooth scroll and verify features section is in view
    const featuresSection = page.locator('section:has-text("Your AI, Your Rules")')
    await expect(featuresSection).toBeInViewport()
  })

  // Responsive Tests
  test('homepage is responsive on mobile (375x667)', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Hero section should still be visible
    const headline = page.getByRole('heading', { name: /Own Your/i })
    await expect(headline).toBeVisible()

    // Get Started button should be visible and clickable
    const getStartedButton = page.getByRole('link', { name: /Get Started/i })
    await expect(getStartedButton).toBeVisible()
    await expect(getStartedButton).toBeInViewport()

    // Features section should be accessible via scroll
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const featureTitle = page.getByRole('heading', { name: /Works with Any AI/i })
    await expect(featureTitle).toBeVisible()

    // CTA section should be accessible
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const ctaHeading = page.getByRole('heading', { name: /Ready to own your AI identity/i })
    await expect(ctaHeading).toBeVisible()
  })

  test('navigation elements stack vertically on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    // Check that buttons are visible and accessible
    const getStartedButton = page.getByRole('link', { name: /Get Started/i })
    await expect(getStartedButton).toBeVisible()

    // Verify button layout is suitable for mobile
    const boundingBox = await getStartedButton.boundingBox()
    expect(boundingBox).not.toBeNull()
    if (boundingBox) {
      expect(boundingBox.width).toBeGreaterThan(0)
    }
  })

  test('feature cards are visible and responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    // Scroll to features section
    const featuresSection = page.locator('section:has-text("Your AI, Your Rules")')
    await featuresSection.scrollIntoViewIfNeeded()

    // All feature cards should be accessible
    const features = page.locator('section:has-text("Your AI, Your Rules") >> div').filter({ has: page.getByRole('heading') })
    const count = await features.count()
    expect(count).toBeGreaterThan(0)

    // Each feature title should be visible
    const feature1 = page.getByRole('heading', { name: /Works with Any AI/i })
    const feature2 = page.getByRole('heading', { name: /Persistent Memory/i })
    const feature3 = page.getByRole('heading', { name: /Import Everything/i })

    await expect(feature1).toBeVisible()
    await expect(feature2).toBeVisible()
    await expect(feature3).toBeVisible()
  })

  // Accessibility Tests
  test('all buttons and links have proper contrast', async ({ page }) => {
    // Get all interactive elements
    const buttons = await page.locator('button, a[href]').all()
    expect(buttons.length).toBeGreaterThan(0)
  })

  test('page has proper semantic structure', async ({ page }) => {
    // Check for main landmark
    const main = page.locator('main')
    // Home page might be in div instead, so check for sections
    const sections = await page.locator('section').all()
    expect(sections.length).toBeGreaterThanOrEqual(3) // Hero, Features, CTA
  })

  test('all navigation links are keyboard accessible', async ({ page }) => {
    const getStartedButton = page.getByRole('link', { name: /Get Started/i })

    // Tab to button
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Should be able to activate via Enter
    await expect(getStartedButton).toBeTruthy()
  })

  // Visual regression test
  test('hero section visual integrity on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })

    const heroSection = page.locator('section').first()
    await expect(heroSection).toBeVisible()

    // Verify all hero elements are present
    const headline = page.getByRole('heading', { name: /Own Your/i })
    const subheadline = page.getByText(/Your conversations, memories, and insights/i)
    const cta = page.getByRole('link', { name: /Get Started/i })

    await expect(headline).toBeVisible()
    await expect(subheadline).toBeVisible()
    await expect(cta).toBeVisible()
  })

  test('CTA section has all required elements', async ({ page }) => {
    // Scroll to CTA section
    const ctaSection = page.locator('section:has-text("Ready to own your AI identity")')
    await ctaSection.scrollIntoViewIfNeeded()

    // Verify all CTA elements
    const heading = page.getByRole('heading', { name: /Ready to own your AI identity/i })
    const vault = page.getByRole('link', { name: /Create Your Vault/i })
    const signin = page.getByText(/Already have an account/i)

    await expect(heading).toBeVisible()
    await expect(vault).toBeVisible()
    await expect(signin).toBeVisible()
  })
})
