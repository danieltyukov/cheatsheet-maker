import { describe, expect, test } from 'vitest';
import { applyFilters, filtersKey, findTrimRect, isIdentity, type RGBAImage } from './filters';
import { DEFAULT_FILTERS } from '../model/factory';

function image(width: number, height: number, fill: [number, number, number, number]): RGBAImage {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) data.set(fill, i);
    return { data, width, height };
}
function setPx(img: RGBAImage, x: number, y: number, px: [number, number, number, number]) {
    img.data.set(px, (y * img.width + x) * 4);
}
const px = (img: RGBAImage, x: number, y: number) => [...img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];

describe('applyFilters', () => {
    test('identity filters are detected and keyed', () => {
        expect(isIdentity(DEFAULT_FILTERS)).toBe(true);
        expect(isIdentity({ ...DEFAULT_FILTERS, invert: true })).toBe(false);
        expect(filtersKey(DEFAULT_FILTERS)).not.toBe(filtersKey({ ...DEFAULT_FILTERS, contrast: 1.2 }));
    });
    test('invert and grayscale', () => {
        const img = image(1, 1, [255, 0, 0, 255]);
        expect(px(applyFilters(img, { ...DEFAULT_FILTERS, invert: true }), 0, 0)).toEqual([0, 255, 255, 255]);
        expect(px(applyFilters(img, { ...DEFAULT_FILTERS, grayscale: true }), 0, 0)).toEqual([54, 54, 54, 255]);
        expect(px(img, 0, 0)).toEqual([255, 0, 0, 255]); // input untouched
    });
    test('contrast pushes values away from mid grey', () => {
        const out = applyFilters(image(1, 1, [100, 128, 200, 255]), { ...DEFAULT_FILTERS, contrast: 2 });
        expect(px(out, 0, 0)).toEqual([72, 128, 255, 255]);
    });
    test('white to transparent keeps ink and drops paper', () => {
        const img = image(3, 1, [255, 255, 255, 255]);
        setPx(img, 1, 0, [0, 0, 0, 255]);
        setPx(img, 2, 0, [250, 250, 250, 255]);
        const out = applyFilters(img, { ...DEFAULT_FILTERS, whiteToAlpha: 0.1 });
        expect(px(out, 0, 0)[3]).toBe(0);
        expect(px(out, 1, 0)).toEqual([0, 0, 0, 255]);
        expect(px(out, 2, 0)[3]).toBe(0);
    });
    test('with a zero-width range, grey composites back to itself over white', () => {
        const out = applyFilters(image(1, 1, [128, 128, 128, 255]), { ...DEFAULT_FILTERS, whiteToAlpha: 1e-9 });
        const [r, , , a] = px(out, 0, 0);
        expect((r * a) / 255 + 255 * (1 - a / 255)).toBeCloseTo(128, 0);
    });
});

describe('findTrimRect', () => {
    test('finds the content inside a uniform border', () => {
        const img = image(10, 8, [255, 255, 255, 255]);
        setPx(img, 3, 2, [0, 0, 0, 255]);
        setPx(img, 6, 5, [0, 0, 0, 255]);
        expect(findTrimRect(img, 24, 0)).toEqual({ x: 3, y: 2, w: 4, h: 4 });
        expect(findTrimRect(img, 24, 1)).toEqual({ x: 2, y: 1, w: 6, h: 6 });
    });
    test('works on transparent backgrounds and ignores faint noise', () => {
        const img = image(5, 5, [0, 0, 0, 0]);
        setPx(img, 2, 2, [10, 10, 10, 255]);
        expect(findTrimRect(img, 24, 0)).toEqual({ x: 2, y: 2, w: 1, h: 1 });
        const noisy = image(5, 5, [255, 255, 255, 255]);
        setPx(noisy, 1, 1, [250, 250, 250, 255]);
        expect(findTrimRect(noisy, 24, 0)).toBeNull();
    });
});
