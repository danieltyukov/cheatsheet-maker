import {
    BlendMode, LineCapStyle, PDFDocument, concatTransformationMatrix, popGraphicsState, pushGraphicsState, rgb,
    type PDFImage, type PDFPage,
} from 'pdf-lib';
import { itemMatrix, multiply, scaling, translation, type Matrix } from '../model/geometry';
import { pageDimensions } from '../model/pageSizes';
import type { Box, CheatDocument, ImageItem, Item, TextItem } from '../model/types';
import { parseColor } from './colors';
import { outlineToPath, shapeGeometry, strokeOutline } from './strokes';

export interface PdfDeps {
    /** Cropped and filtered pixels. Equal keys mean equal bytes, so they are embedded once. */
    imageBytes(item: ImageItem): Promise<{ key: string; bytes: Uint8Array; format: 'png' | 'jpg' }>;
    /** The text and math of a text box on a transparent background, at `dpi`. */
    textPng(item: TextItem, dpi: number): Promise<Uint8Array>;
}

export interface PdfOptions {
    dpi: number;
    pages?: number[];
}

/**
 * Page-to-PDF transform for an item. 'image' maps pdf-lib's y-up unit image
 * onto the item box; 'path' cancels the scale(1, -1) that drawSvgPath adds.
 */
export function pdfMatrix(box: Box, pageH: number, mode: 'path' | 'image'): Matrix {
    const flip: Matrix = [1, 0, 0, -1, 0, pageH];
    const base = multiply(flip, itemMatrix(box));
    return mode === 'path'
        ? multiply(base, scaling(1, -1))
        : multiply(multiply(base, translation(0, box.h)), scaling(1, -1));
}

function colour(css: string) {
    const c = parseColor(css);
    return { color: rgb(c.r / 255, c.g / 255, c.b / 255), opacity: c.a };
}

function withMatrix(page: PDFPage, m: Matrix, draw: () => void) {
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...m));
    draw();
    page.pushOperators(popGraphicsState());
}

async function drawItemPdf(pdf: PDFDocument, page: PDFPage, item: Item, H: number, images: Map<string, PDFImage>, deps: PdfDeps, dpi: number) {
    switch (item.kind) {
        case 'image': {
            const { key, bytes, format } = await deps.imageBytes(item);
            let img = images.get(key);
            if (!img) {
                img = format === 'png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
                images.set(key, img);
            }
            const embedded = img;
            withMatrix(page, pdfMatrix(item, H, 'image'), () => page.drawImage(embedded, { x: 0, y: 0, width: item.w, height: item.h }));
            break;
        }
        case 'text': {
            if (item.background) {
                const bg = colour(item.background);
                withMatrix(page, pdfMatrix(item, H, 'path'), () =>
                    page.drawSvgPath(`M0 0H${item.w}V${item.h}H0Z`, { x: 0, y: 0, color: bg.color, opacity: bg.opacity, borderWidth: 0 }));
            }
            if (item.text.trim()) {
                const img = await pdf.embedPng(await deps.textPng(item, dpi));
                withMatrix(page, pdfMatrix(item, H, 'image'), () => page.drawImage(img, { x: 0, y: 0, width: item.w, height: item.h }));
            }
            break;
        }
        case 'shape': {
            const g = shapeGeometry(item);
            const s = colour(item.stroke);
            withMatrix(page, pdfMatrix(item, H, 'path'), () => {
                if (g.fill && item.fill) {
                    const fc = colour(item.fill);
                    page.drawSvgPath(g.fill, { x: 0, y: 0, color: fc.color, opacity: fc.opacity, borderWidth: 0 });
                }
                if (item.strokeWidth > 0) {
                    page.drawSvgPath(g.stroke, {
                        x: 0, y: 0, borderColor: s.color, borderOpacity: s.opacity, borderWidth: item.strokeWidth,
                        borderLineCap: LineCapStyle.Round,
                    });
                }
                if (g.head) page.drawSvgPath(g.head, { x: 0, y: 0, color: s.color, opacity: s.opacity, borderWidth: 0 });
            });
            break;
        }
        case 'stroke': {
            const c = colour(item.color);
            const d = outlineToPath(strokeOutline(item));
            if (!d) break;
            withMatrix(page, pdfMatrix(item, H, 'path'), () =>
                page.drawSvgPath(d, {
                    x: 0, y: 0, color: c.color, opacity: c.opacity, borderWidth: 0,
                    blendMode: item.tool === 'highlighter' ? BlendMode.Multiply : undefined,
                }));
            break;
        }
    }
}

export async function exportPdf(doc: CheatDocument, deps: PdfDeps, opts: PdfOptions): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    pdf.setTitle(doc.title);
    pdf.setCreator('Cheatsheet Maker');
    pdf.setProducer('Cheatsheet Maker');
    const { w, h } = pageDimensions(doc.setup);
    const images = new Map<string, PDFImage>();
    for (const index of opts.pages ?? doc.pages.map((_, i) => i)) {
        const src = doc.pages[index];
        if (!src) continue;
        const page = pdf.addPage([w, h]);
        for (const item of src.items) await drawItemPdf(pdf, page, item, h, images, deps, opts.dpi);
    }
    return pdf.save();
}
