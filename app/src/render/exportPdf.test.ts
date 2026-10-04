import { describe, expect, test } from 'vitest';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { exportPdf, pdfMatrix, type PdfDeps } from './exportPdf';
import { addItems, addPage } from '../model/commands';
import { createDocument, createImageItem, createShapeItem, createStrokeItem, createTextItem } from '../model/factory';
import { apply, itemMatrix } from '../model/geometry';

const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
const deps: PdfDeps = {
    imageBytes: async (item) => ({ key: `${item.assetId}|${item.crop.x}`, bytes: PNG, format: 'png' }),
    textPng: async () => PNG,
};

describe('pdfMatrix', () => {
    test('an unrotated image lands where it is on screen, with y flipped', () => {
        const H = 800;
        const box = { x: 10, y: 20, w: 100, h: 50, rotation: 0 };
        const m = pdfMatrix(box, H, 'image');
        expect(apply(m, { x: 0, y: 0 })).toEqual({ x: 10, y: H - 70 });
        expect(apply(m, { x: 0, y: 50 })).toEqual({ x: 10, y: H - 20 });
    });
    test('a rotated image puts its top-left pixel where the canvas does', () => {
        const H = 800;
        const box = { x: 10, y: 20, w: 100, h: 50, rotation: 90 };
        const onScreen = apply(itemMatrix(box), { x: 0, y: 0 });
        const inPdf = apply(pdfMatrix(box, H, 'image'), { x: 0, y: 50 });
        expect(inPdf.x).toBeCloseTo(onScreen.x);
        expect(inPdf.y).toBeCloseTo(H - onScreen.y);
    });
    test('paths keep local y-down coordinates', () => {
        const H = 800;
        const box = { x: 10, y: 20, w: 100, h: 50, rotation: 30 };
        const local = { x: 7, y: 9 };
        const page = apply(itemMatrix(box), local);
        // drawSvgPath applies scale(1, -1) itself, so compose with it here
        const p = apply(pdfMatrix(box, H, 'path'), { x: local.x, y: -local.y });
        expect(p.x).toBeCloseTo(page.x);
        expect(p.y).toBeCloseTo(H - page.y);
    });
});

test('exports every page at the document size with deduplicated images', async () => {
    let doc = createDocument('Export', 0);
    const asset = { id: 'a', mime: 'image/png', width: 1, height: 1 };
    const img1 = createImageItem(asset, { x: 100, y: 100 }, 50, 50);
    const img2 = createImageItem(asset, { x: 200, y: 200 }, 50, 50);
    const text = createTextItem({ x: 10, y: 10 }, { font: 'sans', fontSize: 9, color: '#000', background: '#ffff00', align: 'left' }, 80, 'hi');
    const arrow = createShapeItem('arrow', { x: 0, y: 0, w: 40, h: 40 }, { stroke: '#123456', strokeWidth: 2, fill: null });
    const hl = createStrokeItem([0, 0, 0.5, 30, 0, 0.5], 'highlighter', '#ffd43b80', 10);
    doc = addItems(doc, 0, [img1, img2, { ...text, rotation: 45 }, arrow, hl]);
    doc = addPage(doc);
    const bytes = await exportPdf({ ...doc, setup: { ...doc.setup, orientation: 'landscape' } }, deps, { dpi: 300 });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeCloseTo(841.89, 1);
    expect(height).toBeCloseTo(595.28, 1);
    // pdf-lib adds a resource key per draw call, so count distinct image objects instead.
    const xobjects = pdf.getPage(0).node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
    const refs = new Set(xobjects.values().map((v) => String(v)));
    expect(refs.size).toBe(2); // one shared photo, one text raster
});

test('exports only the requested pages', async () => {
    const doc = addPage(addPage(createDocument('t', 0)));
    const pdf = await PDFDocument.load(await exportPdf(doc, deps, { dpi: 150, pages: [2] }));
    expect(pdf.getPageCount()).toBe(1);
});
