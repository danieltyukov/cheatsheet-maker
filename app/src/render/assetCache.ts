import type { Id, ImageItem } from '../model/types';
import { applyFilters, filtersKey, isIdentity, type RGBAImage } from './filters';
import { createCanvas, type AnyCanvas } from './rasterize';

type Entry = { state: 'loading' } | { state: 'error' } | { state: 'ready'; bmp: ImageBitmap };

export class AssetCache {
    private entries = new Map<Id, Entry>();
    private waiters = new Map<Id, Promise<void>>();
    private filtered = new Map<string, AnyCanvas>();
    private pixels = new Map<Id, RGBAImage>();

    constructor(private load: (id: Id) => Promise<Blob | null>, private onReady: () => void) {}

    prime(id: Id, bmp: ImageBitmap) {
        this.entries.set(id, { state: 'ready', bmp });
    }

    private start(id: Id): Promise<void> {
        const existing = this.waiters.get(id);
        if (existing) return existing;
        this.entries.set(id, { state: 'loading' });
        const p = this.load(id)
            .then((blob) => (blob ? createImageBitmap(blob) : Promise.reject(new Error('missing'))))
            .then((bmp) => {
                this.entries.set(id, { state: 'ready', bmp });
                this.onReady();
            }, () => {
                this.entries.set(id, { state: 'error' });
            });
        this.waiters.set(id, p);
        return p;
    }

    bitmap(id: Id): ImageBitmap | null {
        const e = this.entries.get(id);
        if (e?.state === 'ready') return e.bmp;
        if (!e) void this.start(id);
        return null;
    }

    async ensure(ids: Iterable<Id>): Promise<void> {
        await Promise.all([...ids].map((id) => (this.entries.get(id)?.state === 'ready' ? undefined : this.start(id))));
    }

    rgba(id: Id): RGBAImage | null {
        const hit = this.pixels.get(id);
        if (hit) return hit;
        const bmp = this.bitmap(id);
        if (!bmp) return null;
        const c = createCanvas(bmp.width, bmp.height);
        const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
        ctx.drawImage(bmp, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height);
        const img = { data: d.data, width: d.width, height: d.height };
        this.pixels.set(id, img);
        if (this.pixels.size > 4) this.pixels.delete(this.pixels.keys().next().value!);
        return img;
    }

    source(item: ImageItem): CanvasImageSource | null {
        const bmp = this.bitmap(item.assetId);
        if (!bmp) return null;
        if (isIdentity(item.filters)) return bmp;
        const key = `${item.assetId}|${filtersKey(item.filters)}`;
        const hit = this.filtered.get(key);
        if (hit) {
            this.filtered.delete(key);
            this.filtered.set(key, hit);
            return hit;
        }
        const src = this.rgba(item.assetId);
        if (!src) return null;
        const out = applyFilters(src, item.filters);
        const c = createCanvas(out.width, out.height);
        (c.getContext('2d') as CanvasRenderingContext2D).putImageData(new ImageData(out.data, out.width, out.height), 0, 0);
        this.filtered.set(key, c);
        if (this.filtered.size > 24) this.filtered.delete(this.filtered.keys().next().value!);
        return c;
    }
}
