import { expect, test } from 'vitest';
import { outlineToPath, shapeGeometry, strokeOutline } from './strokes';
import { createShapeItem, createStrokeItem } from '../model/factory';

test('stroke outlines are closed polygons and cached per item', () => {
    const s = createStrokeItem([0, 0, 0.5, 50, 0, 0.5, 100, 20, 0.5], 'pen', '#000', 6);
    const o = strokeOutline(s);
    expect(o.length).toBeGreaterThan(4);
    expect(strokeOutline(s)).toBe(o);
    const d = outlineToPath(o);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
});

test('shape geometry in local coordinates', () => {
    const style = { stroke: '#000', strokeWidth: 2, fill: null };
    expect(shapeGeometry(createShapeItem('rect', { x: 5, y: 5, w: 10, h: 20 }, style)).stroke).toBe('M0 0H10V20H0Z');
    const arrow = shapeGeometry(createShapeItem('arrow', { x: 0, y: 0, w: 100, h: 0 }, style));
    expect(arrow.head).not.toBeNull();
    expect(arrow.stroke).toMatch(/^M0 0L9\d(\.\d+)? 0$/); // shortened so it does not poke through the head
    expect(shapeGeometry(createShapeItem('ellipse', { x: 0, y: 0, w: 10, h: 10 }, { ...style, fill: '#fff' })).fill).toContain('C');
});
