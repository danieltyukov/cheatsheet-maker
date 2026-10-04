import { getStroke } from 'perfect-freehand';
import type { ShapeItem, StrokeItem } from '../model/types';

const outlines = new WeakMap<StrokeItem, number[][]>();

export function strokeOutline(item: StrokeItem): number[][] {
    const hit = outlines.get(item);
    if (hit) return hit;
    const pts: number[][] = [];
    let realPressure = false;
    for (let i = 0; i < item.points.length; i += 3) {
        pts.push([item.points[i], item.points[i + 1], item.points[i + 2]]);
        if (item.points[i + 2] !== 0.5) realPressure = true;
    }
    const outline = item.tool === 'highlighter'
        ? getStroke(pts, { size: item.size, thinning: 0, smoothing: 0.5, streamline: 0.4, simulatePressure: false, last: true, start: { cap: false }, end: { cap: false } })
        : getStroke(pts, { size: item.size, thinning: 0.55, smoothing: 0.5, streamline: 0.5, simulatePressure: !realPressure, last: true });
    outlines.set(item, outline);
    return outline;
}

const f = (n: number) => String(Math.round(n * 100) / 100);

export function outlineToPath(outline: number[][]): string {
    if (outline.length === 0) return '';
    return `M${outline.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;
}

export interface ShapeGeometry {
    stroke: string;
    fill: string | null;
    head: string | null;
}

export function shapeGeometry(s: ShapeItem): ShapeGeometry {
    const { w, h } = s;
    if (s.shape === 'rect') {
        const d = `M0 0H${f(w)}V${f(h)}H0Z`;
        return { stroke: d, fill: s.fill ? d : null, head: null };
    }
    if (s.shape === 'ellipse') {
        const k = 0.5522847498, rx = w / 2, ry = h / 2;
        const d = `M${f(w)} ${f(ry)}C${f(w)} ${f(ry + ry * k)} ${f(rx + rx * k)} ${f(h)} ${f(rx)} ${f(h)}`
            + `C${f(rx - rx * k)} ${f(h)} 0 ${f(ry + ry * k)} 0 ${f(ry)}`
            + `C0 ${f(ry - ry * k)} ${f(rx - rx * k)} 0 ${f(rx)} 0`
            + `C${f(rx + rx * k)} 0 ${f(w)} ${f(ry - ry * k)} ${f(w)} ${f(ry)}Z`;
        return { stroke: d, fill: s.fill ? d : null, head: null };
    }
    const ax = s.flipX ? w : 0, ay = s.flipY ? h : 0, bx = s.flipX ? 0 : w, by = s.flipY ? 0 : h;
    if (s.shape === 'line') return { stroke: `M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}`, fill: null, head: null };
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    const headLen = Math.min(len * 0.6, Math.max(6, s.strokeWidth * 4));
    const headW = headLen * 0.8;
    const baseX = bx - ux * headLen, baseY = by - uy * headLen;
    const nx = -uy, ny = ux;
    const head = `M${f(bx)} ${f(by)}L${f(baseX + nx * headW / 2)} ${f(baseY + ny * headW / 2)}L${f(baseX - nx * headW / 2)} ${f(baseY - ny * headW / 2)}Z`;
    return { stroke: `M${f(ax)} ${f(ay)}L${f(baseX + ux * 0.5)} ${f(baseY + uy * 0.5)}`, fill: null, head };
}
