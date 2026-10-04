import { beforeEach, expect, test } from 'vitest';
import { GestureController, type PointerInfo } from './gestures';
import { EditorStore } from '../store';
import { EditorAssets } from '../editorAssets';
import { addItems } from '../../model/commands';
import { createDocument, createShapeItem } from '../../model/factory';

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
