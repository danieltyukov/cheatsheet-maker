import { rectsIntersect } from './geometry';
import type { Id, Rect } from './types';

export interface PackBox {
    id: Id;
    w: number;
    h: number;
}

export interface Placement {
    id: Id;
    x: number;
    y: number;
    w: number;
    h: number;
    bin: number;
}

export type Heuristic = 'topLeft' | 'bestShortSide';

const EPS = 1e-6;

function contains(o: Rect, r: Rect): boolean {
    return r.x >= o.x - EPS && r.y >= o.y - EPS && r.x + r.w <= o.x + o.w + EPS && r.y + r.h <= o.y + o.h + EPS;
}

function splitFree(free: Rect[], used: Rect): Rect[] {
    const out: Rect[] = [];
    for (const f of free) {
        if (!rectsIntersect(f, used)) {
            out.push(f);
            continue;
        }
        if (used.x > f.x) out.push({ x: f.x, y: f.y, w: used.x - f.x, h: f.h });
        if (used.x + used.w < f.x + f.w) out.push({ x: used.x + used.w, y: f.y, w: f.x + f.w - used.x - used.w, h: f.h });
        if (used.y > f.y) out.push({ x: f.x, y: f.y, w: f.w, h: used.y - f.y });
        if (used.y + used.h < f.y + f.h) out.push({ x: f.x, y: used.y + used.h, w: f.w, h: f.y + f.h - used.y - used.h });
    }
    // Drop free rectangles contained in another; of two equal ones keep the first.
    return out.filter((r, i) => !out.some((o, j) => j !== i && contains(o, r) && (!contains(r, o) || j < i)));
}

function score(f: Rect, bw: number, bh: number, h: Heuristic): [number, number, number] {
    if (h === 'topLeft') return [f.y, f.x, 0];
    const dw = f.w - bw, dh = f.h - bh;
    return [Math.min(dw, dh), Math.max(dw, dh), f.y];
}

function better(a: [number, number, number], b: [number, number, number]): boolean {
    for (let i = 0; i < 3; i++) {
        if (a[i] < b[i] - EPS) return true;
        if (a[i] > b[i] + EPS) return false;
    }
    return false;
}

/**
 * Pack into one bin. Each box reserves `gap` on its right and bottom, and the
 * bin is enlarged by `gap`, so boxes end up `gap` apart and flush with the edges.
 */
export function maxRectsPack(boxes: PackBox[], binW: number, binH: number, gap: number, heuristic: Heuristic) {
    let free: Rect[] = [{ x: 0, y: 0, w: binW + gap, h: binH + gap }];
    const placed: Placement[] = [];
    const rest: PackBox[] = [];
    const order = [...boxes].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);
    for (const box of order) {
        const bw = box.w + gap, bh = box.h + gap;
        let best: Rect | null = null;
        let bestScore: [number, number, number] = [Infinity, Infinity, Infinity];
        for (const f of free) {
            if (bw > f.w + EPS || bh > f.h + EPS) continue;
            const s = score(f, bw, bh, heuristic);
            if (!best || better(s, bestScore)) {
                best = f;
                bestScore = s;
            }
        }
        if (!best) {
            rest.push(box);
            continue;
        }
        free = splitFree(free, { x: best.x, y: best.y, w: bw, h: bh });
        placed.push({ id: box.id, x: best.x, y: best.y, w: box.w, h: box.h, bin: 0 });
    }
    return { placed, rest };
}

/** Keep sizes (shrinking only boxes larger than a bin) and fill bins in order. */
export function arrange(boxes: PackBox[], binW: number, binH: number, gap: number): Placement[] {
    let remaining = boxes.map((b) => {
        const s = Math.min(1, binW / b.w, binH / b.h);
        return s < 1 ? { ...b, w: b.w * s, h: b.h * s } : b;
    });
    const out: Placement[] = [];
    for (let bin = 0; remaining.length > 0; bin++) {
        const { placed, rest } = maxRectsPack(remaining, binW, binH, gap, 'topLeft');
        if (placed.length === 0) break;
        out.push(...placed.map((p) => ({ ...p, bin })));
        remaining = rest;
    }
    return out;
}

/** Largest common scale at which every box fits in one bin. */
export function fitScale(boxes: PackBox[], binW: number, binH: number, gap: number): { scale: number; placements: Placement[] } | null {
    if (boxes.length === 0) return null;
    const area = boxes.reduce((a, b) => a + b.w * b.h, 0);
    let hi = Math.min(...boxes.map((b) => Math.min(binW / b.w, binH / b.h)), area > 0 ? Math.sqrt((binW * binH) / area) : Infinity);
    if (!Number.isFinite(hi) || hi <= 0) return null;
    const attempt = (s: number): Placement[] | null => {
        const scaled = boxes.map((b) => ({ ...b, w: b.w * s, h: b.h * s }));
        for (const h of ['topLeft', 'bestShortSide'] as const) {
            const r = maxRectsPack(scaled, binW, binH, gap, h);
            if (r.rest.length === 0) return r.placed;
        }
        return null;
    };
    const top = attempt(hi);
    if (top) return { scale: hi, placements: top };
    let lo = 0;
    let best: Placement[] | null = null;
    for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        const p = attempt(mid);
        if (p) {
            lo = mid;
            best = p;
        } else hi = mid;
    }
    return best ? { scale: lo, placements: best } : null;
}
