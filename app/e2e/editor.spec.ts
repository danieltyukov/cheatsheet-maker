import { expect, test } from '@playwright/test';
import { A4, allItems, centreOf, drag, editorState, openApp, overlaps, pasteImage, screenOf, zoom } from './helpers';

test.beforeEach(async ({ page }) => {
    await openApp(page);
});

test('pasting an image adds it and selects it', async ({ page }) => {
    await pasteImage(page);
    await expect.poll(async () => (await allItems(page))[0].length).toBe(1);
    const [[img]] = await allItems(page);
    expect(img.kind).toBe('image');
    expect((await editorState(page)).selection).toEqual([img.id]);
});

test('dragging moves an image, and undo and redo restore it', async ({ page }) => {
    await pasteImage(page);
    await expect.poll(async () => (await allItems(page))[0].length).toBe(1);
    const [[before]] = await allItems(page);
    const z = await zoom(page);
    const c = await centreOf(page, before);
    await drag(page, c, { x: c.x + 100, y: c.y });
    const [[after]] = await allItems(page);
    expect(Math.abs(after.x - before.x - 100 / z)).toBeLessThan(8 / z);
    await page.keyboard.press('Control+z');
    expect((await allItems(page))[0][0].x).toBeCloseTo(before.x);
    await page.keyboard.press('Control+Shift+Z');
    expect((await allItems(page))[0][0].x).toBeCloseTo(after.x);
});

test('cropping keeps the scale of the image', async ({ page }) => {
    await pasteImage(page);
    await expect.poll(async () => (await allItems(page))[0].length).toBe(1);
    const [[img]] = await allItems(page);
    const c = await centreOf(page, img);
    await page.mouse.dblclick(c.x, c.y);
    await expect.poll(async () => (await editorState(page)).cropId).toBe(img.id);
    const east = await screenOf(page, img.x + img.w, img.y + img.h / 2);
    await drag(page, east, { x: east.x - 80, y: east.y });
    const [[cropped]] = await allItems(page);
    expect(cropped.w).toBeLessThan(img.w);
    expect(cropped.crop!.w).toBeLessThan(img.crop!.w);
    expect(cropped.w / cropped.crop!.w).toBeCloseTo(img.w / img.crop!.w, 3);
});

test('the pen draws a stroke and the eraser removes it', async ({ page }) => {
    await page.keyboard.press('p');
    const a = await screenOf(page, 60, 60);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(a.x + i * 20, a.y + (i % 2) * 10);
    await page.mouse.up();
    await expect.poll(async () => (await allItems(page))[0].map((i) => i.kind)).toEqual(['stroke']);
    await page.keyboard.press('e');
    const top = await screenOf(page, 120, 30);
    await drag(page, top, { x: top.x, y: top.y + 80 }, 12);
    await expect.poll(async () => (await allItems(page))[0].length).toBe(0);
});

test('a text box with math grows to fit the formula', async ({ page }) => {
    await page.keyboard.press('t');
    const at = await screenOf(page, 60, 600);
    await page.mouse.click(at.x, at.y);
    await page.keyboard.type('**Bayes** $\\frac{P(B|A)P(A)}{P(B)}$');
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await allItems(page))[0].find((i) => i.kind === 'text')?.text).toBe('**Bayes** $\\frac{P(B|A)P(A)}{P(B)}$');
    // One plain line is 9 * 1.25 + 8 = 19.25 pt; the fraction makes the line taller once typeset.
    await expect.poll(async () => (await allItems(page))[0].find((i) => i.kind === 'text')!.h, { timeout: 10_000 }).toBeGreaterThan(22);
});

test('images pasted together land side by side', async ({ page }) => {
    await page.evaluate(async () => {
        const make = async () => {
            const c = document.createElement('canvas');
            c.width = 300;
            c.height = 200;
            const x = c.getContext('2d')!;
            x.fillStyle = '#123';
            x.fillRect(0, 0, 300, 200);
            return new File([await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'))], 'a.png', { type: 'image/png' });
        };
        const dt = new DataTransfer();
        dt.items.add(await make());
        dt.items.add(await make());
        document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });
    await expect.poll(async () => (await allItems(page))[0].length).toBe(2);
    const [[a, b]] = await allItems(page);
    expect(overlaps(a, b)).toBe(false);
});

test('auto-pack fills the page without overlaps', async ({ page }) => {
    for (let i = 0; i < 3; i++) await pasteImage(page);
    await expect.poll(async () => (await allItems(page))[0].length).toBe(3);
    await page.getByRole('button', { name: 'Layout' }).click();
    await page.getByRole('menuitem', { name: 'Auto-pack: fill the page' }).click();
    const [items] = await allItems(page);
    for (const it of items) {
        expect(it.x).toBeGreaterThanOrEqual(A4.margin - 0.5);
        expect(it.y).toBeGreaterThanOrEqual(A4.margin - 0.5);
        expect(it.x + it.w).toBeLessThanOrEqual(A4.w - A4.margin + 0.5);
        expect(it.y + it.h).toBeLessThanOrEqual(A4.h - A4.margin + 0.5);
    }
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) expect(overlaps(items[i], items[j])).toBe(false);
});

test('the document comes back after a reload', async ({ page }) => {
    await pasteImage(page);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await expect.poll(async () => (await allItems(page))[0].length).toBe(1);
    await page.waitForTimeout(700);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible();
    await expect.poll(async () => (await allItems(page))[0].length).toBe(1);
});
