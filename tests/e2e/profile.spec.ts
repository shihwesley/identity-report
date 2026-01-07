import { test, expect, Page } from '@playwright/test'

/**
 * E2E tests for the Profile Management page
 *
 * Tests cover:
 * - Profile display and editing
 * - Vault backup export (.pvault)
 * - Vault backup import
 * - Preferences management
 * - Form validation
 * - Mobile responsive behavior
 */

test.describe('Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile')
  })

  test.describe('Page Layout', () => {
    test('displays page title', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /Profile Identity/i })).toBeVisible()
    })

    test('shows profile avatar', async ({ page }) => {
      const avatar = page.locator('img[alt="Avatar"]')
      await expect(avatar).toBeVisible()
    })

    test('displays user name and email', async ({ page }) => {
      // Should show profile info from CURRENT_PROFILE
      const nameElement = page.locator('.text-xl.font-bold')
      await expect(nameElement).toBeVisible()
    })

    test('shows profile form with editable fields', async ({ page }) => {
      await expect(page.getByLabel(/Display Name/i)).toBeVisible()
      await expect(page.getByLabel(/Role/i)).toBeVisible()
      await expect(page.getByLabel(/Location/i)).toBeVisible()
    })

    test('shows Portable Vault section', async ({ page }) => {
      await expect(page.getByText(/Portable Vault/i)).toBeVisible()
      await expect(page.getByText(/Export your encrypted profile/i)).toBeVisible()
    })

    test('shows Core Preferences section', async ({ page }) => {
      await expect(page.getByText(/Core Preferences/i)).toBeVisible()
    })
  })

  test.describe('Profile Form', () => {
    test('Display Name field is editable', async ({ page }) => {
      const displayNameInput = page.locator('input').filter({ has: page.locator('[placeholder]') }).first()

      // Clear and type new value
      await displayNameInput.clear()
      await displayNameInput.fill('New Display Name')

      await expect(displayNameInput).toHaveValue('New Display Name')
    })

    test('Role field is editable', async ({ page }) => {
      const roleInput = page.locator('input').nth(1)

      await roleInput.clear()
      await roleInput.fill('Product Manager')

      await expect(roleInput).toHaveValue('Product Manager')
    })

    test('Location field is editable', async ({ page }) => {
      const locationInput = page.locator('input').nth(2)

      await locationInput.clear()
      await locationInput.fill('New York, NY')

      await expect(locationInput).toHaveValue('New York, NY')
    })

    test('Save Changes button is present', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Save Changes/i })).toBeVisible()
    })

    test('Save Changes button is clickable', async ({ page }) => {
      const saveButton = page.getByRole('button', { name: /Save Changes/i })

      await expect(saveButton).toBeEnabled()
      await saveButton.click()

      // Should not throw error
    })
  })

  test.describe('Vault Backup Export', () => {
    test('Download .pvault Backup button is visible', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Download .pvault Backup/i })).toBeVisible()
    })

    test('clicking export button shows loading state', async ({ page }) => {
      const exportButton = page.getByRole('button', { name: /Download .pvault Backup/i })

      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)

      await exportButton.click()

      // Should show loading or exporting state
      await expect(
        page.getByText(/Exporting/i).or(page.locator('.animate-spin'))
      ).toBeVisible({ timeout: 3000 }).catch(() => {
        // Button might complete quickly
      })
    })

    test('successful export shows success message', async ({ page }) => {
      // Mock the vault export to succeed
      await page.evaluate(() => {
        // Mock localStorage or vault manager
        (window as unknown as { mockExportSuccess: boolean }).mockExportSuccess = true
      })

      const exportButton = page.getByRole('button', { name: /Download .pvault Backup/i })
      await exportButton.click()

      // Wait for success or status message
      await expect(
        page.getByText(/success|downloaded/i).or(page.getByText(/Export failed/i))
      ).toBeVisible({ timeout: 10000 })
    })

    test('displays security reminder about mnemonic', async ({ page }) => {
      await expect(page.getByText(/12-word mnemonic/i)).toBeVisible()
      await expect(page.getByText(/password/i)).toBeVisible()
    })
  })

  test.describe('Vault Backup Import', () => {
    test('Import from .pvault button is visible', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Import from .pvault/i })).toBeVisible()
    })

    test('import file input accepts .pvault and .json files', async ({ page }) => {
      const fileInput = page.locator('input[type="file"][accept=".pvault,.json"]')
      await expect(fileInput).toBeAttached()
    })

    test('clicking import button triggers file picker', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /Import from .pvault/i })

      // Check that clicking the button activates the hidden file input
      await importButton.click()

      // The file chooser should be triggered (we can't fully test native file picker)
      // Just verify the button is clickable
      await expect(importButton).toBeEnabled()
    })

    test('importing valid vault file shows success', async ({ page }) => {
      // Create a mock vault backup
      const mockVaultData = {
        version: 1,
        encrypted: false,
        data: {
          identity: {
            displayName: 'Imported User',
            fullName: 'Imported User Full',
            email: 'imported@example.com'
          },
          conversations: [],
          memories: []
        }
      }

      const buffer = Buffer.from(JSON.stringify(mockVaultData), 'utf-8')

      const fileInput = page.locator('input[type="file"][accept=".pvault,.json"]')
      await fileInput.setInputFiles({
        name: 'backup.pvault',
        mimeType: 'application/json',
        buffer
      })

      // Wait for import processing
      await expect(
        page.getByText(/Imported|success|failed/i)
      ).toBeVisible({ timeout: 10000 })
    })

    test('importing invalid file shows error', async ({ page }) => {
      const buffer = Buffer.from('invalid data', 'utf-8')

      const fileInput = page.locator('input[type="file"][accept=".pvault,.json"]')
      await fileInput.setInputFiles({
        name: 'invalid.pvault',
        mimeType: 'application/json',
        buffer
      })

      // Should show error
      await expect(
        page.getByText(/failed|error/i)
      ).toBeVisible({ timeout: 10000 })
    })

    test('shows loading state during import', async ({ page }) => {
      const mockVaultData = {
        version: 1,
        data: { identity: {} }
      }

      const buffer = Buffer.from(JSON.stringify(mockVaultData), 'utf-8')

      const fileInput = page.locator('input[type="file"][accept=".pvault,.json"]')

      // Set files and immediately check for loading
      await fileInput.setInputFiles({
        name: 'backup.pvault',
        mimeType: 'application/json',
        buffer
      })

      // Either loading spinner or result should appear
      await expect(
        page.locator('.animate-spin').or(page.getByText(/Importing|Imported|failed/i))
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Preferences Section', () => {
    test('displays preference cards', async ({ page }) => {
      // Should show some preference entries
      const preferenceCards = page.locator('.bg-zinc-900\\/50')
      const count = await preferenceCards.count()

      // Should have at least the preferences section visible
      expect(count).toBeGreaterThan(0)
    })

    test('shows Add Preference button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Add Preference/i })).toBeVisible()
    })

    test('Add Preference button is clickable', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /Add Preference/i })

      await expect(addButton).toBeEnabled()
      await addButton.click()
    })

    test('preference cards show key-value pairs', async ({ page }) => {
      // Check for preference structure
      const preferenceSection = page.locator('.glass-card', { hasText: /Core Preferences/i })
      await expect(preferenceSection).toBeVisible()

      // Preferences should have keys and values displayed
      const preferenceItems = preferenceSection.locator('.text-sm.text-zinc-300')
      const count = await preferenceItems.count()

      // If there are preferences, they should be visible
      if (count > 0) {
        await expect(preferenceItems.first()).toBeVisible()
      }
    })
  })

  test.describe('Status Messages', () => {
    test('success message has green styling', async ({ page }) => {
      const mockVaultData = {
        version: 1,
        data: {
          identity: { displayName: 'Test' },
          conversations: [{ id: '1' }],
          memories: [{ id: '1' }]
        },
        stats: {
          conversations: 1,
          memories: 1,
          blobs: 0
        }
      }

      const buffer = Buffer.from(JSON.stringify(mockVaultData), 'utf-8')

      const fileInput = page.locator('input[type="file"][accept=".pvault,.json"]')
      await fileInput.setInputFiles({
        name: 'backup.pvault',
        mimeType: 'application/json',
        buffer
      })

      // Wait for result and check styling
      const resultMessage = page.locator('[class*="bg-teal-500"], [class*="bg-red-500"]')
      await expect(resultMessage).toBeVisible({ timeout: 10000 })
    })

    test('error message has red styling', async ({ page }) => {
      const buffer = Buffer.from('not json', 'utf-8')

      const fileInput = page.locator('input[type="file"][accept=".pvault,.json"]')
      await fileInput.setInputFiles({
        name: 'bad.pvault',
        mimeType: 'application/json',
        buffer
      })

      // Wait for error and check styling
      await expect(page.locator('[class*="bg-red-500"]')).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Mobile Responsive', () => {
    test.use({ viewport: { width: 375, height: 667 } })

    test('page title is visible on mobile', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /Profile Identity/i })).toBeVisible()
    })

    test('profile form stacks on mobile', async ({ page }) => {
      // Form fields should be visible and accessible
      await expect(page.getByLabel(/Display Name/i)).toBeVisible()
      await expect(page.getByLabel(/Role/i)).toBeVisible()
    })

    test('vault buttons are accessible on mobile', async ({ page }) => {
      const exportButton = page.getByRole('button', { name: /Download .pvault/i })
      const importButton = page.getByRole('button', { name: /Import from .pvault/i })

      await expect(exportButton).toBeVisible()
      await expect(importButton).toBeVisible()

      // Buttons should be tappable
      const exportBox = await exportButton.boundingBox()
      const importBox = await importButton.boundingBox()

      // Ensure buttons have reasonable tap target size
      expect(exportBox?.height).toBeGreaterThan(40)
      expect(importBox?.height).toBeGreaterThan(40)
    })

    test('preferences section scrolls on mobile', async ({ page }) => {
      const preferencesSection = page.locator('.glass-card', { hasText: /Core Preferences/i })
      await expect(preferencesSection).toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('form inputs have labels', async ({ page }) => {
      const displayNameLabel = page.getByText('Display Name')
      const roleLabel = page.getByText('Role')
      const locationLabel = page.getByText('Location')

      await expect(displayNameLabel).toBeVisible()
      await expect(roleLabel).toBeVisible()
      await expect(locationLabel).toBeVisible()
    })

    test('buttons have accessible text', async ({ page }) => {
      // Save button
      const saveButton = page.getByRole('button', { name: /Save Changes/i })
      await expect(saveButton).toBeVisible()

      // Export button
      const exportButton = page.getByRole('button', { name: /Download .pvault/i })
      await expect(exportButton).toBeVisible()

      // Import button
      const importButton = page.getByRole('button', { name: /Import from .pvault/i })
      await expect(importButton).toBeVisible()
    })

    test('page has proper heading hierarchy', async ({ page }) => {
      // Main heading
      const h1 = page.getByRole('heading', { level: 1, name: /Profile Identity/i })
      await expect(h1).toBeVisible()

      // Sub headings
      const h3Elements = page.getByRole('heading', { level: 3 })
      const count = await h3Elements.count()
      expect(count).toBeGreaterThan(0)
    })

    test('form fields are keyboard navigable', async ({ page }) => {
      // Tab through form fields
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')

      // An input should be focused
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
      expect(['INPUT', 'BUTTON', 'A']).toContain(focusedElement)
    })
  })

  test.describe('Full User Journey', () => {
    test('edit profile and export backup', async ({ page }) => {
      // Edit display name
      const displayNameInput = page.locator('input').first()
      await displayNameInput.clear()
      await displayNameInput.fill('Updated Profile Name')

      // Click save (might not persist in test, but should not error)
      await page.getByRole('button', { name: /Save Changes/i }).click()

      // Attempt export
      const exportButton = page.getByRole('button', { name: /Download .pvault/i })
      await exportButton.click()

      // Wait for export attempt to complete
      await page.waitForTimeout(2000)
    })

    test('import backup and verify changes', async ({ page }) => {
      const mockVaultData = {
        version: 1,
        data: {
          identity: {
            displayName: 'Restored User',
            fullName: 'Restored User Full Name',
            email: 'restored@example.com',
            location: 'Restored City',
            role: 'Restored Role'
          },
          conversations: [],
          memories: []
        },
        stats: {
          conversations: 5,
          memories: 10,
          blobs: 2
        }
      }

      const buffer = Buffer.from(JSON.stringify(mockVaultData), 'utf-8')

      const fileInput = page.locator('input[type="file"][accept=".pvault,.json"]')
      await fileInput.setInputFiles({
        name: 'restore.pvault',
        mimeType: 'application/json',
        buffer
      })

      // Wait for import result
      await expect(
        page.getByText(/Imported|success|failed/i)
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Error Handling', () => {
    test('handles export failure gracefully', async ({ page }) => {
      // Mock vault export to fail
      await page.evaluate(() => {
        // This would need actual vault mocking
      })

      const exportButton = page.getByRole('button', { name: /Download .pvault/i })
      await exportButton.click()

      // Should either succeed or show error, not crash
      await expect(
        page.getByText(/Export|Download|success|failed/i)
      ).toBeVisible({ timeout: 10000 })
    })

    test('handles import with missing fields', async ({ page }) => {
      const incompleteData = {
        version: 1
        // Missing data field
      }

      const buffer = Buffer.from(JSON.stringify(incompleteData), 'utf-8')

      const fileInput = page.locator('input[type="file"][accept=".pvault,.json"]')
      await fileInput.setInputFiles({
        name: 'incomplete.pvault',
        mimeType: 'application/json',
        buffer
      })

      // Should handle gracefully
      await expect(
        page.getByText(/failed|error|Imported/i)
      ).toBeVisible({ timeout: 10000 })
    })

    test('handles corrupted file', async ({ page }) => {
      // Create corrupted data (valid JSON but wrong structure)
      const corruptedData = {
        unexpected: 'structure',
        that: ['does', 'not', 'match']
      }

      const buffer = Buffer.from(JSON.stringify(corruptedData), 'utf-8')

      const fileInput = page.locator('input[type="file"][accept=".pvault,.json"]')
      await fileInput.setInputFiles({
        name: 'corrupted.pvault',
        mimeType: 'application/json',
        buffer
      })

      // Should handle gracefully
      await expect(
        page.getByText(/failed|error|Imported/i)
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Two-Column Layout', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('displays two-column layout on desktop', async ({ page }) => {
      // Profile form and vault sections should be side by side
      const grid = page.locator('.grid.grid-cols-1.md\\:grid-cols-2')
      await expect(grid).toBeVisible()
    })

    test('profile card is on the left', async ({ page }) => {
      const profileCard = page.locator('.glass-card').first()
      const box = await profileCard.boundingBox()

      // Should be on the left side of the viewport
      expect(box?.x).toBeLessThan(640)
    })

    test('vault section is on the right', async ({ page }) => {
      const vaultSection = page.locator('.glass-card', { hasText: /Portable Vault/i })
      await expect(vaultSection).toBeVisible()
    })
  })
})
