import { itemMatrix } from '../model/geometry';
import { columnGuides, pageDimensions, printableArea } from '../model/pageSizes';
import type { Id, ImageItem, Item, Page, PageSetup, TextItem } from '../model/types';
import { cssFont } from './fonts';
import { outlineToPath, shapeGeometry, strokeOutline } from './strokes';
import type { TextLayout } from './textLayout';

export interface RenderAssets {
    /** Full-size, filtered source for the image's asset, or null while it loads. */
    image(item: ImageItem): CanvasImageSource | null;
    textLayout(item: TextItem): TextLayout;
    math(tex: string, display: boolean, color: string): CanvasImageSource | null;
}

export interface DrawOptions {
    guides?: boolean;
    hidden?: ReadonlySet<Id>;
    /** Page colour; null draws no background (transparent PNG export). */
    background?: string | null;
}

export const GUIDE_COLOR = 'rgba(47, 111, 219, 0.45)';
const PLACEHOLDER = '#e7e3d9';

function drawGuides(ctx: CanvasRenderingContext2D, setup: PageSetup) {
    const { w, h } = pageDimensions(setup);
    const a = printableArea(setup);
    ctx.save();
    ctx.strokeStyle = GUIDE_COLOR;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(a.x, a.y, a.w, a.h);
    for (const x of columnGuides(setup)) {
        ctx.beginPath();
        ctx.moveTo(x, a.y);
        ctx.lineTo(x, a.y + a.h);
        ctx.stroke();
    }
    if (setup.grid > 0) {
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(47, 111, 219, 0.12)';
        ctx.beginPath();
        for (let x = setup.grid; x < w; x += setup.grid) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
        }
        for (let y = setup.grid; y < h; y += setup.grid) {
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();
    }
    ctx.restore();
}

export function drawItem(ctx: CanvasRenderingContext2D, item: Item, assets: RenderAssets): void {
    ctx.save();
    const m = itemMatrix(item);
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    switch (item.kind) {
        case 'image': {
            const src = assets.image(item);
            if (src) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(src, item.crop.x, item.crop.y, item.crop.w, item.crop.h, 0, 0, item.w, item.h);
            } else {
                ctx.fillStyle = PLACEHOLDER;
                ctx.fillRect(0, 0, item.w, item.h);
            }
            break;
        }
        case 'text': {
            if (item.background) {
                ctx.fillStyle = item.background;
                ctx.fillRect(0, 0, item.w, item.h);
            }
            const layout = assets.textLayout(item);
            ctx.fillStyle = item.color;
            ctx.textBaseline = 'alphabetic';
            for (const run of layout.runs) {
                if (run.kind === 'text') {
                    ctx.font = cssFont(run.font);
                    ctx.fillText(run.text, item.padding + run.x, item.padding + run.baseline);
                } else {
                    const img = assets.math(run.tex, run.display, item.color);
                    if (img) ctx.drawImage(img, item.padding + run.x, item.padding + run.top, run.w, run.h);
                }
            }
            break;
        }
        case 'shape': {
            const g = shapeGeometry(item);
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            if (g.fill && item.fill) {
                ctx.fillStyle = item.fill;
                ctx.fill(new Path2D(g.fill));
            }
            if (item.strokeWidth > 0) {
                ctx.strokeStyle = item.stroke;
                ctx.lineWidth = item.strokeWidth;
                ctx.stroke(new Path2D(g.stroke));
            }
            if (g.head) {
                ctx.fillStyle = item.stroke;
                ctx.fill(new Path2D(g.head));
            }
            break;
        }
        case 'stroke': {
            if (item.tool === 'highlighter') ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = item.color;
            ctx.fill(new Path2D(outlineToPath(strokeOutline(item))));
            break;
        }
    }
    ctx.restore();
}

/** Draws in page points; the caller sets the transform from points to device pixels. */
export function drawPage(ctx: CanvasRenderingContext2D, page: Page, setup: PageSetup, assets: RenderAssets, opts: DrawOptions = {}): void {
    const { w, h } = pageDimensions(setup);
    if (opts.background !== null) {
        ctx.fillStyle = opts.background ?? '#ffffff';
        ctx.fillRect(0, 0, w, h);
    }
    if (opts.guides) drawGuides(ctx, setup);
    for (const item of page.items) {
        if (!opts.hidden?.has(item.id)) drawItem(ctx, item, assets);
    }
}
