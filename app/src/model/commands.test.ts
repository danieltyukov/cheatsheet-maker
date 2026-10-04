import { describe, expect, test } from 'vitest';
import {
    addAsset, addItems, addPage, duplicateItems, duplicatePage, findItem, movePage, moveItemsToPage,
    pruneAssets, referencedAssetIds, removeItems, removePage, reorderItems, setBoxes, setSetup,
    translateItems, updateItems,
} from './commands';
import { createDocument, createImageItem, createShapeItem, createStrokeItem } from './factory';
import type { CheatDocument, Item } from './types';

const asset = { id: 'h1', mime: 'image/png', width: 100, height: 100 };

function docWith(...items: Item[]): CheatDocument {
    return addItems(createDocument('t', 0), 0, items);
}

const rect = (x: number) => createShapeItem('rect', { x, y: 0, w: 10, h: 10 }, { stroke: '#000', strokeWidth: 1, fill: null });

describe('items', () => {
    test('add, find and remove', () => {
        const a = rect(0);
        const doc = docWith(a);
        expect(findItem(doc, a.id)).toEqual({ pageIndex: 0, index: 0, item: a });
        expect(removeItems(doc, [a.id]).pages[0].items).toEqual([]);
    });
    test('commands do not mutate their input and return the same object on no-op', () => {
        const a = rect(0);
        const doc = docWith(a);
        const moved = translateItems(doc, [a.id], 5, 6);
        expect(doc.pages[0].items[0].x).toBe(0);
        expect(moved.pages[0].items[0]).toMatchObject({ x: 5, y: 6 });
        expect(removeItems(doc, ['missing'])).toBe(doc);
        expect(translateItems(doc, [a.id], 0, 0)).toBe(doc);
    });
    test('updateItems patches fields but never id or kind', () => {
        const a = rect(0);
        const doc = updateItems(docWith(a), { [a.id]: { stroke: '#ff0000', id: 'evil', kind: 'image' } as never });
        expect(doc.pages[0].items[0]).toMatchObject({ id: a.id, kind: 'shape', stroke: '#ff0000' });
    });
    test('setBoxes rescales stroke points', () => {
        const s = createStrokeItem([0, 0, 0.5, 10, 10, 0.5], 'pen', '#000', 2);
        const doc = setBoxes(docWith(s), { [s.id]: { x: s.x, y: s.y, w: s.w * 2, h: s.h * 2, rotation: 0 } });
        const out = doc.pages[0].items[0];
        expect(out.kind === 'stroke' && out.points).toEqual([2, 2, 0.5, 22, 22, 0.5]);
    });
    test('reorder forward, backward, front and back', () => {
        const [a, b, c] = [rect(0), rect(1), rect(2)];
        const doc = docWith(a, b, c);
        const ids = (d: CheatDocument) => d.pages[0].items.map((i) => i.id);
        expect(ids(reorderItems(doc, [a.id], 'forward'))).toEqual([b.id, a.id, c.id]);
        expect(ids(reorderItems(doc, [c.id], 'backward'))).toEqual([a.id, c.id, b.id]);
        expect(ids(reorderItems(doc, [a.id], 'front'))).toEqual([b.id, c.id, a.id]);
        expect(ids(reorderItems(doc, [b.id, c.id], 'back'))).toEqual([b.id, c.id, a.id]);
        expect(reorderItems(doc, [c.id], 'front')).toBe(doc);
    });
    test('duplicate gives new ids, an offset and puts copies on top', () => {
        const a = rect(0);
        const { doc, ids } = duplicateItems(docWith(a), [a.id]);
        expect(ids).toHaveLength(1);
        expect(ids[0]).not.toBe(a.id);
        expect(doc.pages[0].items[1]).toMatchObject({ id: ids[0], x: 12, y: 12 });
    });
    test('moveItemsToPage moves and offsets', () => {
        const a = rect(0);
        const doc = moveItemsToPage(addPage(docWith(a)), [a.id], 1, 0, -100);
        expect(doc.pages[0].items).toEqual([]);
        expect(doc.pages[1].items[0]).toMatchObject({ id: a.id, y: -100 });
    });
});

describe('pages', () => {
    test('remove keeps at least one page', () => {
        const doc = createDocument('t', 0);
        expect(removePage(doc, 0)).toBe(doc);
        expect(removePage(addPage(doc), 0).pages).toHaveLength(1);
    });
    test('duplicatePage copies items with fresh ids after the original', () => {
        const a = rect(0);
        const doc = duplicatePage(docWith(a), 0);
        expect(doc.pages).toHaveLength(2);
        expect(doc.pages[1].id).not.toBe(doc.pages[0].id);
        expect(doc.pages[1].items[0].id).not.toBe(a.id);
    });
    test('movePage reorders', () => {
        const doc = addPage(addPage(createDocument('t', 0)));
        const ids = doc.pages.map((p) => p.id);
        expect(movePage(doc, 0, 2).pages.map((p) => p.id)).toEqual([ids[1], ids[2], ids[0]]);
    });
    test('setSetup merges', () => {
        expect(setSetup(createDocument('t', 0), { orientation: 'landscape' }).setup.orientation).toBe('landscape');
    });
});

test('assets are referenced by image items and pruned when unused', () => {
    const img = createImageItem(asset, { x: 0, y: 0 }, 100, 100);
    const doc = addAsset(addAsset(docWith(img), asset), { ...asset, id: 'h2' });
    expect([...referencedAssetIds(doc)]).toEqual(['h1']);
    expect(Object.keys(pruneAssets(doc).assets)).toEqual(['h1']);
});
