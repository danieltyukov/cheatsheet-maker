import { describe, expect, test } from 'vitest';
import {
    apply, boxBounds, boxFromLine, handleAt, hitItem, invert, itemMatrix, lineEndpoints, multiply,
    resizeBox, rotateBox, toLocal, unionRect,
} from './geometry';
import { createShapeItem, createStrokeItem } from './factory';
import type { Box, ImageItem } from './types';

const box = (x: number, y: number, w: number, h: number, rotation = 0): Box => ({ x, y, w, h, rotation });

function close(p: { x: number; y: number }, x: number, y: number) {
    expect(p.x).toBeCloseTo(x, 6);
    expect(p.y).toBeCloseTo(y, 6);
}

describe('matrices', () => {
    test('invert undoes the item matrix', () => {
        const m = itemMatrix(box(10, 20, 100, 50, 33));
        const p = apply(multiply(invert(m), m), { x: 7, y: 9 });
        close(p, 7, 9);
    });
    test('a 90 degree rotation turns the top-left corner about the centre', () => {
        // centre (60, 45); local (0,0) is (-50,-25) from centre; rotated 90 deg clockwise in y-down is (25,-50)
        close(apply(itemMatrix(box(10, 20, 100, 50, 90)), { x: 0, y: 0 }), 85, -5);
    });
    test('toLocal maps the centre to the middle of the box', () => {
        close(toLocal(box(10, 20, 100, 50, 45), { x: 60, y: 45 }), 50, 25);
    });
});

test('boxBounds of a box rotated 90 degrees swaps width and height', () => {
    const b = boxBounds(box(0, 0, 100, 50, 90));
    expect(b.x).toBeCloseTo(25);
    expect(b.y).toBeCloseTo(-25);
    expect(b.w).toBeCloseTo(50);
    expect(b.h).toBeCloseTo(100);
});

test('unionRect', () => {
    expect(unionRect([])).toBeNull();
    expect(unionRect([{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 5, w: 5, h: 20 }])).toEqual({ x: 0, y: 0, w: 25, h: 25 });
});

describe('hitItem', () => {
    const img = { ...box(0, 0, 100, 20, 90), id: 'i', kind: 'image' } as ImageItem;
    test('respects rotation', () => {
        expect(hitItem(img, { x: 50, y: 10 }, 0)).toBe(true); // centre
        expect(hitItem(img, { x: 5, y: 10 }, 0)).toBe(false); // inside the unrotated box only
        expect(hitItem(img, { x: 50, y: -35 }, 0)).toBe(true); // inside the rotated box only
    });
    test('strokes hit near their path, not in empty bounds', () => {
        const s = createStrokeItem([0, 0, 0.5, 100, 0, 0.5, 100, 100, 0.5], 'pen', '#000', 4);
        expect(hitItem(s, { x: 50, y: 1 }, 2)).toBe(true);
        expect(hitItem(s, { x: 20, y: 80 }, 2)).toBe(false);
    });
    test('lines hit near the segment', () => {
        const l = createShapeItem('line', { x: 0, y: 0, w: 100, h: 100 }, { stroke: '#000', strokeWidth: 2, fill: null });
        expect(hitItem(l, { x: 50, y: 51 }, 2)).toBe(true);
        expect(hitItem(l, { x: 90, y: 10 }, 2)).toBe(false);
    });
});

describe('resizeBox', () => {
    test('dragging the east handle grows the width and keeps the west edge', () => {
        expect(resizeBox(box(10, 10, 100, 50), 'e', { x: 20, y: 999 }, false)).toEqual(box(10, 10, 120, 50));
    });
    test('dragging the north-west handle with aspect lock keeps the ratio', () => {
        const r = resizeBox(box(0, 0, 100, 50), 'nw', { x: -50, y: 0 }, true);
        expect(r.w).toBeCloseTo(150);
        expect(r.h).toBeCloseTo(75);
        expect(r.x + r.w).toBeCloseTo(100);
        expect(r.y + r.h).toBeCloseTo(50);
    });
    test('never shrinks below the minimum size', () => {
        const r = resizeBox(box(0, 0, 100, 50), 'w', { x: 500, y: 0 }, false, 4);
        expect(r.w).toBe(4);
        expect(r.x).toBe(96);
    });
    test('on a rotated box the opposite edge stays fixed in page space', () => {
        const start = box(0, 0, 100, 50, 90);
        // local east edge points down the page after a 90 degree rotation, so drag down
        const r = resizeBox(start, 'e', { x: 0, y: 20 }, false);
        expect(r.w).toBeCloseTo(120);
        const before = apply(itemMatrix(start), { x: 0, y: 25 });
        const after = apply(itemMatrix(r), { x: 0, y: 25 });
        close(after, before.x, before.y);
    });
});

test('rotateBox measures the angle around the centre and snaps to 15 degrees', () => {
    const b = box(0, 0, 100, 100);
    expect(rotateBox(b, { x: 50, y: -10 }, { x: 110, y: 50 }, false)).toBeCloseTo(90);
    expect(rotateBox(b, { x: 50, y: -10 }, { x: 100, y: 10 }, true) % 15).toBeCloseTo(0);
});

test('handleAt finds corners and the rotate handle in page space', () => {
    const item = { ...box(0, 0, 100, 50), id: 'x', kind: 'image' } as ImageItem;
    expect(handleAt(item, { x: 100, y: 50 }, 4, 20)).toBe('se');
    expect(handleAt(item, { x: 50, y: -20 }, 4, 20)).toBe('rotate');
    expect(handleAt(item, { x: 50, y: 25 }, 4, 20)).toBeNull();
});

test('lines expose endpoints and rebuild their box from them', () => {
    const l = createShapeItem('arrow', { x: 0, y: 0, w: 10, h: 10 }, { stroke: '#000', strokeWidth: 1, fill: null }, true, false);
    const [a, b] = lineEndpoints(l);
    expect(a).toEqual({ x: 10, y: 0 });
    expect(b).toEqual({ x: 0, y: 10 });
    expect(boxFromLine({ x: 30, y: 5 }, { x: 10, y: 25 })).toEqual({ x: 10, y: 5, w: 20, h: 20, rotation: 0, flipX: true, flipY: false });
});
