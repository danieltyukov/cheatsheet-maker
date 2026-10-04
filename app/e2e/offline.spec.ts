import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test('loads offline after the first visit', async ({ page, context }) => {
    await openApp(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible();
    await context.setOffline(false);
});
