import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { referencedAssetIds } from './commands';
import type { AssetMeta, CheatDocument, Id, Item, Page, PageSetup } from './types';

export class FormatError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FormatError';
    }
}

export const FILE_EXTENSION = '.cheatsheet';
export type AssetBytes = Map<Id, { bytes: Uint8Array; mime: string }>;

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const MIME: Record<string, string> = Object.fromEntries(Object.entries(EXT).map(([m, e]) => [e, m]));

export function extForMime(mime: string): string {
    return EXT[mime] ?? 'bin';
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

// Bounds are generous for real sheets and stop a damaged or crafted file from making the
// renderer loop for minutes (a 1e-9 pt grid, a billion columns) every time the app opens.
const COORD = 100_000;

function num(o: Obj, k: string, where: string, min = -COORD, max = COORD): number {
    const v = o[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new FormatError(`${where}: "${k}" is not a number.`);
    if (v < min || v > max) throw new FormatError(`${where}: "${k}" is out of range.`);
    return v;
}
function str(o: Obj, k: string, where: string): string {
    const v = o[k];
    if (typeof v !== 'string') throw new FormatError(`${where}: "${k}" is not text.`);
    return v;
}
function bool(o: Obj, k: string, where: string): boolean {
    const v = o[k];
    if (typeof v !== 'boolean') throw new FormatError(`${where}: "${k}" is not true or false.`);
    return v;
}
function oneOf<T extends string>(o: Obj, k: string, allowed: readonly T[], where: string): T {
    const v = o[k];
    if (typeof v !== 'string' || !allowed.includes(v as T)) throw new FormatError(`${where}: "${k}" has an unknown value.`);
    return v as T;
}
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Colours end up in canvas styles and inline CSS, so only plain hex is allowed in a file. */
function colour(o: Obj, k: string, where: string): string {
    const v = str(o, k, where);
    if (!HEX.test(v)) throw new FormatError(`${where}: "${k}" is not a hex colour.`);
    return v;
}
const nullableColour = (o: Obj, k: string, where: string) => (o[k] === null ? null : colour(o, k, where));

function crop(v: unknown, where: string) {
    if (!isObj(v)) throw new FormatError(`${where}: missing crop.`);
    const c = { x: num(v, 'x', where, 0), y: num(v, 'y', where, 0), w: num(v, 'w', where, 0), h: num(v, 'h', where, 0) };
    if (c.w <= 0 || c.h <= 0) throw new FormatError(`${where}: the crop is empty.`);
    return c;
}

function item(v: unknown, where: string): Item {
    if (!isObj(v)) throw new FormatError(`${where} is not an object.`);
    const base = {
        id: str(v, 'id', where),
        x: num(v, 'x', where), y: num(v, 'y', where), w: num(v, 'w', where, 0), h: num(v, 'h', where, 0),
        rotation: num(v, 'rotation', where, -3600, 3600),
        ...(v.locked === true ? { locked: true } : {}),
    };
    switch (v.kind) {
        case 'image': {
            const f = v.filters;
            if (!isObj(f)) throw new FormatError(`${where}: missing filters.`);
            return {
                ...base, kind: 'image', assetId: str(v, 'assetId', where), crop: crop(v.crop, where),
                filters: {
                    whiteToAlpha: num(f, 'whiteToAlpha', where, 0, 1), invert: bool(f, 'invert', where),
                    grayscale: bool(f, 'grayscale', where), contrast: num(f, 'contrast', where, 0.05, 10),
                },
            };
        }
        case 'text':
            return {
                ...base, kind: 'text', text: str(v, 'text', where), fontSize: num(v, 'fontSize', where, 0.5, 400),
                font: oneOf(v, 'font', ['sans', 'narrow', 'serif', 'mono'] as const, where), color: colour(v, 'color', where),
                background: nullableColour(v, 'background', where), padding: num(v, 'padding', where, 0, 400),
                align: oneOf(v, 'align', ['left', 'center', 'right'] as const, where),
            };
        case 'shape':
            return {
                ...base, kind: 'shape', shape: oneOf(v, 'shape', ['rect', 'ellipse', 'line', 'arrow'] as const, where),
                stroke: colour(v, 'stroke', where), strokeWidth: num(v, 'strokeWidth', where, 0, 200),
                fill: nullableColour(v, 'fill', where), flipX: bool(v, 'flipX', where), flipY: bool(v, 'flipY', where),
            };
        case 'stroke': {
            const pts = v.points;
            if (!Array.isArray(pts) || pts.length % 3 !== 0 || !pts.every((n) => typeof n === 'number' && Number.isFinite(n))) {
                throw new FormatError(`${where}: points are not valid.`);
            }
            return {
                ...base, kind: 'stroke', tool: oneOf(v, 'tool', ['pen', 'highlighter'] as const, where),
                color: colour(v, 'color', where), size: num(v, 'size', where, 0.05, 1000), points: pts as number[],
            };
        }
        default:
            throw new FormatError(`${where} has an unknown kind.`);
    }
}

export function validateDocument(json: unknown): CheatDocument {
    if (!isObj(json) || !Array.isArray(json.pages)) throw new FormatError('Not a Cheatsheet Maker document.');
    if (json.version !== 1) {
        if (typeof json.version === 'number' && json.version > 1) {
            throw new FormatError(`This file was made by a newer version of Cheatsheet Maker (format ${json.version}). Update the app to open it.`);
        }
        throw new FormatError('Not a Cheatsheet Maker document.');
    }
    const s = json.setup;
    if (!isObj(s)) throw new FormatError('The page setup is missing.');
    const setup: PageSetup = {
        size: oneOf(s, 'size', ['A4', 'Letter', 'A3', 'A5', 'Legal'] as const, 'Page setup'),
        orientation: oneOf(s, 'orientation', ['portrait', 'landscape'] as const, 'Page setup'),
        margin: num(s, 'margin', 'Page setup', 0, 200), columns: num(s, 'columns', 'Page setup', 1, 6),
        gutter: num(s, 'gutter', 'Page setup', 0, 200), grid: num(s, 'grid', 'Page setup', 0, 500),
    };
    if (!Number.isInteger(setup.columns)) throw new FormatError('Page setup: "columns" must be a whole number.');
    if (setup.grid > 0 && setup.grid < 2) throw new FormatError('Page setup: the grid is finer than 2 pt.');
    if (json.pages.length === 0) throw new FormatError('The document has no pages.');
    const pages: Page[] = json.pages.map((p, pi) => {
        if (!isObj(p) || !Array.isArray(p.items)) throw new FormatError(`Page ${pi + 1} is not valid.`);
        return { id: str(p, 'id', `Page ${pi + 1}`), items: p.items.map((it, ii) => item(it, `Item ${ii + 1} on page ${pi + 1}`)) };
    });
    const assets: Record<Id, AssetMeta> = {};
    if (!isObj(json.assets)) throw new FormatError('The asset list is missing.');
    for (const [id, a] of Object.entries(json.assets)) {
        if (!isObj(a)) throw new FormatError(`Asset ${id} is not valid.`);
        assets[id] = { id: str(a, 'id', 'Asset'), mime: str(a, 'mime', 'Asset'), width: num(a, 'width', 'Asset'), height: num(a, 'height', 'Asset') };
    }
    return {
        version: 1, id: str(json, 'id', 'Document'), title: str(json, 'title', 'Document'),
        // Milliseconds since 1970, far outside the coordinate range.
        createdAt: num(json, 'createdAt', 'Document', 0, Number.MAX_SAFE_INTEGER), updatedAt: num(json, 'updatedAt', 'Document', 0, Number.MAX_SAFE_INTEGER),
        setup, pages, assets,
    };
}

export function packCheatsheet(doc: CheatDocument, assets: AssetBytes): Uint8Array {
    const files: Zippable = { 'document.json': [strToU8(JSON.stringify(doc)), { level: 6 }] };
    for (const id of referencedAssetIds(doc)) {
        const a = assets.get(id);
        if (!a) throw new FormatError('An image in this document could not be found, so the file was not written.');
        files[`assets/${id}.${extForMime(a.mime)}`] = [a.bytes, { level: 0 }];
    }
    return zipSync(files);
}

export function unpackCheatsheet(bytes: Uint8Array): { doc: CheatDocument; assets: AssetBytes } {
    let files: Record<string, Uint8Array>;
    try {
        files = unzipSync(bytes);
    } catch {
        throw new FormatError('This is not a Cheatsheet Maker file.');
    }
    const raw = files['document.json'];
    if (!raw) throw new FormatError('This is not a Cheatsheet Maker file: document.json is missing.');
    let json: unknown;
    try {
        json = JSON.parse(strFromU8(raw));
    } catch {
        throw new FormatError('The document inside this file is damaged.');
    }
    const doc = validateDocument(json);
    const assets: AssetBytes = new Map();
    for (const [name, data] of Object.entries(files)) {
        const m = /^assets\/([0-9a-z]+)\.([a-z]+)$/.exec(name);
        if (m) assets.set(m[1], { bytes: data, mime: MIME[m[2]] ?? 'application/octet-stream' });
    }
    for (const id of referencedAssetIds(doc)) {
        if (!assets.has(id)) throw new FormatError('An image referenced by this document is missing from the file.');
    }
    return { doc, assets };
}
