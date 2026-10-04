import { expect, test } from 'vitest';
import { effectiveDpi, printCheck } from './printCheck';
import { addItems } from './commands';
import { createDocument, createImageItem, createTextItem } from './factory';

test('effective DPI is source pixels per inch on paper', () => {
    const img = { ...createImageItem({ id: 'a', mime: 'image/png', width: 300, height: 300 }, { x: 0, y: 0 }, 1e6, 1e6), w: 72, h: 144 };
    expect(effectiveDpi(img)).toBe(150);
});

test('flags blurry images and tiny text, nothing else', () => {
    const blurry = { ...createImageItem({ id: 'a', mime: 'image/png', width: 100, height: 100 }, { x: 0, y: 0 }, 1e6, 1e6), w: 144, h: 144 };
    const sharp = createImageItem({ id: 'b', mime: 'image/png', width: 1000, height: 1000 }, { x: 0, y: 0 }, 100, 100);
    const style = { font: 'sans' as const, color: '#000', background: null, align: 'left' as const };
    const tiny = createTextItem({ x: 0, y: 0 }, { ...style, fontSize: 4 }, 50, 'x');
    const fine = createTextItem({ x: 0, y: 0 }, { ...style, fontSize: 8 }, 50, 'x');
    const issues = printCheck(addItems(createDocument('t', 0), 0, [blurry, sharp, tiny, fine]));
    expect(issues.map((i) => [i.itemId, i.kind])).toEqual([[blurry.id, 'low-dpi'], [tiny.id, 'small-text']]);
    expect(issues[0].message).toContain('50 DPI');
});
