import { expect, test } from 'vitest';
import { createDocument, createImageItem, createStrokeItem } from './factory';

test('a new document has one empty A4 page', () => {
    const doc = createDocument('Exam', 1000);
    expect(doc.version).toBe(1);
    expect(doc.title).toBe('Exam');
    expect(doc.createdAt).toBe(1000);
    expect(doc.pages).toHaveLength(1);
    expect(doc.pages[0].items).toEqual([]);
    expect(doc.setup.size).toBe('A4');
});

test('an image is placed at 96 DPI and shrunk to fit', () => {
    const asset = { id: 'a', mime: 'image/png', width: 400, height: 200 };
    const small = createImageItem(asset, { x: 300, y: 400 }, 1000, 1000);
    expect(small.w).toBe(300);
    expect(small.h).toBe(150);
    expect(small.x).toBe(150);
    expect(small.y).toBe(325);
    expect(small.crop).toEqual({ x: 0, y: 0, w: 400, h: 200 });
    const big = createImageItem(asset, { x: 0, y: 0 }, 100, 100);
    expect(big.w).toBe(100);
    expect(big.h).toBe(50);
});

test('a stroke stores points relative to its padded bounds', () => {
    const s = createStrokeItem([10, 20, 0.5, 30, 60, 0.5], 'pen', '#000000', 4);
    expect(s.x).toBe(8);
    expect(s.y).toBe(18);
    expect(s.w).toBe(24);
    expect(s.h).toBe(44);
    expect(s.points).toEqual([2, 2, 0.5, 22, 42, 0.5]);
});
