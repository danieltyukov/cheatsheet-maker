import type { ImageItem, TextItem } from '../model/types';
import { drawItem, type RenderAssets } from './drawPage';
import type { PdfDeps } from './exportPdf';
import { filtersKey } from './filters';

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

/**
 * A canvas element on the main thread, an OffscreenCanvas only where there is no document.
 * Chromium's asynchronous encoders (toBlob, convertToBlob) can defer the work by several
 * seconds while waiting for idle time, so main-thread canvases are encoded synchronously.
 */
export function createCanvas(w: number, h: number): AnyCanvas {
    const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
    if (typeof document === 'undefined' && typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(W, H);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c;
}

export function dataUrlBytes(url: string): Uint8Array {
    const comma = url.indexOf(',');
    if (comma < 0 || url === 'data:,') throw new Error('The browser could not encode the image.');
    // A plain loop: Uint8Array.from with a map function is about ten times slower on big images.
    const bin = atob(url.slice(comma + 1));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

export async function canvasToBytes(canvas: AnyCanvas, type = 'image/png', quality?: number): Promise<Uint8Array> {
    if ('convertToBlob' in canvas) return new Uint8Array(await (await canvas.convertToBlob({ type, quality })).arrayBuffer());
    return dataUrlBytes(canvas.toDataURL(type, quality));
}

export async function canvasToBlob(canvas: AnyCanvas, type = 'image/png', quality?: number): Promise<Blob> {
    return new Blob([(await canvasToBytes(canvas, type, quality)) as Uint8Array<ArrayBuffer>], { type });
}

function hasTransparency(ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, w: number, h: number): boolean {
    const d = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
    return false;
}

/** Export dependencies backed by the editor's renderer and caches. */
export function browserPdfDeps(assets: RenderAssets, mimeOf: (assetId: string) => string): PdfDeps {
    return {
        async imageBytes(item: ImageItem) {
            const src = assets.image(item);
            if (!src) throw new Error('An image is still loading. Try exporting again in a moment.');
            const c = createCanvas(item.crop.w, item.crop.h);
            const ctx = c.getContext('2d') as CanvasRenderingContext2D;
            ctx.drawImage(src, item.crop.x, item.crop.y, item.crop.w, item.crop.h, 0, 0, c.width, c.height);
            const photo = mimeOf(item.assetId) === 'image/jpeg' && !hasTransparency(ctx, c.width, c.height);
            const key = `${item.assetId}|${item.crop.x},${item.crop.y},${item.crop.w},${item.crop.h}|${filtersKey(item.filters)}`;
            return photo
                ? { key, bytes: await canvasToBytes(c, 'image/jpeg', 0.9), format: 'jpg' as const }
                : { key, bytes: await canvasToBytes(c), format: 'png' as const };
        },
        async textPng(item: TextItem, dpi: number) {
            const s = dpi / 72;
            const c = createCanvas(item.w * s, item.h * s);
            const ctx = c.getContext('2d') as CanvasRenderingContext2D;
            ctx.scale(c.width / item.w, c.height / item.h);
            drawItem(ctx, { ...item, x: 0, y: 0, rotation: 0, background: null }, assets);
            return canvasToBytes(c);
        },
    };
}
