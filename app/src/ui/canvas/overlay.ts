import { findItem } from '../../model/commands';
import { fullImageRect } from '../../model/crop';
import { boxCorners, handlePositions, itemMatrix, lineEndpoints, type Handle } from '../../model/geometry';
import { pageDimensions } from '../../model/pageSizes';
import type { CheatDocument, Item, Point } from '../../model/types';
import { drawItem } from '../../render/drawPage';
import type { EditorAssets } from '../editorAssets';
import type { EditorState } from '../store';
import type { GestureController } from './gestures';
import { fromPagePoint, toScreen } from './viewport';

export interface OverlayEnv {
    state: EditorState;
    doc: CheatDocument;
    ctrl: GestureController;
    assets: EditorAssets;
    dpr: number;
    coarse: boolean;
    ink: string;
}

const FOCUS = '#2f6fdb';
const CROP = '#f2b705';
const GUIDE = '#e64980';

const isLine = (i: Item) => i.kind === 'shape' && (i.shape === 'line' || i.shape === 'arrow');

export function drawOverlay(ctx: CanvasRenderingContext2D, env: OverlayEnv): void {
    const { state, doc, ctrl, assets, dpr } = env;
    const v = state.view;
    const scr = (page: number, p: Point) => toScreen(v, fromPagePoint(doc.setup, page, p));
    const screenSpace = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pageSpace = (page: number) => {
        const o = scr(page, { x: 0, y: 0 });
        ctx.setTransform(dpr * v.zoom, 0, 0, dpr * v.zoom, dpr * o.x, dpr * o.y);
    };
    const poly = (page: number, pts: Point[]) => {
        ctx.beginPath();
        pts.forEach((p, i) => {
            const s = scr(page, p);
            if (i) ctx.lineTo(s.x, s.y);
            else ctx.moveTo(s.x, s.y);
        });
        ctx.closePath();
    };
    const outline = (page: number, item: Item) => {
        if (isLine(item) && item.kind === 'shape') {
            const [a, b] = lineEndpoints(item).map((p) => scr(page, p));
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
        } else poly(page, boxCorners(item));
    };

    ctx.save();
    screenSpace();

    // Hover: a faint outline on what a click would pick.
    if (ctrl.hover && state.tool === 'select' && !state.selection.includes(ctrl.hover)) {
        const f = findItem(doc, ctrl.hover);
        if (f) {
            outline(f.pageIndex, f.item);
            ctx.strokeStyle = 'rgba(47, 111, 219, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    // Crop mode: the whole source faintly around the kept part, and a yellow frame.
    const crop = state.cropId ? findItem(doc, state.cropId) : null;
    if (crop && crop.item.kind === 'image') {
        const item = crop.item;
        const asset = doc.assets[item.assetId] ?? { width: item.crop.w, height: item.crop.h };
        const src = assets.image(item);
        if (src) {
            pageSpace(crop.pageIndex);
            const m = itemMatrix(item);
            ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
            const full = fullImageRect(item, asset);
            ctx.globalAlpha = 0.35;
            ctx.drawImage(src, full.x, full.y, full.w, full.h);
            ctx.globalAlpha = 1;
            ctx.drawImage(src, item.crop.x, item.crop.y, item.crop.w, item.crop.h, 0, 0, item.w, item.h);
            screenSpace();
        }
        const c = boxCorners(item).map((p) => scr(crop.pageIndex, p));
        ctx.beginPath();
        c.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.strokeStyle = CROP;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
            const p = c[i], prev = c[(i + 3) % 4], next = c[(i + 1) % 4];
            const arm = (to: Point) => {
                const len = Math.hypot(to.x - p.x, to.y - p.y) || 1;
                const k = Math.min(14, len / 3) / len;
                ctx.lineTo(p.x + (to.x - p.x) * k, p.y + (to.y - p.y) * k);
            };
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            arm(prev);
            ctx.moveTo(p.x, p.y);
            arm(next);
            ctx.stroke();
            const mid = { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 };
            const len = Math.hypot(next.x - p.x, next.y - p.y) || 1;
            const ux = ((next.x - p.x) / len) * 8, uy = ((next.y - p.y) / len) * 8;
            ctx.beginPath();
            ctx.moveTo(mid.x - ux, mid.y - uy);
            ctx.lineTo(mid.x + ux, mid.y + uy);
            ctx.stroke();
        }
        ctx.lineCap = 'butt';
    }

    // Selection outlines, and handles for a single unlocked item.
    const selected = state.selection.map((id) => findItem(doc, id)).filter((f): f is NonNullable<typeof f> => !!f);
    ctx.strokeStyle = FOCUS;
    ctx.lineWidth = 1.5;
    for (const f of selected) {
        if (f.item.id === state.cropId || f.item.id === state.editingTextId) continue;
        ctx.setLineDash(f.item.locked ? [4, 3] : []);
        outline(f.pageIndex, f.item);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    const one = selected.length === 1 ? selected[0] : null;
    if (one && !one.item.locked && state.tool === 'select' && !state.cropId && !state.editingTextId) {
        const { item, pageIndex } = one;
        const hs = env.coarse ? 12 : 8;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = FOCUS;
        ctx.lineWidth = 1.5;
        if (isLine(item) && item.kind === 'shape') {
            for (const p of lineEndpoints(item)) {
                const s = scr(pageIndex, p);
                ctx.beginPath();
                ctx.arc(s.x, s.y, hs * 0.65, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        } else {
            const pos = handlePositions(item, 24 / v.zoom);
            const names: Handle[] = item.kind === 'text' ? ['w', 'e'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
            const top = scr(pageIndex, pos.n), rot = scr(pageIndex, pos.rotate);
            ctx.beginPath();
            ctx.moveTo(top.x, top.y);
            ctx.lineTo(rot.x, rot.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(rot.x, rot.y, hs * 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            for (const n of names) {
                const s = scr(pageIndex, pos[n]);
                ctx.beginPath();
                ctx.rect(s.x - hs / 2, s.y - hs / 2, hs, hs);
                ctx.fill();
                ctx.stroke();
            }
        }
    }

    // Marquee.
    if (ctrl.marquee) {
        const r = ctrl.marquee.rect;
        poly(ctrl.marquee.page, [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }]);
        ctx.fillStyle = 'rgba(47, 111, 219, 0.08)';
        ctx.fill();
        ctx.strokeStyle = FOCUS;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Snap guides across the whole page.
    const g = state.snapGuides;
    if (g) {
        const { w, h } = pageDimensions(doc.setup);
        ctx.strokeStyle = GUIDE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (g.x !== null) {
            const a = scr(g.page, { x: g.x, y: 0 }), b = scr(g.page, { x: g.x, y: h });
            ctx.moveTo(Math.round(a.x) + 0.5, a.y);
            ctx.lineTo(Math.round(b.x) + 0.5, b.y);
        }
        if (g.y !== null) {
            const a = scr(g.page, { x: 0, y: g.y }), b = scr(g.page, { x: w, y: g.y });
            ctx.moveTo(a.x, Math.round(a.y) + 0.5);
            ctx.lineTo(b.x, Math.round(b.y) + 0.5);
        }
        ctx.stroke();
    }

    // The stroke being drawn.
    if (ctrl.live) {
        pageSpace(ctrl.live.page);
        drawItem(ctx, ctrl.live.item, assets);
        screenSpace();
    }

    // Eraser cursor.
    if (ctrl.eraser) {
        const s = scr(ctrl.eraser.page, ctrl.eraser.p);
        ctx.beginPath();
        ctx.arc(s.x, s.y, ctrl.eraser.r * v.zoom, 0, Math.PI * 2);
        ctx.strokeStyle = env.ink;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    ctx.restore();
}
