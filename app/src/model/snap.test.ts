import { expect, test } from 'vitest';
import { snapRect, snapTargets, snapValue } from './snap';
import { DEFAULT_SETUP } from './factory';

const setup = { ...DEFAULT_SETUP, size: 'Letter' as const, margin: 36, columns: 2, gutter: 20 };

test('targets include page edges, centre, margins, columns and other items', () => {
    const t = snapTargets(setup, [{ x: 100, y: 200, w: 50, h: 10 }]);
    for (const x of [0, 306, 612, 36, 576, 296, 316, 100, 125, 150]) expect(t.xs).toContain(x);
    for (const y of [0, 396, 792, 36, 756, 200, 205, 210]) expect(t.ys).toContain(y);
});

test('snapRect pulls the nearest edge or centre within the threshold', () => {
    const t = snapTargets(setup, []);
    const r = snapRect({ x: 39, y: 100.5, w: 100, h: 50 }, t, 5, 0);
    expect(r.dx).toBeCloseTo(-3);
    expect(r.guideX).toBe(36);
    expect(r.dy).toBe(0);
    expect(r.guideY).toBeNull();
    const centred = snapRect({ x: 254, y: 0, w: 100, h: 50 }, t, 5, 0);
    expect(centred.dx).toBeCloseTo(2);
    expect(centred.guideX).toBe(306);
});

test('the grid applies when no guide is close', () => {
    const r = snapRect({ x: 103, y: 110, w: 10, h: 10 }, { xs: [], ys: [] }, 2, 12);
    expect(r.dx).toBeCloseTo(5);
    expect(r.dy).toBeCloseTo(-2);
});

test('snapValue for a single edge', () => {
    expect(snapValue(98, [100], 3, 0)).toEqual({ value: 100, guide: 100 });
    expect(snapValue(90, [100], 3, 0)).toEqual({ value: 90, guide: null });
});
