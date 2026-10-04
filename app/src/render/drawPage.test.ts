import { beforeAll, expect, test } from 'vitest';
import { drawPage } from './drawPage';
import { FakePath2D, recordingContext } from '../test/recordingContext';
import { createImageItem, createShapeItem, createStrokeItem, createTextItem, createPage, DEFAULT_SETUP } from '../model/factory';
import type { RenderAssets } from './drawPage';

beforeAll(() => {
    (globalThis as { Path2D?: unknown }).Path2D = FakePath2D;
});

const bitmap = { width: 4, height: 4 } as unknown as CanvasImageSource;
const assets: RenderAssets = {
    image: () => bitmap,
    textLayout: () => ({ runs: [{ kind: 'text', x: 1, baseline: 9, text: 'hi', font: { family: 'sans', size: 10, bold: false, italic: false } }], height: 12 }),
    math: () => null,
};

test('draws the page, then items in z order, honouring crop and padding', () => {
    const img = { ...createImageItem({ id: 'a', mime: 'image/png', width: 4, height: 4 }, { x: 50, y: 50 }, 100, 100), crop: { x: 1, y: 1, w: 2, h: 2 } };
    const text = createTextItem({ x: 0, y: 0 }, { font: 'sans', fontSize: 10, color: '#000', background: '#ff0', align: 'left' }, 50, 'hi');
    const ctx = recordingContext();
    drawPage(ctx, { ...createPage(), items: [img, text] }, DEFAULT_SETUP, assets);
    const names = ctx.calls.map((c) => c[0]);
    expect(names[0]).toBe('set:fillStyle');
    expect(names[1]).toBe('fillRect');
    const draw = ctx.calls.find((c) => c[0] === 'drawImage')!;
    expect(draw.slice(1)).toEqual([bitmap, 1, 1, 2, 2, 0, 0, img.w, img.h]);
    const fillText = ctx.calls.find((c) => c[0] === 'fillText')!;
    expect(fillText.slice(1)).toEqual(['hi', 1 + text.padding, 9 + text.padding]);
    expect(names.indexOf('drawImage')).toBeLessThan(names.indexOf('fillText'));
});

test('hidden items are skipped and guides only drawn on request', () => {
    const s = createShapeItem('rect', { x: 0, y: 0, w: 5, h: 5 }, { stroke: '#000', strokeWidth: 1, fill: null });
    const ctx = recordingContext();
    drawPage(ctx, { ...createPage(), items: [s] }, DEFAULT_SETUP, assets, { hidden: new Set([s.id]) });
    expect(ctx.calls.some((c) => c[0] === 'stroke')).toBe(false);
    const guided = recordingContext();
    drawPage(guided, createPage(), DEFAULT_SETUP, assets, { guides: true });
    expect(guided.calls.some((c) => c[0] === 'setLineDash')).toBe(true);
});

test('highlighter strokes multiply', () => {
    const h = createStrokeItem([0, 0, 0.5, 40, 0, 0.5], 'highlighter', '#ffd43b80', 12);
    const ctx = recordingContext();
    drawPage(ctx, { ...createPage(), items: [h] }, DEFAULT_SETUP, assets);
    expect(ctx.calls).toContainEqual(['set:globalCompositeOperation', 'multiply']);
});
