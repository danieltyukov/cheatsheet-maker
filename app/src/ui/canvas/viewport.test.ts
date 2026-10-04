import { expect, test } from 'vitest';
import { clampView, fitWidth, pageAt, pageTops, toPagePoint, toScreen, toWorld, visiblePages, zoomAround } from './viewport';
import { DEFAULT_SETUP } from '../../model/factory';

const setup = { ...DEFAULT_SETUP, size: 'Letter' as const }; // 612 x 792

test('screen and world are inverse', () => {
    const v = { zoom: 2, scrollX: 10, scrollY: -5 };
    const p = toWorld(v, toScreen(v, { x: 33, y: 44 }));
    expect(p.x).toBeCloseTo(33);
    expect(p.y).toBeCloseTo(44);
});

test('pages stack with a gap and a point in the gap picks the nearer page', () => {
    expect(pageTops(setup, 3)).toEqual([0, 816, 1632]);
    expect(pageAt(setup, 3, { x: 10, y: 795 })).toEqual({ index: 0, inside: false });
    expect(pageAt(setup, 3, { x: 10, y: 812 })).toEqual({ index: 1, inside: false });
    expect(pageAt(setup, 3, { x: 10, y: 900 })).toEqual({ index: 1, inside: true });
    expect(pageAt(setup, 3, { x: 10, y: 99999 }).index).toBe(2);
    expect(toPagePoint(setup, 1, { x: 5, y: 900 })).toEqual({ x: 5, y: 84 });
});

test('only pages in the viewport are visible', () => {
    expect(visiblePages(setup, 5, { zoom: 1, scrollX: 0, scrollY: 750 }, 600, 100)).toEqual([0, 1]);
    expect(visiblePages(setup, 5, { zoom: 1, scrollX: 0, scrollY: 900 }, 600, 100)).toEqual([1]);
});

test('zooming keeps the point under the cursor still', () => {
    const v = { zoom: 1, scrollX: 0, scrollY: 0 };
    const screen = { x: 200, y: 150 };
    const before = toWorld(v, screen);
    const after = toWorld(zoomAround(v, 2, screen), screen);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(zoomAround(v, 1000, screen).zoom).toBe(8);
});

test('fit width centres the page', () => {
    const v = fitWidth(setup, 1000, 1);
    const left = toScreen(v, { x: 0, y: 0 }).x;
    const right = toScreen(v, { x: 612, y: 0 }).x;
    expect(left).toBeCloseTo(1000 - right);
    expect(toScreen(v, { x: 0, y: 816 }).y).toBeGreaterThan(0);
});

test('clampView centres content narrower than the viewport', () => {
    const v = clampView({ zoom: 0.5, scrollX: 500, scrollY: 0 }, setup, 1, 1000, 800);
    expect(toScreen(v, { x: 306, y: 0 }).x).toBeCloseTo(500);
});
