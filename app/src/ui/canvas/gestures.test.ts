import { beforeEach, expect, test } from 'vitest';
import { GestureController, type PointerInfo } from './gestures';
import { EditorStore } from '../store';
import { EditorAssets } from '../editorAssets';
import { addItems } from '../../model/commands';
import { createDocument, createShapeItem, createTextItem } from '../../model/factory';

let store: EditorStore;
let ctrl: GestureController;
const rect = createShapeItem('rect', { x: 100, y: 100, w: 50, h: 50 }, { stroke: '#000', strokeWidth: 1, fill: null });

const ptr = (x: number, y: number, o: Partial<PointerInfo> = {}): PointerInfo => ({
    id: 1, x, y, button: 0, pointerType: 'mouse', pressure: 0.5, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, ...o,
});

beforeEach(() => {
    store = new EditorStore(addItems(createDocument('t', 0), 0, [rect]), { view: { zoom: 1, scrollX: 0, scrollY: 0 } });
    const assets = new EditorAssets(async () => null, () => {});
    ctrl = new GestureController(store, assets, () => ({ w: 800, h: 600 }), () => {});
});

test('click selects, drag moves as one undo step with snapping', () => {
    ctrl.down(ptr(120, 120));
    expect(store.getState().selection).toEqual([rect.id]);
    ctrl.move(ptr(150, 140));
    ctrl.move(ptr(181, 160));
    ctrl.up(ptr(181, 160));
    const moved = store.doc.pages[0].items[0];
    expect(moved.y).toBe(140);
    store.undo();
    expect(store.doc.pages[0].items[0].x).toBe(100);
});

test('a click without movement records no history', () => {
    ctrl.down(ptr(120, 120));
    ctrl.up(ptr(120, 120));
    store.undo();
    expect(store.doc.pages[0].items).toHaveLength(1);
});

test('dragging empty space draws a marquee', () => {
    ctrl.down(ptr(90, 90));
    ctrl.move(ptr(160, 160));
    expect(store.getState().selection).toEqual([rect.id]);
    ctrl.up(ptr(160, 160));
    expect(ctrl.marquee).toBeNull();
});

test('cancel mid-drag restores the start', () => {
    ctrl.down(ptr(120, 120));
    ctrl.move(ptr(200, 200));
    ctrl.cancel();
    expect(store.doc.pages[0].items[0].x).toBe(100);
});

test('pen strokes become one item', () => {
    store.setTool('pen');
    ctrl.down(ptr(10, 10));
    ctrl.move(ptr(20, 15));
    ctrl.move(ptr(30, 25));
    ctrl.up(ptr(30, 25));
    expect(store.doc.pages[0].items.at(-1)?.kind).toBe('stroke');
});

test('a small selected item moves instead of resizing from a handle', () => {
    const small = createShapeItem('rect', { x: 300, y: 300, w: 10, h: 10 }, { stroke: '#000', strokeWidth: 1, fill: null });
    store.apply((d) => addItems(d, 0, [small]));
    store.select([small.id]);
    ctrl.down(ptr(305, 305));
    ctrl.move(ptr(330, 305));
    ctrl.up(ptr(330, 305));
    const out = store.doc.pages[0].items.find((i) => i.id === small.id)!;
    expect(out.x).toBeCloseTo(325);
    expect(out.w).toBe(10);
});

test('a text box can be dragged from the middle of its top edge', () => {
    const t = createTextItem({ x: 100, y: 400 }, { font: 'sans', fontSize: 10, color: '#000', background: null, align: 'left' }, 200, 'hello');
    store.apply((d) => addItems(d, 0, [t]));
    store.select([t.id]);
    ctrl.down(ptr(200, 401));
    ctrl.move(ptr(200, 441));
    ctrl.up(ptr(200, 441));
    expect(store.doc.pages[0].items.find((i) => i.id === t.id)!.y).toBeCloseTo(440);
});

test('Escape during a drag puts everything back and records nothing', () => {
    ctrl.down(ptr(120, 120));
    ctrl.move(ptr(200, 200));
    expect(ctrl.key({ key: 'Escape' })).toBe(true);
    ctrl.move(ptr(220, 220));
    ctrl.up(ptr(220, 220));
    expect(store.doc.pages[0].items[0].x).toBe(100);
    expect(store.getState().history.past).toHaveLength(0);
    expect(ctrl.key({ key: 'Escape' })).toBe(false);
});

test('a cancelled touch does not leave a ghost pointer behind', () => {
    store.setTool('pen');
    ctrl.down(ptr(10, 10, { id: 7, pointerType: 'touch' }));
    ctrl.move(ptr(20, 15, { id: 7, pointerType: 'touch' }));
    ctrl.cancel(7);
    ctrl.down(ptr(40, 40, { id: 8, pointerType: 'touch' }));
    ctrl.move(ptr(60, 50, { id: 8, pointerType: 'touch' }));
    ctrl.up(ptr(60, 50, { id: 8, pointerType: 'touch' }));
    expect(store.doc.pages[0].items.filter((i) => i.kind === 'stroke')).toHaveLength(1);
});
