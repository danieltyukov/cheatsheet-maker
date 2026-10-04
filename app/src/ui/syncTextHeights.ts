import { updateItems, type ItemPatch } from '../model/commands';
import type { Id, TextItem } from '../model/types';
import type { EditorStore } from './store';

export function syncTextHeights(store: EditorStore, measure: (item: TextItem) => number): boolean {
    const patches: Record<Id, ItemPatch> = {};
    for (const page of store.doc.pages) {
        for (const item of page.items) {
            if (item.kind !== 'text') continue;
            const h = measure(item);
            if (Math.abs(h - item.h) > 0.01) patches[item.id] = { h };
        }
    }
    if (Object.keys(patches).length === 0) return false;
    store.amendDoc((d) => updateItems(d, patches));
    return true;
}
