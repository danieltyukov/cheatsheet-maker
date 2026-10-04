import { addAsset, addItems } from './commands';
import { createDocument, createPage, createStrokeItem, DEFAULT_FILTERS } from './factory';
import { FormatError, type AssetBytes } from './format';
import { sha256Hex } from './hash';
import { newId } from './ids';
import { readPngSize } from './imageSize';
import type { CheatDocument, Item } from './types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const n = (o: Obj, k: string) => (typeof o[k] === 'number' ? (o[k] as number) : 0);

function hex2(v: number): string {
    return Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
}

export async function importLegacyAutosave(text: string, title = 'Imported cheatsheet'): Promise<{ doc: CheatDocument; assets: AssetBytes }> {
    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch {
        throw new FormatError('This file is not valid JSON.');
    }
    const notLegacy = new FormatError('This JSON file is not a Cheatsheet Maker autosave.');
    if (!isObj(json) || !Array.isArray(json.pages)) throw notLegacy;
    let doc = createDocument(title);
    doc = { ...doc, pages: json.pages.map(() => createPage()) };
    if (doc.pages.length === 0) doc = { ...doc, pages: [createPage()] };
    const assets: AssetBytes = new Map();

    for (const [pi, page] of json.pages.entries()) {
        if (!isObj(page)) throw notLegacy;
        const items: Item[] = [];
        for (const it of Array.isArray(page.items) ? page.items : []) {
            if (!isObj(it) || typeof it.image_data !== 'string') throw notLegacy;
            const bytes = Uint8Array.from(atob(it.image_data), (c) => c.charCodeAt(0));
            const id = await sha256Hex(bytes);
            const size = readPngSize(bytes) ?? { width: n(it, 'crop_w'), height: n(it, 'crop_h') };
            assets.set(id, { bytes, mime: 'image/png' });
            doc = addAsset(doc, { id, mime: 'image/png', ...size });
            items.push({
                id: newId(), kind: 'image', x: n(it, 'x'), y: n(it, 'y'), w: n(it, 'width'), h: n(it, 'height'), rotation: 0,
                assetId: id, crop: { x: n(it, 'crop_x'), y: n(it, 'crop_y'), w: n(it, 'crop_w'), h: n(it, 'crop_h') },
                filters: { ...DEFAULT_FILTERS },
            });
        }
        // The GTK app drew every stroke above every image, so strokes go last.
        for (const s of Array.isArray(page.strokes) ? page.strokes : []) {
            if (!isObj(s) || !Array.isArray(s.points)) throw notLegacy;
            const pts = s.points.filter(isObj).flatMap((p) => [n(p, 'x'), n(p, 'y'), 0.5]);
            if (pts.length === 0) continue;
            const a = n(s, 'a');
            const color = `#${hex2(n(s, 'r'))}${hex2(n(s, 'g'))}${hex2(n(s, 'b'))}${a < 1 ? hex2(a) : ''}`;
            items.push(createStrokeItem(pts, 'pen', color, n(s, 'width') || 2));
        }
        doc = addItems(doc, pi, items);
    }
    return { doc, assets };
}
