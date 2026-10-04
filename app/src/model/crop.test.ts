import { expect, test } from 'vitest';
import { cropDrag, fullImageRect } from './crop';
import { createImageItem } from './factory';
import { apply, itemMatrix } from './geometry';

const img = { width: 400, height: 200 };
// 2 pt per source pixel, cropped to the middle 100 x 100 pixels
const start = { ...createImageItem({ id: 'a', ...img, mime: 'image/png' }, { x: 0, y: 0 }, 1e6, 1e6), x: 0, y: 0, w: 200, h: 200, crop: { x: 100, y: 50, w: 100, h: 100 } };

test('dragging the east handle reveals more image at the same scale', () => {
    const out = cropDrag(start, 'e', { x: 20, y: 0 }, img);
    expect(out.crop).toEqual({ x: 100, y: 50, w: 110, h: 100 });
    expect(out.w).toBeCloseTo(220);
    expect(out.x).toBeCloseTo(0);
});

test('crop edges stop at the image border', () => {
    expect(cropDrag(start, 'w', { x: -1000, y: 0 }, img).crop.x).toBe(0);
    expect(cropDrag(start, 'e', { x: 1000, y: 0 }, img).crop.w).toBe(300);
    expect(cropDrag(start, 'n', { x: 0, y: 1000 }, img).crop.h).toBe(4);
});

test('panning moves the image under a fixed frame', () => {
    const out = cropDrag(start, 'pan', { x: -20, y: 0 }, img);
    expect(out.crop).toEqual({ x: 110, y: 50, w: 100, h: 100 });
    expect([out.x, out.y, out.w, out.h]).toEqual([0, 0, 200, 200]);
    expect(cropDrag(start, 'pan', { x: 10000, y: 0 }, img).crop.x).toBe(0);
});

test('the opposite edge stays put on a rotated image', () => {
    const rotated = { ...start, rotation: 90 };
    const out = cropDrag(rotated, 'e', { x: 20, y: 0 }, img);
    const before = apply(itemMatrix(rotated), { x: 0, y: 100 });
    const after = apply(itemMatrix(out), { x: 0, y: 100 });
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
});

test('fullImageRect places the whole source around the crop', () => {
    expect(fullImageRect(start, img)).toEqual({ x: -200, y: -100, w: 800, h: 400 });
});
