import { describe, expect, test } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { FormatError, packCheatsheet, unpackCheatsheet, validateDocument } from './format';
import { addAsset, addItems } from './commands';
import { createDocument, createImageItem, createShapeItem, createStrokeItem, createTextItem } from './factory';

const asset = { id: 'f'.repeat(64), mime: 'image/png', width: 4, height: 4 };
const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);

function sample() {
    const doc = createDocument('Round trip', 5);
    const items = [
        createImageItem(asset, { x: 50, y: 50 }, 100, 100),
        createTextItem({ x: 0, y: 0 }, { font: 'mono', fontSize: 9, color: '#112233', background: '#ffff00', align: 'center' }, 80, '**hi** $x^2$'),
        createShapeItem('arrow', { x: 1, y: 2, w: 3, h: 4 }, { stroke: '#000', strokeWidth: 2, fill: null }, true, false),
        createStrokeItem([0, 0, 0.5, 5, 5, 0.7], 'highlighter', '#ffd43b80', 12),
    ];
    return addAsset(addItems(doc, 0, items), asset);
}

describe('.cheatsheet', () => {
    test('round trips a document and its assets', () => {
        const doc = sample();
        const out = unpackCheatsheet(packCheatsheet(doc, new Map([[asset.id, { bytes, mime: 'image/png' }]])));
        expect(out.doc).toEqual(doc);
        expect(out.assets.get(asset.id)).toEqual({ bytes, mime: 'image/png' });
    });
    test('refuses to pack when an asset is missing', () => {
        expect(() => packCheatsheet(sample(), new Map())).toThrow(FormatError);
    });
    test('rejects a newer format version with a clear message', () => {
        const zip = zipSync({ 'document.json': strToU8(JSON.stringify({ ...sample(), version: 2 })) });
        expect(() => unpackCheatsheet(zip)).toThrow(/newer version/);
    });
    test('rejects a zip without a document and bytes that are not a zip', () => {
        expect(() => unpackCheatsheet(zipSync({ 'x.txt': strToU8('x') }))).toThrow(FormatError);
        expect(() => unpackCheatsheet(new Uint8Array([1, 2, 3, 4]))).toThrow(FormatError);
    });
});

describe('validateDocument', () => {
    test('rejects unknown item kinds and bad numbers', () => {
        const doc = sample();
        const bad = { ...doc, pages: [{ id: 'p', items: [{ ...doc.pages[0].items[0], kind: 'video' }] }] };
        expect(() => validateDocument(bad)).toThrow(FormatError);
        const nan = { ...doc, pages: [{ id: 'p', items: [{ ...doc.pages[0].items[0], x: 'left' }] }] };
        expect(() => validateDocument(nan)).toThrow(FormatError);
    });
    test('rejects non-objects', () => {
        expect(() => validateDocument(null)).toThrow(/Not a Cheatsheet Maker document/);
    });
});

describe('colours from files', () => {
    test('only hex colours are accepted, so a file cannot smuggle CSS into the page', () => {
        const doc = sample();
        const text = doc.pages[0].items.find((i) => i.kind === 'text')!;
        const withBg = (background: unknown) => ({ ...doc, pages: [{ ...doc.pages[0], items: [{ ...text, background }] }] });
        expect(() => validateDocument(withBg('url(https://example.com/pixel.png)'))).toThrow(FormatError);
        expect(() => validateDocument(withBg('red; background-image: url(x)'))).toThrow(FormatError);
        expect(validateDocument(withBg('#ffd43b80')).pages[0].items[0]).toMatchObject({ background: '#ffd43b80' });
        expect(validateDocument(withBg(null)).pages[0].items[0]).toMatchObject({ background: null });
        const stroke = doc.pages[0].items.find((i) => i.kind === 'stroke')!;
        expect(() => validateDocument({ ...doc, pages: [{ ...doc.pages[0], items: [{ ...stroke, color: 'var(--x)' }] }] })).toThrow(FormatError);
    });
});
