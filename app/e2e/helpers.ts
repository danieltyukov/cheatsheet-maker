import { expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url).pathname;

/** Fresh app, no saved documents, downloads instead of the save picker. */
export async function openApp(page: Page) {
    await page.addInitScript(() => {
        (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = undefined;
    });
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible();
}

export async function pasteImage(page: Page, file = 'photo.png') {
    const b64 = readFileSync(fixture(file)).toString('base64');
    await page.evaluate(async (data) => {
        const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        const dt = new DataTransfer();
        dt.items.add(new File([bytes], 'shot.png', { type: 'image/png' }));
        document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    }, b64);
}

export const itemsByPage = (page: Page) =>
    page.evaluate(() => (window as unknown as { __cm: { store: { doc: { pages: Array<{ items: Array<{ kind: string; x: number; y: number; w: number; h: number; text?: string }> }> } } } }).__cm.store.doc.pages.map((p) => p.items));

/** Screen position of a point in page 0 coordinates. */
export async function screenOf(page: Page, x: number, y: number) {
    return page.evaluate(([px, py]) => {
        const cm = (window as unknown as { __cm: { store: { getState(): { view: { zoom: number; scrollX: number; scrollY: number } } } } }).__cm;
        const v = cm.store.getState().view;
        const r = document.querySelector('.canvas-wrap canvas')!.getBoundingClientRect();
        return { x: r.left + (px - v.scrollX) * v.zoom, y: r.top + (py - v.scrollY) * v.zoom };
    }, [x, y]);
}

type Cm = {
    store: {
        doc: { setup: unknown; pages: Array<{ items: Array<Record<string, unknown>> }> };
        getState(): { view: { zoom: number; scrollX: number; scrollY: number }; selection: string[]; cropId: string | null };
    };
};

/** Every item on every page, as plain data. */
export const allItems = (page: Page) =>
    page.evaluate(() => (window as unknown as { __cm: Cm }).__cm.store.doc.pages.map((p) => p.items)) as Promise<
        Array<Array<{ id: string; kind: string; x: number; y: number; w: number; h: number; text?: string; crop?: { x: number; y: number; w: number; h: number } }>>
    >;

export const zoom = (page: Page) => page.evaluate(() => (window as unknown as { __cm: Cm }).__cm.store.getState().view.zoom);

export const editorState = (page: Page) =>
    page.evaluate(() => {
        const s = (window as unknown as { __cm: Cm }).__cm.store.getState();
        return { selection: s.selection, cropId: s.cropId };
    });

/** Screen point of the centre of an item on page 0. */
export async function centreOf(page: Page, item: { x: number; y: number; w: number; h: number }) {
    return screenOf(page, item.x + item.w / 2, item.y + item.h / 2);
}

export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 8) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps });
    await page.mouse.up();
}

export function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
    return a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;
}

export const A4 = { w: 595.2756, h: 841.8898, margin: 18 };

/**
 * Page count and first page size of a PDF. Read in a separate Node process because Playwright's
 * module loader cannot load pdf-lib's circular CommonJS build ("Unexpected module status 3").
 */
export function pdfInfo(file: string): { pages: number; width: number; height: number } {
    const script = `
        const { PDFDocument } = require('pdf-lib');
        PDFDocument.load(require('node:fs').readFileSync(process.argv[1])).then((pdf) => {
            const { width, height } = pdf.getPage(0).getSize();
            process.stdout.write(JSON.stringify({ pages: pdf.getPageCount(), width, height }));
        });`;
    return JSON.parse(execFileSync(process.execPath, ['-e', script, file], { encoding: 'utf8' }));
}
