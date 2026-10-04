import { pageDimensions } from '../model/pageSizes';
import type { CheatDocument } from '../model/types';
import { drawPage, type RenderAssets } from './drawPage';
import { canvasToBlob, createCanvas } from './rasterize';

export async function renderPageBlob(doc: CheatDocument, pageIndex: number, dpi: number, assets: RenderAssets, transparent = false): Promise<Blob> {
    const { w, h } = pageDimensions(doc.setup);
    const s = dpi / 72;
    const c = createCanvas(w * s, h * s);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    ctx.scale(c.width / w, c.height / h);
    drawPage(ctx, doc.pages[pageIndex], doc.setup, assets, { background: transparent ? null : '#ffffff' });
    return canvasToBlob(c);
}

export function safeFileName(title: string): string {
    const base = title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
    return base || 'cheatsheet';
}

export async function exportPngs(doc: CheatDocument, pages: number[], dpi: number, assets: RenderAssets): Promise<Array<{ name: string; blob: Blob }>> {
    const name = safeFileName(doc.title);
    const out: Array<{ name: string; blob: Blob }> = [];
    for (const i of pages) {
        out.push({ name: pages.length === 1 ? `${name}.png` : `${name} page ${i + 1}.png`, blob: await renderPageBlob(doc, i, dpi, assets) });
    }
    return out;
}
