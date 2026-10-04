import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { allItems, drag, fixture, openApp, pasteImage, pdfInfo } from './helpers';

test.beforeEach(async ({ page }) => {
    await openApp(page);
});

async function pickFromInsert(page: import('@playwright/test').Page, item: RegExp, file: string) {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Insert' }).click();
    await page.getByRole('menuitem', { name: item }).click();
    await (await chooser).setFiles(fixture(file));
}

test('a region dragged on a PDF page becomes a re-croppable image', async ({ page }) => {
    await pickFromInsert(page, /From a PDF/, 'slides.pdf');
    const dialog = page.getByRole('dialog', { name: /Import from slides.pdf/ });
    await expect(dialog.getByRole('button', { name: 'Page 2' })).toBeVisible();
    const stage = dialog.locator('.pdf-stage');
    // Wait until the page is rendered and the stage has its final size.
    await expect.poll(() => stage.locator('canvas').evaluate((c: HTMLCanvasElement) => c.getBoundingClientRect().width)).toBeGreaterThan(100);
    const box = (await stage.boundingBox())!;
    await drag(page, { x: box.x + box.width * 0.05, y: box.y + box.height * 0.2 }, { x: box.x + box.width * 0.5, y: box.y + box.height * 0.8 });
    await dialog.getByRole('button', { name: 'Add 1 region' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await allItems(page))[0].length).toBe(1);
    const [[img]] = await allItems(page);
    expect(img.kind).toBe('image');
    const asset = await page.evaluate(() => {
        const cm = (window as unknown as { __cm: { store: { doc: { assets: Record<string, { width: number; height: number }> } } } }).__cm;
        return Object.values(cm.store.doc.assets)[0];
    });
    expect(img.crop!.w).toBeLessThan(asset.width);
    expect(img.crop!.h).toBeLessThan(asset.height);
});

test('a password-protected PDF is refused with a clear message', async ({ page }) => {
    await pickFromInsert(page, /From a PDF/, 'locked.pdf');
    await expect(page.getByRole('alert').filter({ hasText: 'password protected' })).toBeVisible();
    expect((await allItems(page))[0]).toHaveLength(0);
});

test('PDF export has every page at A4', async ({ page }) => {
    await pasteImage(page);
    await expect.poll(async () => (await allItems(page))[0].length).toBe(1);
    await page.keyboard.press('Control+Enter');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    await page.getByRole('menuitem', { name: /^PDF/ }).click();
    const file = await (await download).path();
    const info = pdfInfo(file);
    expect(info.pages).toBe(2);
    expect(info.width).toBeCloseTo(595.28, 1);
    expect(info.height).toBeCloseTo(841.89, 1);
});

test('a saved .cheatsheet file opens again from the library', async ({ page }) => {
    await pasteImage(page);
    await expect.poll(async () => (await allItems(page))[0].length).toBe(1);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    await page.getByRole('menuitem', { name: /\.cheatsheet/ }).click();
    const saved = await (await download).path();
    await page.getByRole('button', { name: 'All cheatsheets' }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Open file' }).click();
    await (await chooser).setFiles({ name: 'copy.cheatsheet', mimeType: 'application/zip', buffer: readFileSync(saved) });
    await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible();
    await expect.poll(async () => (await allItems(page))[0].map((i) => i.kind)).toEqual(['image']);
    await page.getByRole('button', { name: 'All cheatsheets' }).click();
    await expect(page.getByRole('list', { name: 'Your cheatsheets' }).getByRole('listitem')).toHaveCount(2);
});

test('the old Linux autosave opens from the library', async ({ page }) => {
    await page.getByRole('button', { name: 'All cheatsheets' }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Open file' }).click();
    await (await chooser).setFiles(fixture('legacy-autosave.json'));
    await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('legacy-autosave');
    await expect.poll(async () => (await allItems(page)).map((p) => p.map((i) => i.kind))).toEqual([['image', 'stroke'], []]);
});
