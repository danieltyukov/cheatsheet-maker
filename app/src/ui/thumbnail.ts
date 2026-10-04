import { pageDimensions } from '../model/pageSizes';
import type { CheatDocument } from '../model/types';
import type { RenderAssets } from '../render/drawPage';
import { drawPage } from '../render/drawPage';
import { canvasToBlob, createCanvas } from '../render/rasterize';

const WIDTH = 240;

/** First page as a small PNG for the library; null where there is no canvas (tests, very old browsers). */
export async function renderThumbnail(doc: CheatDocument, assets: RenderAssets): Promise<Blob | null> {
    try {
        const { w, h } = pageDimensions(doc.setup);
        const s = WIDTH / w;
        const c = createCanvas(w * s, h * s);
        const ctx = c.getContext('2d') as CanvasRenderingContext2D | null;
        if (!ctx) return null;
        ctx.scale(c.width / w, c.height / h);
        drawPage(ctx, doc.pages[0], doc.setup, assets);
        return await canvasToBlob(c);
    } catch {
        return null;
    }
}
