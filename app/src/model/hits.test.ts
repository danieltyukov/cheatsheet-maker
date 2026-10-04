import { expect, test } from 'vitest';
import { itemsInRect, strokesTouched, topItemAt } from './hits';
import { createShapeItem, createStrokeItem } from './factory';

const sq = (x: number) => createShapeItem('rect', { x, y: 0, w: 10, h: 10 }, { stroke: '#000', strokeWidth: 1, fill: null });

test('the top item wins', () => {
    const [a, b] = [sq(0), sq(5)];
    expect(topItemAt([a, b], { x: 7, y: 5 }, 0)?.id).toBe(b.id);
    expect(topItemAt([a, b], { x: 50, y: 5 }, 0)).toBeNull();
});

test('marquee selects intersecting items', () => {
    const [a, b] = [sq(0), sq(100)];
    expect(itemsInRect([a, b], { x: 8, y: 8, w: 5, h: 5 }).map((i) => i.id)).toEqual([a.id]);
});

test('the eraser finds strokes along its path only', () => {
    const s = createStrokeItem([0, 50, 0.5, 100, 50, 0.5], 'pen', '#000', 2);
    const r = sq(0);
    expect(strokesTouched([s, r], { x: 50, y: 0 }, { x: 50, y: 100 }, 3)).toEqual([s.id]);
    expect(strokesTouched([s], { x: 0, y: 0 }, { x: 100, y: 0 }, 3)).toEqual([]);
});
