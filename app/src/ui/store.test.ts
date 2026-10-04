import { expect, test } from 'vitest';
import { EditorStore } from './store';
import { addItems, removeItems } from '../model/commands';
import { createDocument, createShapeItem } from '../model/factory';

const rect = () => createShapeItem('rect', { x: 0, y: 0, w: 10, h: 10 }, { stroke: '#000', strokeWidth: 1, fill: null });

test('apply records history, stamps updatedAt and notifies', () => {
    const store = new EditorStore(createDocument('t', 0));
    let calls = 0;
    store.subscribe(() => calls++);
    const r = rect();
    store.apply((d) => addItems(d, 0, [r]));
    expect(store.doc.pages[0].items).toHaveLength(1);
    expect(store.doc.updatedAt).toBeGreaterThan(0);
    expect(calls).toBeGreaterThan(0);
    store.undo();
    expect(store.doc.pages[0].items).toHaveLength(0);
});

test('selection drops ids that no longer exist after undo or edits', () => {
    const store = new EditorStore(createDocument('t', 0));
    const r = rect();
    store.apply((d) => addItems(d, 0, [r]));
    store.select([r.id]);
    store.apply((d) => removeItems(d, [r.id]));
    expect(store.getState().selection).toEqual([]);
});

test('a gesture is one undo step and cancel restores', () => {
    const store = new EditorStore(createDocument('t', 0));
    const r = rect();
    store.beginGesture();
    store.apply((d) => addItems(d, 0, [r]));
    store.apply((d) => d);
    store.endGesture();
    store.undo();
    expect(store.doc.pages[0].items).toHaveLength(0);
    store.beginGesture();
    store.apply((d) => addItems(d, 0, [rect()]));
    store.cancelGesture();
    expect(store.doc.pages[0].items).toHaveLength(0);
});

test('amendDoc does not add history', () => {
    const store = new EditorStore(createDocument('t', 0));
    store.amendDoc((d) => ({ ...d, title: 'derived' }));
    store.undo();
    expect(store.doc.title).toBe('derived');
});

test('replaceDocument resets history and selection', () => {
    const store = new EditorStore(createDocument('a', 0));
    store.apply((d) => addItems(d, 0, [rect()]));
    store.replaceDocument(createDocument('b', 0));
    expect(store.doc.title).toBe('b');
    store.undo();
    expect(store.doc.title).toBe('b');
});

test('toasts get ids and can be dismissed', () => {
    const store = new EditorStore(createDocument('a', 0));
    const id = store.toast('Hello');
    expect(store.getState().toasts).toHaveLength(1);
    store.dismissToast(id);
    expect(store.getState().toasts).toHaveLength(0);
});
