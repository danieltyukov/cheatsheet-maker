import 'fake-indexeddb/auto';
import { describe, expect, test } from 'vitest';
import { MemoryLibrary, openIdbLibrary, type LibraryApi } from './library';
import { addAsset, addItems, removeItems } from '../model/commands';
import { createDocument, createImageItem } from '../model/factory';
import { sha256Hex } from '../model/hash';

const bytes = new Uint8Array([137, 80, 78, 71, 9, 9, 9]);

async function docWithImage(lib: LibraryApi) {
    const id = await lib.putAsset(bytes, 'image/png');
    const meta = { id, mime: 'image/png', width: 1, height: 1 };
    const img = createImageItem(meta, { x: 10, y: 10 }, 100, 100);
    return { doc: addAsset(addItems(createDocument('With image', 1), 0, [img]), meta), img, id };
}

describe.each([
    ['IndexedDB', () => openIdbLibrary(`test-${Math.random()}`)],
    ['memory', async () => new MemoryLibrary()],
])('%s library', (_name, open) => {
    test('stores, lists newest first and deletes documents', async () => {
        const lib = await open();
        const a = { ...createDocument('A', 1), updatedAt: 10 };
        const b = { ...createDocument('B', 1), updatedAt: 20 };
        await lib.put(a);
        await lib.put(b);
        expect((await lib.list()).map((d) => d.title)).toEqual(['B', 'A']);
        expect(await lib.get(a.id)).toEqual(a);
        await lib.remove(a.id);
        expect(await lib.get(a.id)).toBeNull();
    });
    test('assets are content addressed and garbage collected', async () => {
        const lib = await open();
        const { doc, img, id } = await docWithImage(lib);
        expect(id).toBe(await sha256Hex(bytes));
        expect(await lib.putAsset(bytes, 'image/png')).toBe(id);
        await lib.put(doc);
        expect(await lib.gc()).toBe(0);
        expect(await lib.getAssetBytes(id)).toEqual(bytes);
        await lib.put(removeItems(doc, [img.id]));
        expect(await lib.gc()).toBe(1);
        expect(await lib.getAsset(id)).toBeNull();
    });
    test('importing never overwrites an existing document', async () => {
        const lib = await open();
        const doc = createDocument('Mine', 1);
        await lib.put(doc);
        const imported = await lib.importDocument(doc, new Map());
        expect(imported.id).not.toBe(doc.id);
        expect((await lib.list())).toHaveLength(2);
    });
    test('meta values round trip', async () => {
        const lib = await open();
        await lib.setMeta('lastDoc', 'abc');
        expect(await lib.getMeta('lastDoc')).toBe('abc');
        expect(await lib.getMeta('missing')).toBeUndefined();
    });
});
