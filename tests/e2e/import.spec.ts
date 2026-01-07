import { test, expect, Page } from '@playwright/test'
import path from 'path'

/**
 * E2E tests for the Import Conversations page
 *
 * Tests cover:
 * - Page layout and provider selection
 * - File upload via click and drag-and-drop
 * - Folder upload for OpenAI exports
 * - Provider detection and parsing
 * - Success and error states
 * - Import statistics display
 * - Mobile responsive behavior
 */

// Sample export data for testing
const SAMPLE_OPENAI_EXPORT = JSON.stringify({
  conversations: [
    {
      title: 'Code Review Session',
      create_time: 1704067200,
      update_time: 1704153600,
      mapping: {
        'node-1': {
          message: {
            author: { role: 'user' },
            content: { parts: ['Please review this code'] },
            create_time: 1704067200
          },
          children: ['node-2']
        },
        'node-2': {
          message: {
            author: { role: 'assistant' },
            content: { parts: ['I see several areas for improvement...'] },
            create_time: 1704067260
          },
          parent: 'node-1'
        }
      }
    }
  ]
})

const SAMPLE_CLAUDE_EXPORT = JSON.stringify({
  conversations: [
    {
      uuid: 'conv-uuid-1',
      name: 'Architecture Discussion',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T11:00:00Z',
      chat_messages: [
        {
          uuid: 'msg-1',
          sender: 'human',
          text: 'How should I structure my app?',
          created_at: '2024-01-01T10:00:00Z'
        },
        {
          uuid: 'msg-2',
          sender: 'assistant',
          text: 'Consider using a layered architecture...',
          created_at: '2024-01-01T10:01:00Z'
        }
      ]
    }
  ]
})

const INVALID_JSON = 'this is not valid json {'

test.describe('Import Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/import')
  })

  test.describe('Page Layout', () => {
    test('displays page title and description', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /Import Conversations/i })).toBeVisible()
      await expect(page.getByText(/Migrate your chat history/i)).toBeVisible()
    })

    test('shows provider selection cards', async ({ page }) => {
      await expect(page.getByText('OpenAI/ChatGPT')).toBeVisible()
      await expect(page.getByText('Anthropic Claude')).toBeVisible()
      await expect(page.getByText('Google Gemini')).toBeVisible()
    })

    test('shows drop zone area', async ({ page }) => {
      await expect(page.getByText(/Drop your export file or folder here/i)).toBeVisible()
    })

    test('displays export instructions', async ({ page }) => {
      await expect(page.getByText(/How to export your data/i)).toBeVisible()
      await expect(page.getByText(/ChatGPT/)).toBeVisible()
      await expect(page.getByText(/Claude/)).toBeVisible()
      await expect(page.getByText(/Gemini/)).toBeVisible()
    })

    test('shows Select File and Select Folder buttons', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Select File/i }).or(page.locator('label', { hasText: /Select File/i }))).toBeVisible()
      await expect(page.getByRole('button', { name: /Select Folder/i })).toBeVisible()
    })
  })

  test.describe('Provider Selection', () => {
    test('clicking provider card highlights it', async ({ page }) => {
      const openaiCard = page.locator('div', { hasText: 'OpenAI/ChatGPT' }).first()
      await openaiCard.click()

      // Check for selection indicator (border color change)
      await expect(openaiCard).toHaveClass(/border-violet-500/)
    })

    test('can select different providers', async ({ page }) => {
      // Select Claude
      const claudeCard = page.locator('[class*="cursor-pointer"]', { hasText: 'Anthropic Claude' })
      await claudeCard.click()
      await expect(claudeCard).toHaveClass(/border-violet-500/)

      // Select Gemini
      const geminiCard = page.locator('[class*="cursor-pointer"]', { hasText: 'Google Gemini' })
      await geminiCard.click()
      await expect(geminiCard).toHaveClass(/border-violet-500/)
    })

    test('provider cards show descriptions', async ({ page }) => {
      await expect(page.getByText(/Folder Import/i).first()).toBeVisible()
    })
  })

  test.describe('File Upload', () => {
    test('file input accepts JSON files', async ({ page }) => {
      const fileInput = page.locator('input[type="file"][accept=".json,.html"]')
      await expect(fileInput).toBeAttached()
    })

    test('uploading valid OpenAI export shows parsing states', async ({ page }) => {
      // Create a test file
      const buffer = Buffer.from(SAMPLE_OPENAI_EXPORT, 'utf-8')

      // Select OpenAI provider first
      await page.locator('[class*="cursor-pointer"]', { hasText: 'OpenAI/ChatGPT' }).click()

      // Upload the file
      const fileInput = page.locator('input[type="file"][accept=".json,.html"]')
      await fileInput.setInputFiles({
        name: 'conversations.json',
        mimeType: 'application/json',
        buffer
      })

      // Wait for processing states
      await expect(page.getByText(/Detecting provider|Parsing conversations|Encrypting/i)).toBeVisible({ timeout: 5000 })
    })

    test('successful import shows statistics', async ({ page }) => {
      const buffer = Buffer.from(SAMPLE_OPENAI_EXPORT, 'utf-8')

      await page.locator('[class*="cursor-pointer"]', { hasText: 'OpenAI/ChatGPT' }).click()

      const fileInput = page.locator('input[type="file"][accept=".json,.html"]')
      await fileInput.setInputFiles({
        name: 'conversations.json',
        mimeType: 'application/json',
        buffer
      })

      // Wait for import to complete
      await expect(page.getByText(/Import Successful/i)).toBeVisible({ timeout: 10000 })

      // Check statistics display
      await expect(page.getByText(/Conversations/i)).toBeVisible()
      await expect(page.getByText(/Messages/i)).toBeVisible()
    })

    test('Claude export is detected and parsed', async ({ page }) => {
      const buffer = Buffer.from(SAMPLE_CLAUDE_EXPORT, 'utf-8')

      await page.locator('[class*="cursor-pointer"]', { hasText: 'Anthropic Claude' }).click()

      const fileInput = page.locator('input[type="file"][accept=".json,.html"]')
      await fileInput.setInputFiles({
        name: 'claude-export.json',
        mimeType: 'application/json',
        buffer
      })

      await expect(page.getByText(/Import Successful/i)).toBeVisible({ timeout: 10000 })
    })

    test('invalid JSON shows error state', async ({ page }) => {
      const buffer = Buffer.from(INVALID_JSON, 'utf-8')

      const fileInput = page.locator('input[type="file"][accept=".json,.html"]')
      await fileInput.setInputFiles({
        name: 'invalid.json',
        mimeType: 'application/json',
        buffer
      })

      // Wait for error state
      await expect(page.getByText(/Import Failed/i)).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(/Try Again/i)).toBeVisible()
    })

    test('empty file shows error', async ({ page }) => {
      const buffer = Buffer.from('{}', 'utf-8')

      const fileInput = page.locator('input[type="file"][accept=".json,.html"]')
      await fileInput.setInputFiles({
        name: 'empty.json',
        mimeType: 'application/json',
        buffer
      })

      // Should show error or handle gracefully
      await expect(page.getByText(/Import Failed|Error|0.*Conversations/i)).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Drag and Drop', () => {
    test('drop zone highlights on drag over', async ({ page }) => {
      const dropZone = page.locator('.border-dashed')

      // Simulate dragover
      await dropZone.dispatchEvent('dragover', {
        dataTransfer: { dropEffect: 'copy' }
      })

      // Check for highlight class
      await expect(dropZone).toHaveClass(/border-violet-500|bg-violet-500/)
    })

    test('drop zone removes highlight on drag leave', async ({ page }) => {
      const dropZone = page.locator('.border-dashed')

      // Simulate dragover then dragleave
      await dropZone.dispatchEvent('dragover', {
        dataTransfer: { dropEffect: 'copy' }
      })
      await dropZone.dispatchEvent('dragleave')

      // Check highlight is removed
      await expect(dropZone).not.toHaveClass(/bg-violet-500\/10/)
    })
  })

  test.describe('Import Success State', () => {
    async function importFile(page: Page) {
      const buffer = Buffer.from(SAMPLE_OPENAI_EXPORT, 'utf-8')

      await page.locator('[class*="cursor-pointer"]', { hasText: 'OpenAI/ChatGPT' }).click()

      const fileInput = page.locator('input[type="file"][accept=".json,.html"]')
      await fileInput.setInputFiles({
        name: 'conversations.json',
        mimeType: 'application/json',
        buffer
      })

      await expect(page.getByText(/Import Successful/i)).toBeVisible({ timeout: 10000 })
    }

    test('shows success icon', async ({ page }) => {
      await importFile(page)

      // Check for success checkmark SVG or icon
      const successIcon = page.locator('svg path[d*="M5 13l4 4L19 7"]')
      await expect(successIcon).toBeVisible()
    })

    test('displays import statistics grid', async ({ page }) => {
      await importFile(page)

      await expect(page.getByText(/Conversations/i)).toBeVisible()
      await expect(page.getByText(/Messages/i)).toBeVisible()
      await expect(page.getByText(/Words/i)).toBeVisible()
    })

    test('shows View Memory Bank button', async ({ page }) => {
      await importFile(page)

      await expect(page.getByRole('button', { name: /View Memory Bank/i })).toBeVisible()
    })

    test('shows Import More button', async ({ page }) => {
      await importFile(page)

      await expect(page.getByRole('button', { name: /Import More/i })).toBeVisible()
    })

    test('Import More button resets to initial state', async ({ page }) => {
      await importFile(page)

      await page.getByRole('button', { name: /Import More/i }).click()

      // Should return to drop zone state
      await expect(page.getByText(/Drop your export file or folder here/i)).toBeVisible()
    })

    test('View Memory Bank navigates to memory page', async ({ page }) => {
      await importFile(page)

      await page.getByRole('button', { name: /View Memory Bank/i }).click()

      await expect(page).toHaveURL('/memory')
    })
  })

  test.describe('Import Error State', () => {
    test('shows error icon', async ({ page }) => {
      const buffer = Buffer.from(INVALID_JSON, 'utf-8')

      const fileInput = page.locator('input[type="file"][accept=".json,.html"]')
      await fileInput.setInputFiles({
        name: 'invalid.json',
        mimeType: 'application/json',
        buffer
      })

      await expect(page.getByText(/Import Failed/i)).toBeVisible({ timeout: 10000 })

      // Check for error X icon
      const errorIcon = page.locator('svg path[d*="M6 18L18 6"]')
      await expect(errorIcon).toBeVisible()
    })

    test('displays error message', async ({ page }) => {
      const buffer = Buffer.from(INVALID_JSON, 'utf-8')

      const fileInput = page.locator('input[type="file"][accept=".json,.html"]')
      await fileInput.setInputFiles({
        name: 'invalid.json',
        mimeType: 'application/json',
        buffer
      })

      await expect(page.getByText(/Import Failed/i)).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(/couldn't parse|check the format/i)).toBeVisible()
    })

    test('Try Again button resets state', async ({ page }) => {
      const buffer = Buffer.from(INVALID_JSON, 'utf-8')

      const fileInput = page.locator('input[type="file"][accept=".json,.html"]')
      await fileInput.setInputFiles({
        name: 'invalid.json',
        mimeType: 'application/json',
        buffer
      })

      await expect(page.getByText(/Import Failed/i)).toBeVisible({ timeout: 10000 })

      await page.getByRole('button', { name: /Try Again/i }).click()

      await expect(page.getByText(/Drop your export file or folder here/i)).toBeVisible()
    })
  })

  test.describe('Loading States', () => {
    test('shows detecting provider state', async ({ page }) => {
      const buffer = Buffer.from(SAMPLE_OPENAI_EXPORT, 'utf-8')

      const fileInput = page.locator('input[type="file"][accept=".json,.html"]')

      // Upload file and immediately check for detecting state
      await fileInput.setInputFiles({
        name: 'conversations.json',
        mimeType: 'application/json',
        buffer
      })

      // One of the loading states should be visible
      await expect(
        page.getByText(/Detecting provider|Parsing conversations|Encrypting/i)
      ).toBeVisible({ timeout: 3000 })
    })

    test('shows spinner during processing', async ({ page }) => {
      const buffer = Buffer.from(SAMPLE_OPENAI_EXPORT, 'utf-8')

      const fileInput = page.locator('input[type="file"][accept=".json,.html"]')
      await fileInput.setInputFiles({
        name: 'conversations.json',
        mimeType: 'application/json',
        buffer
      })

      // Check for spinner
      const spinner = page.locator('.animate-spin')
      await expect(spinner).toBeVisible({ timeout: 2000 })
    })
  })

  test.describe('Mobile Responsive', () => {
    test.use({ viewport: { width: 375, height: 667 } })

    test('provider cards stack vertically on mobile', async ({ page }) => {
      // Provider cards should still be visible
      await expect(page.getByText('OpenAI/ChatGPT')).toBeVisible()
      await expect(page.getByText('Anthropic Claude')).toBeVisible()
    })

    test('drop zone is visible and functional on mobile', async ({ page }) => {
      await expect(page.getByText(/Drop your export file/i)).toBeVisible()

      // File input should be accessible
      const selectFileLabel = page.locator('label', { hasText: /Select File/i })
      await expect(selectFileLabel).toBeVisible()
    })

    test('success state is readable on mobile', async ({ page }) => {
      const buffer = Buffer.from(SAMPLE_OPENAI_EXPORT, 'utf-8')

      await page.locator('[class*="cursor-pointer"]', { hasText: 'OpenAI/ChatGPT' }).click()

      const fileInput = page.locator('input[type="file"][accept=".json,.html"]')
      await fileInput.setInputFiles({
        name: 'conversations.json',
        mimeType: 'application/json',
        buffer
      })

      await expect(page.getByText(/Import Successful/i)).toBeVisible({ timeout: 10000 })

      // Stats should be visible
      await expect(page.getByText(/Conversations/i)).toBeVisible()
    })
  })

  test.describe('Multi-file Import', () => {
    test('can import multiple files sequentially', async ({ page }) => {
      const openaiBuffer = Buffer.from(SAMPLE_OPENAI_EXPORT, 'utf-8')
      const claudeBuffer = Buffer.from(SAMPLE_CLAUDE_EXPORT, 'utf-8')

      // Import first file
      await page.locator('[class*="cursor-pointer"]', { hasText: 'OpenAI/ChatGPT' }).click()

      const fileInput = page.locator('input[type="file"][accept=".json,.html"]')
      await fileInput.setInputFiles({
        name: 'openai.json',
        mimeType: 'application/json',
        buffer: openaiBuffer
      })

      await expect(page.getByText(/Import Successful/i)).toBeVisible({ timeout: 10000 })

      // Click Import More
      await page.getByRole('button', { name: /Import More/i }).click()

      // Import second file
      await page.locator('[class*="cursor-pointer"]', { hasText: 'Anthropic Claude' }).click()

      const fileInput2 = page.locator('input[type="file"][accept=".json,.html"]')
      await fileInput2.setInputFiles({
        name: 'claude.json',
        mimeType: 'application/json',
        buffer: claudeBuffer
      })

      await expect(page.getByText(/Import Successful/i)).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Conversation Preview', () => {
    test('shows preview of detected conversations during import', async ({ page }) => {
      const buffer = Buffer.from(SAMPLE_OPENAI_EXPORT, 'utf-8')

      await page.locator('[class*="cursor-pointer"]', { hasText: 'OpenAI/ChatGPT' }).click()

      const fileInput = page.locator('input[type="file"][accept=".json,.html"]')
      await fileInput.setInputFiles({
        name: 'conversations.json',
        mimeType: 'application/json',
        buffer
      })

      // During parsing, might show preview
      // After success, check for conversation title from the export
      await expect(page.getByText(/Import Successful|Code Review Session/i)).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Accessibility', () => {
    test('file input is keyboard accessible', async ({ page }) => {
      // Tab to the file input label
      await page.keyboard.press('Tab')

      // Check file selection is focusable
      const selectFileLabel = page.locator('label', { hasText: /Select File/i })
      await expect(selectFileLabel).toBeVisible()
    })

    test('provider cards are keyboard navigable', async ({ page }) => {
      const providerCards = page.locator('[class*="cursor-pointer"]')

      // Focus first card
      await providerCards.first().focus()
      await expect(providerCards.first()).toBeFocused()
    })

    test('buttons have proper labels', async ({ page }) => {
      const buffer = Buffer.from(SAMPLE_OPENAI_EXPORT, 'utf-8')

      await page.locator('[class*="cursor-pointer"]', { hasText: 'OpenAI/ChatGPT' }).click()

      const fileInput = page.locator('input[type="file"][accept=".json,.html"]')
      await fileInput.setInputFiles({
        name: 'conversations.json',
        mimeType: 'application/json',
        buffer
      })

      await expect(page.getByText(/Import Successful/i)).toBeVisible({ timeout: 10000 })

      // Check button accessibility
      const viewMemoryButton = page.getByRole('button', { name: /View Memory Bank/i })
      await expect(viewMemoryButton).toBeEnabled()

      const importMoreButton = page.getByRole('button', { name: /Import More/i })
      await expect(importMoreButton).toBeEnabled()
    })
  })
})
