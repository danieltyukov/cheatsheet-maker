import { expect, test } from 'vitest';
import { alignItems, distributeItems } from './layout';
import { addItems } from './commands';
import { createDocument, createShapeItem } from './factory';

const sq = (x: number, y: number, w = 10) => createShapeItem('rect', { x, y, w, h: w }, { stroke: '#000', strokeWidth: 1, fill: null });

test('align left lines items up with the leftmost one', () => {
    const [a, b] = [sq(10, 0), sq(50, 40)];
    const doc = alignItems(addItems(createDocument('t', 0), 0, [a, b]), [a.id, b.id], 'left');
    expect(doc.pages[0].items.map((i) => i.x)).toEqual([10, 10]);
});

test('a single item aligns to the printable area', () => {
    const a = sq(100, 100);
    const doc = alignItems(addItems(createDocument('t', 0), 0, [a]), [a.id], 'right');
    expect(doc.pages[0].items[0].x + 10).toBeCloseTo(595.2756 - 18);
});

test('distribute spaces three items evenly', () => {
    const [a, b, c] = [sq(0, 0), sq(15, 0), sq(90, 0)];
    const doc = distributeItems(addItems(createDocument('t', 0), 0, [a, b, c]), [a.id, b.id, c.id], 'h');
    expect(doc.pages[0].items.map((i) => i.x)).toEqual([0, 45, 90]);
});
