import { test, expect } from '@playwright/test';

test.describe('Visual Regression - Premium Redesign', () => {
    const pages = [
        { name: 'Dashboard', path: '/' },
        { name: 'Profile', path: '/profile' },
        { name: 'Memory', path: '/memory' },
        { name: 'Chat', path: '/chat' },
        { name: 'Import', path: '/import' },
        { name: 'Connect', path: '/connect' },
    ];

    for (const page of pages) {
        test(`should match snapshot for ${page.name}`, async ({ page: playwrightPage }) => {
            await playwrightPage.goto(page.path);
            // Wait for animations and content to settle
            await playwrightPage.waitForTimeout(1000);

            // Check for visibility of key branding element
            await expect(playwrightPage.getByText('Identity')).toBeVisible();

            // Capture and compare snapshot
            await expect(playwrightPage).toHaveScreenshot(`${page.name.toLowerCase()}-premium.png`, {
                fullPage: true,
                maxDiffPixelRatio: 0.02
            });
        });
    }
});
