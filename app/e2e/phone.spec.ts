import { expect, test } from '@playwright/test';
import { allItems, openApp, screenOf } from './helpers';

test('phones get bottom tools, sheets and no sideways scroll', async ({ page }) => {
    await openApp(page);
    const bar = page.locator('.phone-bar');
    await expect(bar).toBeVisible();
    await expect(page.locator('.tool-rail')).toHaveCount(0);
    await bar.getByRole('button', { name: 'Pen' }).click();
    const a = await screenOf(page, 80, 120);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + i * 15, a.y + i * 6);
    await page.mouse.up();
    await expect.poll(async () => (await allItems(page))[0].map((i) => i.kind)).toEqual(['stroke']);
    await bar.getByRole('button', { name: 'Inspect' }).click();
    await expect(page.getByRole('dialog', { name: 'Inspect' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
