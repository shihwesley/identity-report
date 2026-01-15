import { test, expect } from '@playwright/test'

test.describe('Visual Regression', () => {
  test('homepage visual snapshot', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Wait for animations to settle
    await page.waitForTimeout(500)

    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.02
    })
  })

  test('signin page snapshot', async ({ page }) => {
    await page.goto('/signin')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await expect(page).toHaveScreenshot('signin.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.02
    })
  })

  test('signin email tab snapshot', async ({ page }) => {
    await page.goto('/signin')
    await page.waitForLoadState('networkidle')

    // Click email tab if it exists
    const emailTab = page.locator('[role="tab"]:has-text("Email")')
    if (await emailTab.isVisible()) {
      await emailTab.click()
      await page.waitForTimeout(300)
    }

    await expect(page).toHaveScreenshot('signin-email-tab.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.02
    })
  })

  test('signin recovery tab snapshot', async ({ page }) => {
    await page.goto('/signin')
    await page.waitForLoadState('networkidle')

    // Click recovery tab if it exists
    const recoveryTab = page.locator('[role="tab"]:has-text("Recovery")')
    if (await recoveryTab.isVisible()) {
      await recoveryTab.click()
      await page.waitForTimeout(300)
    }

    await expect(page).toHaveScreenshot('signin-recovery-tab.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.02
    })
  })

  test('signup page snapshot', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await expect(page).toHaveScreenshot('signup.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.02
    })
  })

  test('homepage mobile snapshot', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await expect(page).toHaveScreenshot('homepage-mobile.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.02
    })
  })
})
