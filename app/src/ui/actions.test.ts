import 'fake-indexeddb/auto';
import { beforeEach, expect, test, vi } from 'vitest';
import { Actions } from './actions';
import { EditorStore } from './store';
import { EditorAssets } from './editorAssets';
import { MemoryLibrary } from '../storage/library';
import { addItems } from '../model/commands';
import { createDocument, createShapeItem } from '../model/factory';
import type { Platform } from '../platform';

const platform: Platform = {
    kind: 'web',
    saveFile: vi.fn(async () => 'saved' as const),
    pickFiles: vi.fn(async () => []),
    readLegacyAutosave: async () => null,
};

let store: EditorStore;
let actions: Actions;
const sq = (x: number) => createShapeItem('rect', { x, y: 0, w: 10, h: 10 }, { stroke: '#000', strokeWidth: 1, fill: null });

beforeEach(() => {
    store = new EditorStore(addItems(createDocument('t', 0), 0, [sq(0), sq(50)]));
    actions = new Actions(store, new EditorAssets(async () => null, () => {}), new MemoryLibrary(), platform);
});

test('copy and paste duplicates with new ids and an offset', () => {
    const [a] = store.doc.pages[0].items;
    store.select([a.id]);
    actions.copy();
    actions.paste();
    const items = store.doc.pages[0].items;
    expect(items).toHaveLength(3);
    expect(items[2].id).not.toBe(a.id);
    expect(items[2].x).toBe(12);
    expect(store.getState().selection).toEqual([items[2].id]);
});

test('cut removes and paste brings it back', () => {
    const [a] = store.doc.pages[0].items;
    store.select([a.id]);
    actions.cut();
    expect(store.doc.pages[0].items).toHaveLength(1);
    actions.paste();
    expect(store.doc.pages[0].items).toHaveLength(2);
});

test('pasting plain text creates a text box on the current page', () => {
    actions.pasteText('E = mc^2');
    const last = store.doc.pages[0].items.at(-1)!;
    expect(last).toMatchObject({ kind: 'text', text: 'E = mc^2' });
});

test('nudge, select all, delete', () => {
    actions.selectAll();
    expect(store.getState().selection).toHaveLength(2);
    actions.nudge(10, 0);
    expect(store.doc.pages[0].items.map((i) => i.x)).toEqual([10, 60]);
    actions.deleteSelection();
    expect(store.doc.pages[0].items).toHaveLength(0);
});

test('locked items are not nudged or deleted', () => {
    const [a] = store.doc.pages[0].items;
    store.select([a.id]);
    actions.toggleLock();
    actions.nudge(5, 5);
    actions.deleteSelection();
    expect(store.doc.pages[0].items[0]).toMatchObject({ x: 0, locked: true });
});

test('saving a .cheatsheet hands a zip to the platform', async () => {
    await actions.saveCheatsheet();
    expect(platform.saveFile).toHaveBeenCalledWith('t.cheatsheet', expect.any(Blob), 'cheatsheet');
});

test('a corrupt .cheatsheet is reported and nothing opens', async () => {
    const open = vi.fn();
    actions.onOpenDocument = open;
    await actions.importFiles([new File([new Uint8Array([1, 2, 3])], 'broken.cheatsheet')]);
    expect(open).not.toHaveBeenCalled();
    expect(store.getState().toasts.at(-1)).toMatchObject({ kind: 'error' });
});

test('pasted text stays inside the printable area', () => {
    actions.pasteText('x'.repeat(10));
    const t = store.doc.pages[0].items.at(-1)!;
    expect(t.kind).toBe('text');
    expect(t.x).toBeGreaterThanOrEqual(18);
    expect(t.x + t.w).toBeLessThanOrEqual(595.2756 - 18 + 1e-6);
});
