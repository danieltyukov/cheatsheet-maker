import { describe, expect, test } from 'vitest';
import { packPage } from './layout';
import { addItems } from './commands';
import { createDocument, createImageItem, createShapeItem, createStrokeItem, createTextItem } from './factory';
import { boxBounds, rectContains, rectsIntersect } from './geometry';
import { printableArea } from './pageSizes';
import type { Item } from './types';

const asset = (w: number, h: number) => ({ id: `a${w}x${h}`, mime: 'image/png', width: w, height: h });
const area = printableArea(createDocument('t', 0).setup);

function noOverlap(items: Item[]) {
    for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++)
            expect(rectsIntersect(boxBounds(items[i]), boxBounds(items[j]))).toBe(false);
}

describe('packPage fit', () => {
    test('scales everything up to fill the printable area', () => {
        const a = createImageItem(asset(100, 100), { x: 100, y: 100 }, 1e6, 1e6);
        const b = createImageItem(asset(200, 100), { x: 300, y: 300 }, 1e6, 1e6);
        const doc = packPage(addItems(createDocument('t', 0), 0, [a, b]), 0, null, 'fit', 4);
        const items = doc.pages[0].items;
        for (const i of items) expect(rectContains(area, boxBounds(i), 0.01)).toBe(true);
        noOverlap(items);
        expect(items[0].w).toBeGreaterThan(a.w * 2);
        expect(items[0].w / items[0].h).toBeCloseTo(1);
    });
    test('an annotation inside an item moves and scales with it', () => {
        const a = createImageItem(asset(100, 100), { x: 300, y: 300 }, 1e6, 1e6);
        const s = createStrokeItem([a.x + 10, a.y + 10, 0.5, a.x + 30, a.y + 30, 0.5], 'pen', '#000', 2);
        const doc = packPage(addItems(createDocument('t', 0), 0, [a, s]), 0, null, 'fit', 4);
        const [img, stroke] = doc.pages[0].items;
        expect(rectContains(boxBounds(img), boxBounds(stroke), 0.01)).toBe(true);
        expect(stroke.w).toBeGreaterThan(s.w * 2);
    });
    test('text scales its font size', () => {
        const t = createTextItem({ x: 0, y: 0 }, { font: 'sans', fontSize: 10, color: '#000', background: null, align: 'left' }, 100, 'x');
        const doc = packPage(addItems(createDocument('t', 0), 0, [t]), 0, null, 'fit', 4);
        const out = doc.pages[0].items[0];
        expect(out.kind === 'text' && out.fontSize).toBeGreaterThan(20);
    });
});

describe('packPage arrange', () => {
    test('keeps sizes and spills onto a new page after the current one', () => {
        const items = [0, 1, 2].map(() => createImageItem(asset(533, 533), { x: 200, y: 200 }, 1e6, 1e6)); // 400 pt squares
        const base = addItems(createDocument('t', 0), 0, items);
        const doc = packPage(base, 0, null, 'arrange', 4);
        expect(doc.pages).toHaveLength(2);
        expect(doc.pages[0].items).toHaveLength(2);
        expect(doc.pages[1].items).toHaveLength(1);
        expect(doc.pages[0].items[0].w).toBeCloseTo(items[0].w);
        noOverlap(doc.pages[0].items);
    });
    test('locked items, lines and unselected items stay where they are', () => {
        const a = createImageItem(asset(100, 100), { x: 300, y: 300 }, 1e6, 1e6);
        const locked = { ...createImageItem(asset(100, 100), { x: 400, y: 600 }, 1e6, 1e6), locked: true };
        const line = createShapeItem('line', { x: 5, y: 5, w: 50, h: 0 }, { stroke: '#000', strokeWidth: 1, fill: null });
        const other = createImageItem(asset(50, 50), { x: 100, y: 700 }, 1e6, 1e6);
        const doc = packPage(addItems(createDocument('t', 0), 0, [a, locked, line, other]), 0, [a.id], 'arrange', 4);
        const [na, nl, nline, nother] = doc.pages[0].items;
        expect(na.x).toBeCloseTo(area.x);
        expect(nl).toBe(locked);
        expect(nline).toBe(line);
        expect(nother).toBe(other);
    });
    test('a page with nothing to pack is returned unchanged', () => {
        const doc = createDocument('t', 0);
        expect(packPage(doc, 0, null, 'fit', 4)).toBe(doc);
    });
});
