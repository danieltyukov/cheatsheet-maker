import { pageDimensions } from '../../model/pageSizes';
import type { PageSetup, Point } from '../../model/types';
import type { View } from '../store';

export const PAGE_GAP = 24;
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8;
export const ACTUAL_SIZE = 96 / 72;

const stride = (setup: PageSetup) => pageDimensions(setup).h + PAGE_GAP;

export function pageTops(setup: PageSetup, count: number): number[] {
    return Array.from({ length: count }, (_, i) => i * stride(setup));
}

export function worldHeight(setup: PageSetup, count: number): number {
    return count * stride(setup) - PAGE_GAP;
}

export const toScreen = (v: View, p: Point): Point => ({ x: (p.x - v.scrollX) * v.zoom, y: (p.y - v.scrollY) * v.zoom });
export const toWorld = (v: View, p: Point): Point => ({ x: p.x / v.zoom + v.scrollX, y: p.y / v.zoom + v.scrollY });

export function pageAt(setup: PageSetup, count: number, world: Point): { index: number; inside: boolean } {
    const { w, h } = pageDimensions(setup);
    const s = stride(setup);
    let index = Math.floor(world.y / s);
    const within = world.y - index * s;
    if (within > h && within - h > PAGE_GAP / 2) index += 1;
    index = Math.max(0, Math.min(count - 1, index));
    const top = index * s;
    const inside = world.x >= 0 && world.x <= w && world.y >= top && world.y <= top + h;
    return { index, inside };
}

export const toPagePoint = (setup: PageSetup, index: number, world: Point): Point => ({ x: world.x, y: world.y - index * stride(setup) });
export const fromPagePoint = (setup: PageSetup, index: number, p: Point): Point => ({ x: p.x, y: p.y + index * stride(setup) });

export function visiblePages(setup: PageSetup, count: number, v: View, _vw: number, vh: number): number[] {
    const { h } = pageDimensions(setup);
    const top = v.scrollY, bottom = v.scrollY + vh / v.zoom;
    const out: number[] = [];
    pageTops(setup, count).forEach((t, i) => {
        if (t + h >= top && t <= bottom) out.push(i);
    });
    return out;
}

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export function zoomAround(v: View, factor: number, screen: Point): View {
    const zoom = clampZoom(v.zoom * factor);
    const w = toWorld(v, screen);
    return { zoom, scrollX: w.x - screen.x / zoom, scrollY: w.y - screen.y / zoom };
}

export function fitWidth(setup: PageSetup, vw: number, page: number): View {
    const { w } = pageDimensions(setup);
    const margin = Math.min(32, vw * 0.04);
    const zoom = clampZoom((vw - margin * 2) / w);
    return { zoom, scrollX: (w - vw / zoom) / 2, scrollY: page * stride(setup) - 16 / zoom };
}

/** The whole page in view with a small margin, centred both ways. */
export function fitPage(setup: PageSetup, vw: number, vh: number, page: number): View {
    const { w, h } = pageDimensions(setup);
    const margin = Math.min(24, vw * 0.04);
    const zoom = clampZoom(Math.min((vw - margin * 2) / w, (vh - margin * 2) / h));
    return { zoom, scrollX: (w - vw / zoom) / 2, scrollY: page * stride(setup) + (h - vh / zoom) / 2 };
}

/** Keep some of the document on screen; centre it on an axis where it is smaller than the viewport. */
export function clampView(v: View, setup: PageSetup, count: number, vw: number, vh: number): View {
    const { w } = pageDimensions(setup);
    const H = worldHeight(setup, count);
    const VW = vw / v.zoom, VH = vh / v.zoom, pad = 48 / v.zoom;
    const axis = (scroll: number, content: number, viewSize: number) =>
        viewSize >= content ? (content - viewSize) / 2 : Math.min(content - viewSize + pad, Math.max(-pad, scroll));
    return { zoom: v.zoom, scrollX: axis(v.scrollX, w, VW), scrollY: axis(v.scrollY, H, VH) };
}
