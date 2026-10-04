import { expect, test } from 'vitest';
import { syncTextHeights } from './syncTextHeights';
import { EditorStore } from './store';
import { addItems } from '../model/commands';
import { createDocument, createTextItem } from '../model/factory';

test('updates stale heights without an undo step', () => {
    const t = createTextItem({ x: 0, y: 0 }, { font: 'sans', fontSize: 10, color: '#000', background: null, align: 'left' }, 100, 'hello');
    const store = new EditorStore(createDocument('t', 0));
    store.apply((d) => addItems(d, 0, [t]));
    expect(syncTextHeights(store, () => 42)).toBe(true);
    expect(store.doc.pages[0].items[0].h).toBe(42);
    expect(syncTextHeights(store, () => 42)).toBe(false);
    store.undo();
    // The only undo step is the add; the height sync did not record one.
    expect(store.doc.pages[0].items).toHaveLength(0);
});
