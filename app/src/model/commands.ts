import { createPage } from './factory';
import { newId } from './ids';
import type { AssetMeta, Box, CheatDocument, Id, ImageItem, Item, Page, PageSetup, ShapeItem, StrokeItem, TextItem } from './types';

type Fields<T> = Omit<T, 'id' | 'kind'>;
export type ItemPatch = Partial<Fields<ImageItem> & Fields<TextItem> & Fields<ShapeItem> & Fields<StrokeItem>>;

export function findItem(doc: CheatDocument, id: Id): { pageIndex: number; index: number; item: Item } | null {
    for (let p = 0; p < doc.pages.length; p++) {
        const index = doc.pages[p].items.findIndex((i) => i.id === id);
        if (index >= 0) return { pageIndex: p, index, item: doc.pages[p].items[index] };
    }
    return null;
}

/** Apply `fn` to every page's item list; pages whose list comes back identical are kept as is. */
function mapItems(doc: CheatDocument, fn: (items: Item[], pageIndex: number) => Item[]): CheatDocument {
    let changed = false;
    const pages = doc.pages.map((page, i) => {
        const items = fn(page.items, i);
        if (items === page.items) return page;
        changed = true;
        return { ...page, items };
    });
    return changed ? { ...doc, pages } : doc;
}

export function addItems(doc: CheatDocument, pageIndex: number, items: Item[]): CheatDocument {
    if (items.length === 0) return doc;
    return mapItems(doc, (list, i) => (i === pageIndex ? [...list, ...items] : list));
}

export function updateItems(doc: CheatDocument, patches: Record<Id, ItemPatch>): CheatDocument {
    return mapItems(doc, (list) => {
        let changed = false;
        const next = list.map((item) => {
            const patch = patches[item.id];
            if (!patch) return item;
            const { id: _id, kind: _kind, ...rest } = patch as ItemPatch & { id?: unknown; kind?: unknown };
            const keys = Object.keys(rest) as Array<keyof typeof rest>;
            if (keys.every((k) => (item as unknown as Record<string, unknown>)[k] === rest[k])) return item;
            changed = true;
            return { ...item, ...rest } as Item;
        });
        return changed ? next : list;
    });
}

export function setItemBox(item: Item, box: Box): Item {
    if (item.x === box.x && item.y === box.y && item.w === box.w && item.h === box.h && item.rotation === box.rotation) return item;
    if (item.kind === 'stroke') {
        const sx = item.w > 0 ? box.w / item.w : 1;
        const sy = item.h > 0 ? box.h / item.h : 1;
        const points = item.points.map((v, i) => (i % 3 === 0 ? v * sx : i % 3 === 1 ? v * sy : v));
        return { ...item, ...box, points };
    }
    return { ...item, ...box };
}

export function setBoxes(doc: CheatDocument, boxes: Record<Id, Box>): CheatDocument {
    return mapItems(doc, (list) => {
        let changed = false;
        const next = list.map((item) => {
            const b = boxes[item.id];
            if (!b) return item;
            const out = setItemBox(item, b);
            if (out !== item) changed = true;
            return out;
        });
        return changed ? next : list;
    });
}

export function translateItems(doc: CheatDocument, ids: Id[], dx: number, dy: number): CheatDocument {
    if (dx === 0 && dy === 0) return doc;
    const set = new Set(ids);
    return mapItems(doc, (list) =>
        list.some((i) => set.has(i.id)) ? list.map((i) => (set.has(i.id) ? { ...i, x: i.x + dx, y: i.y + dy } : i)) : list,
    );
}

export function removeItems(doc: CheatDocument, ids: Id[]): CheatDocument {
    const set = new Set(ids);
    return mapItems(doc, (list) => (list.some((i) => set.has(i.id)) ? list.filter((i) => !set.has(i.id)) : list));
}

export type Reorder = 'forward' | 'backward' | 'front' | 'back';

function sameOrder(a: Item[], b: Item[]): boolean {
    return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function reorderItems(doc: CheatDocument, ids: Id[], how: Reorder): CheatDocument {
    const set = new Set(ids);
    return mapItems(doc, (list) => {
        if (!list.some((i) => set.has(i.id))) return list;
        let next: Item[];
        if (how === 'front') next = [...list.filter((i) => !set.has(i.id)), ...list.filter((i) => set.has(i.id))];
        else if (how === 'back') next = [...list.filter((i) => set.has(i.id)), ...list.filter((i) => !set.has(i.id))];
        else {
            next = [...list];
            const step = how === 'forward' ? 1 : -1;
            const order = how === 'forward' ? [...next.keys()].reverse() : [...next.keys()];
            for (const i of order) {
                const j = i + step;
                if (!set.has(next[i].id) || j < 0 || j >= next.length || set.has(next[j].id)) continue;
                [next[i], next[j]] = [next[j], next[i]];
            }
        }
        return sameOrder(next, list) ? list : next;
    });
}

export function cloneItems(items: Item[], offset: number): Item[] {
    return items.map((i) => ({ ...i, id: newId(), x: i.x + offset, y: i.y + offset }));
}

export function duplicateItems(doc: CheatDocument, ids: Id[], offset = 12): { doc: CheatDocument; ids: Id[] } {
    const set = new Set(ids);
    const newIds: Id[] = [];
    const next = mapItems(doc, (list) => {
        const picked = list.filter((i) => set.has(i.id));
        if (picked.length === 0) return list;
        const copies = cloneItems(picked, offset);
        newIds.push(...copies.map((c) => c.id));
        return [...list, ...copies];
    });
    return { doc: next, ids: newIds };
}

export function moveItemsToPage(doc: CheatDocument, ids: Id[], target: number, dx: number, dy: number): CheatDocument {
    const set = new Set(ids);
    const moving: Item[] = [];
    for (const p of doc.pages) for (const i of p.items) if (set.has(i.id)) moving.push({ ...i, x: i.x + dx, y: i.y + dy });
    if (moving.length === 0 || target < 0 || target >= doc.pages.length) return doc;
    const removed = removeItems(doc, ids);
    return addItems(removed, target, moving);
}

export function addPage(doc: CheatDocument, at = doc.pages.length): CheatDocument {
    const pages = [...doc.pages];
    pages.splice(at, 0, createPage());
    return { ...doc, pages };
}

export function duplicatePage(doc: CheatDocument, index: number): CheatDocument {
    const src = doc.pages[index];
    if (!src) return doc;
    const copy: Page = { id: newId(), items: cloneItems(src.items, 0) };
    const pages = [...doc.pages];
    pages.splice(index + 1, 0, copy);
    return { ...doc, pages };
}

export function removePage(doc: CheatDocument, index: number): CheatDocument {
    if (doc.pages.length <= 1 || !doc.pages[index]) return doc;
    return { ...doc, pages: doc.pages.filter((_, i) => i !== index) };
}

export function movePage(doc: CheatDocument, from: number, to: number): CheatDocument {
    if (from === to || !doc.pages[from] || to < 0 || to >= doc.pages.length) return doc;
    const pages = [...doc.pages];
    const [p] = pages.splice(from, 1);
    pages.splice(to, 0, p);
    return { ...doc, pages };
}

export function setSetup(doc: CheatDocument, patch: Partial<PageSetup>): CheatDocument {
    const setup = { ...doc.setup, ...patch };
    const keys = Object.keys(patch) as Array<keyof PageSetup>;
    return keys.every((k) => doc.setup[k] === setup[k]) ? doc : { ...doc, setup };
}

export function addAsset(doc: CheatDocument, meta: AssetMeta): CheatDocument {
    if (doc.assets[meta.id]) return doc;
    return { ...doc, assets: { ...doc.assets, [meta.id]: meta } };
}

export function setTitle(doc: CheatDocument, title: string): CheatDocument {
    return doc.title === title ? doc : { ...doc, title };
}

export function referencedAssetIds(doc: CheatDocument): Set<Id> {
    const out = new Set<Id>();
    for (const p of doc.pages) for (const i of p.items) if (i.kind === 'image') out.add(i.assetId);
    return out;
}

export function pruneAssets(doc: CheatDocument): CheatDocument {
    const used = referencedAssetIds(doc);
    const ids = Object.keys(doc.assets);
    if (ids.every((id) => used.has(id))) return doc;
    const assets: Record<Id, AssetMeta> = {};
    for (const id of ids) if (used.has(id)) assets[id] = doc.assets[id];
    return { ...doc, assets };
}
