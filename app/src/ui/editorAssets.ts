import type { Id, ImageItem, TextItem } from '../model/types';
import { AssetCache } from '../render/assetCache';
import type { RenderAssets } from '../render/drawPage';
import { cssFont } from '../render/fonts';
import { parseMarkdown } from '../render/markdown';
import { MathCache } from '../render/math';
import { createCanvas } from '../render/rasterize';
import { layoutText, type Measurer, type TextLayout } from '../render/textLayout';

export class EditorAssets implements RenderAssets {
    readonly images: AssetCache;
    readonly maths: MathCache;
    private layouts = new WeakMap<TextItem, { version: number; layout: TextLayout }>();
    private version = 0;
    private ctx: CanvasRenderingContext2D | null = null;

    constructor(load: (id: Id) => Promise<Blob | null>, onReady: () => void) {
        this.images = new AssetCache(load, onReady);
        this.maths = new MathCache(() => {
            this.version++;
            onReady();
        });
    }

    /** Call when fonts finish loading so cached layouts are measured again. */
    invalidateText() {
        this.version++;
    }

    measure: Measurer = (text, font) => {
        if (!this.ctx && typeof document !== 'undefined') {
            this.ctx = (createCanvas(1, 1).getContext('2d') as CanvasRenderingContext2D | null);
        }
        if (!this.ctx) return text.length * font.size * 0.5;
        this.ctx.font = cssFont(font);
        return this.ctx.measureText(text).width;
    };

    image = (item: ImageItem) => this.images.source(item);
    math = (tex: string, display: boolean, color: string) => this.maths.image(tex, display, color);

    textLayout = (item: TextItem): TextLayout => {
        const hit = this.layouts.get(item);
        if (hit && hit.version === this.version) return hit.layout;
        const layout = layoutText(parseMarkdown(item.text), {
            width: Math.max(1, item.w - item.padding * 2),
            fontSize: item.fontSize,
            font: item.font,
            align: item.align,
            measure: this.measure,
            math: this.maths.metrics,
        });
        this.layouts.set(item, { version: this.version, layout });
        return layout;
    };

    textHeight(item: TextItem): number {
        return Math.max(item.fontSize * 1.25, this.textLayout(item).height) + item.padding * 2;
    }
}
