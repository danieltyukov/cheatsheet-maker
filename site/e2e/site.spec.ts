import { expect, test } from '@playwright/test';

test('the home page leads to the web app and the downloads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/one printable page/);
    await expect(page.getByRole('link', { name: 'Open the web app' })).toHaveAttribute('href', './app/');
    await expect(page.locator('[data-download]')).toHaveAttribute('href', /releases\/latest\/download\/|#install/);
    await expect(page.locator('.hero-shot img')).toHaveJSProperty('complete', true);
});

test('the theme toggle switches and remembers the theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /Switch to the (dark|light) theme/ });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('nothing scrolls sideways and the privacy page loads', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.goto('/privacy.html');
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
});
