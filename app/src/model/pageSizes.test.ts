import { describe, expect, test } from 'vitest';
import { columnGuides, pageDimensions, printableArea } from './pageSizes';
import { DEFAULT_SETUP } from './factory';

describe('pageDimensions', () => {
    test('A4 portrait is 210 x 297 mm in points', () => {
        const d = pageDimensions({ size: 'A4', orientation: 'portrait' });
        expect(d.w).toBeCloseTo(595.2756, 3);
        expect(d.h).toBeCloseTo(841.8898, 3);
    });
    test('landscape swaps the sides', () => {
        expect(pageDimensions({ size: 'Letter', orientation: 'landscape' })).toEqual({ w: 792, h: 612 });
    });
});

test('printableArea removes the margin on every side', () => {
    const a = printableArea({ ...DEFAULT_SETUP, size: 'Letter', margin: 36 });
    expect(a).toEqual({ x: 36, y: 36, w: 540, h: 720 });
});

test('columnGuides gives both edges of every gutter', () => {
    const setup = { ...DEFAULT_SETUP, size: 'Letter' as const, margin: 36, columns: 2, gutter: 20 };
    // printable width 540, column width (540 - 20) / 2 = 260
    expect(columnGuides(setup)).toEqual([296, 316]);
    expect(columnGuides({ ...setup, columns: 1 })).toEqual([]);
});
