import { expect, test } from '@playwright/test';
import { allItems, openApp, screenOf } from './helpers';

test('loads offline after the first visit', async ({ page, context }) => {
    await openApp(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible();
    await context.setOffline(false);
});

test('common math alphabets typeset offline without having been used online', async ({ page, context }) => {
    await openApp(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible();
    await page.keyboard.press('t');
    const at = await screenOf(page, 60, 600);
    await page.mouse.click(at.x, at.y);
    await page.keyboard.type('$\\frac{\\mathbb{P}(B|A)}{\\mathcal{L}(B)}$');
    await page.keyboard.press('Escape');
    // A plain line is 19.25 pt; the fraction (sized like the Bayes one in editor.spec) is taller only if both alphabets loaded.
    await expect.poll(async () => (await allItems(page))[0].find((i) => i.kind === 'text')?.h ?? 0, { timeout: 10_000 }).toBeGreaterThan(22);
    await context.setOffline(false);
});
