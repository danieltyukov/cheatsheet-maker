import type { Box, Item, Point, Rect, ShapeItem } from './types';

/** [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f (canvas convention). */
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** m then n is multiply(m, n) applied as m(n(p)). */
export function multiply(m: Matrix, n: Matrix): Matrix {
    return [
        m[0] * n[0] + m[2] * n[1],
        m[1] * n[0] + m[3] * n[1],
        m[0] * n[2] + m[2] * n[3],
        m[1] * n[2] + m[3] * n[3],
        m[0] * n[4] + m[2] * n[5] + m[4],
        m[1] * n[4] + m[3] * n[5] + m[5],
    ];
}

export function invert(m: Matrix): Matrix {
    const det = m[0] * m[3] - m[1] * m[2];
    if (det === 0) return [...IDENTITY];
    const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
    return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

export function apply(m: Matrix, p: Point): Point {
    return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

export const translation = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
export const scaling = (sx: number, sy: number): Matrix => [sx, 0, 0, sy, 0, 0];
export function rotation(deg: number): Matrix {
    const r = (deg * Math.PI) / 180;
    const c = Math.cos(r), s = Math.sin(r);
    return [c, s, -s, c, 0, 0];
}

/** Local (0..w, 0..h, y down) to page coordinates. */
export function itemMatrix(b: Box): Matrix {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    return multiply(multiply(translation(cx, cy), rotation(b.rotation)), translation(-b.w / 2, -b.h / 2));
}

export function toLocal(b: Box, p: Point): Point {
    return apply(invert(itemMatrix(b)), p);
}

export function boxCorners(b: Box): Point[] {
    const m = itemMatrix(b);
    return [apply(m, { x: 0, y: 0 }), apply(m, { x: b.w, y: 0 }), apply(m, { x: b.w, y: b.h }), apply(m, { x: 0, y: b.h })];
}

export function boxBounds(b: Box): Rect {
    if (!b.rotation) return { x: b.x, y: b.y, w: b.w, h: b.h };
    const c = boxCorners(b);
    const xs = c.map((p) => p.x), ys = c.map((p) => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function rectContains(outer: Rect, inner: Rect, eps = 0.5): boolean {
    return inner.x >= outer.x - eps && inner.y >= outer.y - eps
        && inner.x + inner.w <= outer.x + outer.w + eps && inner.y + inner.h <= outer.y + outer.h + eps;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function unionRect(rects: Rect[]): Rect | null {
    if (rects.length === 0) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of rects) {
        x0 = Math.min(x0, r.x);
        y0 = Math.min(y0, r.y);
        x1 = Math.max(x1, r.x + r.w);
        y1 = Math.max(y1, r.y + r.h);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function distToSegment(p: Point, a: Point, b: Point): number {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function lineEndpoints(s: Pick<ShapeItem, 'x' | 'y' | 'w' | 'h' | 'flipX' | 'flipY'>): [Point, Point] {
    const a = { x: s.x + (s.flipX ? s.w : 0), y: s.y + (s.flipY ? s.h : 0) };
    const b = { x: s.x + (s.flipX ? 0 : s.w), y: s.y + (s.flipY ? 0 : s.h) };
    return [a, b];
}

export function boxFromLine(a: Point, b: Point): Box & { flipX: boolean; flipY: boolean } {
    return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        w: Math.abs(b.x - a.x),
        h: Math.abs(b.y - a.y),
        rotation: 0,
        flipX: a.x > b.x,
        flipY: a.y > b.y,
    };
}

export function hitItem(item: Item, p: Point, tol: number): boolean {
    const l = toLocal(item, p);
    if (item.kind === 'stroke') {
        const pts = item.points;
        const reach = item.size / 2 + tol;
        if (pts.length === 3) return Math.hypot(l.x - pts[0], l.y - pts[1]) <= reach;
        for (let i = 0; i + 3 < pts.length; i += 3) {
            if (distToSegment(l, { x: pts[i], y: pts[i + 1] }, { x: pts[i + 3], y: pts[i + 4] }) <= reach) return true;
        }
        return false;
    }
    if (item.kind === 'shape' && (item.shape === 'line' || item.shape === 'arrow')) {
        const [a, b] = lineEndpoints({ ...item, x: 0, y: 0 });
        return distToSegment(l, a, b) <= item.strokeWidth / 2 + tol;
    }
    return l.x >= -tol && l.y >= -tol && l.x <= item.w + tol && l.y <= item.h + tol;
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';
export type ResizeHandle = Exclude<Handle, 'rotate'>;

const LOCAL_HANDLES: Array<[ResizeHandle, number, number]> = [
    ['nw', 0, 0], ['n', 0.5, 0], ['ne', 1, 0], ['e', 1, 0.5],
    ['se', 1, 1], ['s', 0.5, 1], ['sw', 0, 1], ['w', 0, 0.5],
];

export function handlePositions(b: Box, rotateOffset: number): Record<Handle, Point> {
    const m = itemMatrix(b);
    const out = {} as Record<Handle, Point>;
    for (const [h, fx, fy] of LOCAL_HANDLES) out[h] = apply(m, { x: fx * b.w, y: fy * b.h });
    out.rotate = apply(m, { x: b.w / 2, y: -rotateOffset });
    return out;
}

function isLine(item: Item): item is ShapeItem {
    return item.kind === 'shape' && (item.shape === 'line' || item.shape === 'arrow');
}

/**
 * Lines get two endpoint handles named after the corner they sit on; boxes get eight plus rotate.
 * `only` limits the search to the handles actually drawn for this item.
 */
export function handleAt(item: Item, p: Point, tol: number, rotateOffset: number, only?: readonly Handle[]): Handle | null {
    if (isLine(item)) {
        const [a, b] = lineEndpoints(item);
        if (Math.hypot(p.x - a.x, p.y - a.y) <= tol) return 'nw';
        if (Math.hypot(p.x - b.x, p.y - b.y) <= tol) return 'se';
        return null;
    }
    const pos = handlePositions(item, rotateOffset);
    const order: Handle[] = ['rotate', 'nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'];
    for (const h of order) {
        if (only && !only.includes(h)) continue;
        if (Math.hypot(p.x - pos[h].x, p.y - pos[h].y) <= tol) return h;
    }
    return null;
}

export function resizeBox(start: Box, handle: ResizeHandle, pageDelta: Point, keepAspect: boolean, minSize = 4): Box {
    const d = apply(rotation(-start.rotation), pageDelta);
    let l = 0, t = 0, r = start.w, b = start.h;
    const west = handle.includes('w'), east = handle.includes('e');
    const north = handle.includes('n'), south = handle.includes('s');
    if (west) l += d.x;
    if (east) r += d.x;
    if (north) t += d.y;
    if (south) b += d.y;
    if (r - l < minSize) {
        if (west) l = r - minSize;
        else r = l + minSize;
    }
    if (b - t < minSize) {
        if (north) t = b - minSize;
        else b = t + minSize;
    }
    if (keepAspect && handle.length === 2 && start.h > 0) {
        const aspect = start.w / start.h;
        let w = r - l, h = b - t;
        if (w / h > aspect) h = w / aspect;
        else w = h * aspect;
        if (west) l = r - w;
        else r = l + w;
        if (north) t = b - h;
        else b = t + h;
    }
    const w = r - l, h = b - t;
    const c = apply(itemMatrix(start), { x: (l + r) / 2, y: (t + b) / 2 });
    return { x: c.x - w / 2, y: c.y - h / 2, w, h, rotation: start.rotation };
}

export function normalizeDeg(d: number): number {
    let a = d % 360;
    if (a > 180) a -= 360;
    if (a <= -180) a += 360;
    return a;
}

export function rotateBox(start: Box, startPointer: Point, pointer: Point, snap: boolean): number {
    const cx = start.x + start.w / 2, cy = start.y + start.h / 2;
    const a0 = Math.atan2(startPointer.y - cy, startPointer.x - cx);
    const a1 = Math.atan2(pointer.y - cy, pointer.x - cx);
    let deg = start.rotation + ((a1 - a0) * 180) / Math.PI;
    if (snap) deg = Math.round(deg / 15) * 15;
    return normalizeDeg(deg);
}
