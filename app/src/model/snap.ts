import { columnGuides, pageDimensions } from './pageSizes';
import type { PageSetup, Rect } from './types';

export interface SnapTargets {
    xs: number[];
    ys: number[];
}

export function snapTargets(setup: PageSetup, others: Rect[]): SnapTargets {
    const { w, h } = pageDimensions(setup);
    const m = setup.margin;
    const xs = [0, w / 2, w, m, w - m, ...columnGuides(setup)];
    const ys = [0, h / 2, h, m, h - m];
    for (const r of others) {
        xs.push(r.x, r.x + r.w / 2, r.x + r.w);
        ys.push(r.y, r.y + r.h / 2, r.y + r.h);
    }
    return { xs, ys };
}

function nearest(candidates: number[], targets: number[], threshold: number): { delta: number; guide: number } | null {
    let best: { delta: number; guide: number } | null = null;
    for (const c of candidates) {
        for (const t of targets) {
            const d = t - c;
            if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, guide: t };
        }
    }
    return best;
}

const toGrid = (v: number, grid: number) => Math.round(v / grid) * grid - v;

export interface SnapResult {
    dx: number;
    dy: number;
    guideX: number | null;
    guideY: number | null;
}

export function snapRect(r: Rect, t: SnapTargets, threshold: number, grid: number): SnapResult {
    const sx = nearest([r.x, r.x + r.w / 2, r.x + r.w], t.xs, threshold);
    const sy = nearest([r.y, r.y + r.h / 2, r.y + r.h], t.ys, threshold);
    return {
        dx: sx ? sx.delta : grid > 0 ? toGrid(r.x, grid) : 0,
        dy: sy ? sy.delta : grid > 0 ? toGrid(r.y, grid) : 0,
        guideX: sx ? sx.guide : null,
        guideY: sy ? sy.guide : null,
    };
}

export function snapValue(v: number, targets: number[], threshold: number, grid: number): { value: number; guide: number | null } {
    const s = nearest([v], targets, threshold);
    if (s) return { value: v + s.delta, guide: s.guide };
    return { value: grid > 0 ? v + toGrid(v, grid) : v, guide: null };
}
