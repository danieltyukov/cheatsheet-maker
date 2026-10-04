import { addItems, findItem, moveItemsToPage, removeItems, setBoxes, updateItems } from '../../model/commands';
import { cropDrag } from '../../model/crop';
import { createShapeItem, createStrokeItem, createTextItem } from '../../model/factory';
import {
    boxBounds, boxFromLine, handleAt, hitItem, lineEndpoints, resizeBox, rotateBox, rotation, apply as applyM,
    unionRect, type Handle, type ResizeHandle,
} from '../../model/geometry';
import { itemsInRect, strokesTouched, topItemAt } from '../../model/hits';
import { snapRect, snapTargets } from '../../model/snap';
import type { Box, Id, ImageItem, Item, Point, Rect, ShapeItem, ShapeKind, StrokeItem, TextItem } from '../../model/types';
import type { EditorAssets } from '../editorAssets';
import type { EditorStore, View } from '../store';
import { clampView, pageAt, pageTops, toPagePoint, toWorld, zoomAround } from './viewport';

export interface PointerInfo {
    id: number;
    x: number;
    y: number;
    button: number;
    pointerType: string;
    pressure: number;
    shiftKey: boolean;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
}

type Drag =
    | { kind: 'pan'; start: Point; view: View }
    | { kind: 'move'; page: number; start: Point; startScreen: Point; items: Item[]; started: boolean }
    | { kind: 'resize'; page: number; start: Point; item: Item; handle: ResizeHandle; started: boolean }
    | { kind: 'rotate'; page: number; start: Point; item: Item; started: boolean }
    | { kind: 'line-end'; page: number; item: ShapeItem; fixed: Point; movingIsA: boolean; started: boolean }
    | { kind: 'crop'; page: number; start: Point; item: ImageItem; handle: ResizeHandle | 'pan'; started: boolean }
    | { kind: 'marquee'; page: number; start: Point; base: Id[] }
    | { kind: 'draw'; page: number; points: number[]; tool: 'pen' | 'highlighter' }
    | { kind: 'erase'; page: number; last: Point }
    | { kind: 'shape'; page: number; start: Point; id: Id; shape: ShapeKind }
    | { kind: 'text'; page: number; start: Point; current: Point }
    | { kind: 'pinch'; startDist: number; startMid: Point; view: View };

const isLine = (i: Item): i is ShapeItem => i.kind === 'shape' && (i.shape === 'line' || i.shape === 'arrow');

/** Text boxes only resize sideways (their height follows the text), so only those handles exist. */
const TEXT_HANDLES: readonly Handle[] = ['w', 'e', 'rotate'];
export const drawnHandles = (i: Item): readonly Handle[] | undefined => (i.kind === 'text' ? TEXT_HANDLES : undefined);

export class GestureController {
    private pointers = new Map<number, Point>();
    private drag: Drag | null = null;
    spaceHeld = false;
    hover: Id | null = null;
    cursor = 'default';
    live: { page: number; item: StrokeItem } | null = null;
    marquee: { page: number; rect: Rect } | null = null;
    eraser: { page: number; p: Point; r: number } | null = null;

    constructor(
        private store: EditorStore,
        private assets: EditorAssets,
        private size: () => { w: number; h: number },
        private onChange: () => void,
    ) {}

    private get st() { return this.store.getState(); }
    private px(n: number) { return n / this.st.view.zoom; }
    private world(s: Point) { return toWorld(this.st.view, s); }
    private hitPage(s: Point) {
        const doc = this.store.doc;
        const { index } = pageAt(doc.setup, doc.pages.length, this.world(s));
        return { index, p: toPagePoint(doc.setup, index, this.world(s)) };
    }
    private onPage(page: number, s: Point) { return toPagePoint(this.store.doc.setup, page, this.world(s)); }
    private setView(v: View) {
        const { w, h } = this.size();
        this.store.setView(clampView(v, this.store.doc.setup, this.store.doc.pages.length, w, h));
    }
    private begin(d: { started: boolean }) {
        if (!d.started) {
            d.started = true;
            this.store.beginGesture();
        }
    }

    down(e: PointerInfo) {
        this.pointers.set(e.id, { x: e.x, y: e.y });
        if (this.pointers.size === 2 && e.pointerType === 'touch') {
            this.cancel();
            const [a, b] = [...this.pointers.values()];
            this.drag = { kind: 'pinch', startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1, startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view: this.st.view };
            return;
        }
        if (this.pointers.size > 1) return;
        const tool = this.st.tool;
        if (e.button === 1 || e.button === 2 || tool === 'hand' || this.spaceHeld) {
            this.drag = { kind: 'pan', start: { x: e.x, y: e.y }, view: this.st.view };
            this.cursor = 'grabbing';
            return;
        }
        if (e.button !== 0) return;
        const { index, p } = this.hitPage(e);
        this.store.setCurrentPage(index);
        const o = this.st.options;
        switch (tool) {
            case 'pen':
            case 'highlighter':
                this.drag = { kind: 'draw', page: index, points: [p.x, p.y, e.pointerType === 'pen' ? e.pressure : 0.5], tool };
                this.live = { page: index, item: createStrokeItem([p.x, p.y, 0.5], tool, tool === 'pen' ? o.penColor : o.highlighterColor, tool === 'pen' ? o.penSize : o.highlighterSize) };
                this.onChange();
                return;
            case 'eraser':
                this.store.beginGesture();
                this.drag = { kind: 'erase', page: index, last: p };
                this.eraseAlong(index, p, p);
                return;
            case 'rect':
            case 'ellipse':
            case 'line':
            case 'arrow': {
                const s = createShapeItem(tool, { x: p.x, y: p.y, w: 0, h: 0 }, { stroke: o.shapeStroke, strokeWidth: o.shapeWidth, fill: tool === 'rect' || tool === 'ellipse' ? o.shapeFill : null });
                this.store.beginGesture();
                this.store.apply((d) => addItems(d, index, [s]));
                this.drag = { kind: 'shape', page: index, start: p, id: s.id, shape: tool };
                return;
            }
            case 'text':
                this.drag = { kind: 'text', page: index, start: p, current: p };
                return;
            default:
                this.selectDown(index, p, e);
        }
    }

    private selectDown(index: number, p: Point, e: PointerInfo) {
        const doc = this.store.doc;
        const page = doc.pages[index];
        const st = this.st;
        const tol = this.px(e.pointerType === 'touch' ? 16 : 8);
        if (st.cropId) {
            const f = findItem(doc, st.cropId);
            if (f && f.item.kind === 'image' && f.pageIndex === index) {
                const h = handleAt(f.item, p, tol, -1e6);
                if (h && h !== 'rotate') {
                    this.drag = { kind: 'crop', page: index, start: p, item: f.item, handle: h, started: false };
                    return;
                }
                if (hitItem(f.item, p, 0)) {
                    this.drag = { kind: 'crop', page: index, start: p, item: f.item, handle: 'pan', started: false };
                    return;
                }
            }
            this.store.setCrop(null);
        }
        if (st.selection.length === 1) {
            const f = findItem(doc, st.selection[0]);
            // Inside a small item every point is near some handle; there, a press means move.
            const small = f && Math.min(f.item.w, f.item.h) * st.view.zoom < 4 * (e.pointerType === 'touch' ? 16 : 8);
            const inside = f && hitItem(f.item, p, 0);
            if (f && f.pageIndex === index && !f.item.locked && !(small && inside && !isLine(f.item))) {
                const h = handleAt(f.item, p, tol, isLine(f.item) ? -1e6 : this.px(24), drawnHandles(f.item));
                if (h && isLine(f.item)) {
                    const [a, b] = lineEndpoints(f.item);
                    this.drag = { kind: 'line-end', page: index, item: f.item, fixed: h === 'nw' ? b : a, movingIsA: h === 'nw', started: false };
                    return;
                }
                if (h === 'rotate') {
                    this.drag = { kind: 'rotate', page: index, start: p, item: f.item, started: false };
                    return;
                }
                if (h) {
                    this.drag = { kind: 'resize', page: index, start: p, item: f.item, handle: h, started: false };
                    return;
                }
            }
        }
        const hit = topItemAt(page.items, p, this.px(3));
        if (!hit) {
            if (!e.shiftKey) this.store.select([]);
            this.drag = { kind: 'marquee', page: index, start: p, base: e.shiftKey ? st.selection : [] };
            return;
        }
        let sel = st.selection.filter((id) => page.items.some((i) => i.id === id));
        if (e.shiftKey) sel = sel.includes(hit.id) ? sel.filter((i) => i !== hit.id) : [...sel, hit.id];
        else if (!sel.includes(hit.id)) sel = [hit.id];
        this.store.select(sel);
        const items = page.items.filter((i) => sel.includes(i.id) && !i.locked);
        if (items.length && sel.includes(hit.id)) {
            this.drag = { kind: 'move', page: index, start: p, startScreen: { x: e.x, y: e.y }, items, started: false };
        }
    }

    doubleClick(s: Point) {
        if (this.st.tool !== 'select') return;
        const { index, p } = this.hitPage(s);
        const hit = topItemAt(this.store.doc.pages[index].items, p, this.px(3));
        if (hit?.kind === 'text' && !hit.locked) {
            this.store.beginGesture();
            this.store.setEditingText(hit.id);
        } else if (hit?.kind === 'image' && !hit.locked) this.store.setCrop(hit.id);
    }

    move(e: PointerInfo) {
        if (!this.pointers.has(e.id)) {
            this.hoverAt(e);
            return;
        }
        this.pointers.set(e.id, { x: e.x, y: e.y });
        const d = this.drag;
        if (!d) return;
        const doc = this.store.doc;
        switch (d.kind) {
            case 'pinch': {
                const [a, b] = [...this.pointers.values()];
                if (!a || !b) return;
                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                const zoomed = zoomAround(d.view, dist / d.startDist, d.startMid);
                this.setView({ ...zoomed, scrollX: zoomed.scrollX - (mid.x - d.startMid.x) / zoomed.zoom, scrollY: zoomed.scrollY - (mid.y - d.startMid.y) / zoomed.zoom });
                return;
            }
            case 'pan':
                this.setView({ ...d.view, scrollX: d.view.scrollX - (e.x - d.start.x) / d.view.zoom, scrollY: d.view.scrollY - (e.y - d.start.y) / d.view.zoom });
                return;
            case 'move': {
                if (!d.started && Math.hypot(e.x - d.startScreen.x, e.y - d.startScreen.y) < 3) return;
                this.begin(d);
                const p = this.onPage(d.page, e);
                let dx = p.x - d.start.x, dy = p.y - d.start.y;
                const ids = new Set(d.items.map((i) => i.id));
                if (!e.altKey) {
                    const moving = unionRect(d.items.map((i) => boxBounds({ ...i, x: i.x + dx, y: i.y + dy })))!;
                    const others = doc.pages[d.page].items.filter((i) => !ids.has(i.id)).map(boxBounds);
                    const snap = snapRect(moving, snapTargets(doc.setup, others), this.px(6), doc.setup.grid);
                    dx += snap.dx;
                    dy += snap.dy;
                    this.store.setSnapGuides({ page: d.page, x: snap.guideX, y: snap.guideY });
                }
                const boxes: Record<Id, Box> = {};
                for (const i of d.items) boxes[i.id] = { x: i.x + dx, y: i.y + dy, w: i.w, h: i.h, rotation: i.rotation };
                this.store.apply((doc2) => setBoxes(doc2, boxes));
                return;
            }
            case 'resize': {
                this.begin(d);
                const p = this.onPage(d.page, e);
                const delta = { x: p.x - d.start.x, y: p.y - d.start.y };
                if (d.item.kind === 'text') {
                    const handle = (d.handle.includes('w') ? 'w' : d.handle.includes('e') ? 'e' : null);
                    if (!handle) return;
                    const box = resizeBox(d.item, handle, delta, false, d.item.fontSize * 2);
                    const next = { ...d.item, w: box.w } as TextItem;
                    const h = this.assets.textHeight(next);
                    const y = d.item.rotation ? box.y + (box.h - h) / 2 : d.item.y;
                    this.store.apply((doc2) => setBoxes(doc2, { [d.item.id]: { ...box, y, h } }));
                    return;
                }
                const keep = (d.item.kind === 'image') !== e.shiftKey;
                const box = resizeBox(d.item, d.handle, delta, keep);
                this.store.apply((doc2) => setBoxes(doc2, { [d.item.id]: box }));
                return;
            }
            case 'rotate': {
                this.begin(d);
                const p = this.onPage(d.page, e);
                const r = rotateBox(d.item, d.start, p, e.shiftKey);
                this.store.apply((doc2) => setBoxes(doc2, { [d.item.id]: { x: d.item.x, y: d.item.y, w: d.item.w, h: d.item.h, rotation: r } }));
                return;
            }
            case 'line-end': {
                this.begin(d);
                let p = this.onPage(d.page, e);
                if (e.shiftKey) p = snapAngle(d.fixed, p);
                const b = d.movingIsA ? boxFromLine(p, d.fixed) : boxFromLine(d.fixed, p);
                this.store.apply((doc2) => updateItems(doc2, { [d.item.id]: b }));
                return;
            }
            case 'crop': {
                this.begin(d);
                const p = this.onPage(d.page, e);
                const local = applyM(rotation(-d.item.rotation), { x: p.x - d.start.x, y: p.y - d.start.y });
                const asset = doc.assets[d.item.assetId];
                const out = cropDrag(d.item, d.handle, local, { width: asset?.width ?? d.item.crop.w, height: asset?.height ?? d.item.crop.h });
                this.store.apply((doc2) => updateItems(doc2, { [d.item.id]: { x: out.x, y: out.y, w: out.w, h: out.h, crop: out.crop } }));
                return;
            }
            case 'marquee': {
                const p = this.onPage(d.page, e);
                const rect = { x: Math.min(p.x, d.start.x), y: Math.min(p.y, d.start.y), w: Math.abs(p.x - d.start.x), h: Math.abs(p.y - d.start.y) };
                this.marquee = { page: d.page, rect };
                const hits = itemsInRect(doc.pages[d.page].items, rect).map((i) => i.id);
                this.store.select([...new Set([...d.base, ...hits])]);
                this.onChange();
                return;
            }
            case 'draw': {
                const p = this.onPage(d.page, e);
                d.points.push(p.x, p.y, e.pointerType === 'pen' ? e.pressure : 0.5);
                const o = this.st.options;
                this.live = { page: d.page, item: createStrokeItem(d.points, d.tool, d.tool === 'pen' ? o.penColor : o.highlighterColor, d.tool === 'pen' ? o.penSize : o.highlighterSize) };
                this.onChange();
                return;
            }
            case 'erase': {
                const p = this.onPage(d.page, e);
                this.eraseAlong(d.page, d.last, p);
                d.last = p;
                return;
            }
            case 'shape': {
                let p = this.onPage(d.page, e);
                if (e.shiftKey) p = d.shape === 'line' || d.shape === 'arrow' ? snapAngle(d.start, p) : square(d.start, p);
                const b = boxFromLine(d.start, p);
                this.store.apply((doc2) => updateItems(doc2, { [d.id]: d.shape === 'line' || d.shape === 'arrow' ? b : { ...b, flipX: false, flipY: false } }));
                return;
            }
            case 'text':
                d.current = this.onPage(d.page, e);
                return;
        }
    }

    private eraseAlong(page: number, a: Point, b: Point) {
        const r = this.px(8);
        this.eraser = { page, p: b, r };
        const ids = strokesTouched(this.store.doc.pages[page].items, a, b, r);
        if (ids.length) this.store.apply((d) => removeItems(d, ids));
        this.onChange();
    }

    up(e: PointerInfo) {
        this.pointers.delete(e.id);
        const d = this.drag;
        if (d?.kind === 'pinch') {
            if (this.pointers.size === 0) this.drag = null;
            return;
        }
        this.drag = null;
        if (this.cursor === 'grabbing') this.cursor = this.spaceHeld || this.st.tool === 'hand' ? 'grab' : 'default';
        if (!d) return;
        const doc = this.store.doc;
        switch (d.kind) {
            case 'move': {
                if (!d.started) break;
                const ids = d.items.map((i) => i.id);
                const now = ids.map((id) => findItem(this.store.doc, id)?.item).filter((i): i is Item => !!i);
                const u = unionRect(now.map(boxBounds));
                if (u) {
                    const tops = pageTops(doc.setup, doc.pages.length);
                    const centre = { x: u.x + u.w / 2, y: tops[d.page] + u.y + u.h / 2 };
                    const target = pageAt(doc.setup, doc.pages.length, centre);
                    if (target.inside && target.index !== d.page) {
                        this.store.apply((doc2) => moveItemsToPage(doc2, ids, target.index, 0, tops[d.page] - tops[target.index]));
                        this.store.setCurrentPage(target.index);
                    }
                }
                this.store.endGesture();
                break;
            }
            case 'resize':
            case 'rotate':
            case 'line-end':
            case 'crop':
                if (d.started) this.store.endGesture();
                break;
            case 'marquee':
                this.marquee = null;
                break;
            case 'draw': {
                const o = this.st.options;
                const stroke = createStrokeItem(d.points, d.tool, d.tool === 'pen' ? o.penColor : o.highlighterColor, d.tool === 'pen' ? o.penSize : o.highlighterSize);
                this.live = null;
                this.store.apply((doc2) => addItems(doc2, d.page, [stroke]));
                break;
            }
            case 'erase':
                this.eraser = null;
                this.store.endGesture();
                break;
            case 'shape': {
                const s = findItem(this.store.doc, d.id)?.item;
                if (s && Math.hypot(s.w, s.h) < 2) {
                    if (d.shape === 'rect' || d.shape === 'ellipse') {
                        this.store.apply((doc2) => updateItems(doc2, { [d.id]: { x: d.start.x - 50, y: d.start.y - 30, w: 100, h: 60 } }));
                    } else {
                        this.store.cancelGesture();
                        break;
                    }
                }
                this.store.endGesture();
                this.store.setTool('select');
                this.store.select([d.id]);
                break;
            }
            case 'text': {
                const width = Math.abs(d.current.x - d.start.x) > 20 ? Math.abs(d.current.x - d.start.x) : 200;
                const x = Math.min(d.start.x, d.current.x);
                const t = createTextItem({ x, y: d.start.y }, this.st.options.text, width);
                this.store.beginGesture();
                this.store.apply((doc2) => addItems(doc2, d.page, [t]));
                this.store.setTool('select');
                this.store.setEditingText(t.id);
                break;
            }
            default:
                break;
        }
        this.store.setSnapGuides(null);
        this.onChange();
    }

    /** Escape: abandons a drag in progress. Returns whether the key was used. */
    key(e: { key: string }): boolean {
        if (e.key !== 'Escape' || !this.drag) return false;
        this.cancel();
        return true;
    }

    /**
     * Abandons the current drag. With a pointer id (pointercancel, lost capture) only that pointer is
     * forgotten; without one, every pointer is, so the rest of a cancelled drag is ignored.
     */
    cancel(pointerId?: number) {
        if (pointerId === undefined) this.pointers.clear();
        else this.pointers.delete(pointerId);
        const d = this.drag;
        this.drag = null;
        this.live = null;
        this.marquee = null;
        this.eraser = null;
        if (d && d.kind !== 'pan' && d.kind !== 'pinch' && this.store.gestureActive) this.store.cancelGesture();
        this.onChange();
    }

    hoverAt(s: Point) {
        const st = this.st;
        if (st.tool !== 'select') {
            this.cursor = st.tool === 'hand' || this.spaceHeld ? 'grab' : st.tool === 'text' ? 'text' : 'crosshair';
            return;
        }
        if (this.spaceHeld) {
            this.cursor = 'grab';
            return;
        }
        const { index, p } = this.hitPage(s);
        const items = this.store.doc.pages[index].items;
        let cursor = 'default';
        if (st.selection.length === 1) {
            const f = findItem(this.store.doc, st.selection[0]);
            if (f && f.pageIndex === index && !f.item.locked) {
                const small = Math.min(f.item.w, f.item.h) * st.view.zoom < 32;
                const h = small && !isLine(f.item) && hitItem(f.item, p, 0) ? null : handleAt(f.item, p, this.px(8), isLine(f.item) ? -1e6 : this.px(24), drawnHandles(f.item));
                if (h === 'rotate') cursor = 'grab';
                else if (h) cursor = resizeCursor(h, f.item.rotation);
            }
        }
        const hit = topItemAt(items, p, this.px(3));
        if (cursor === 'default' && hit) cursor = hit.locked ? 'not-allowed' : 'move';
        const hover = hit?.id ?? null;
        if (hover !== this.hover || cursor !== this.cursor) {
            this.hover = hover;
            this.cursor = cursor;
            this.onChange();
        }
    }
}

function snapAngle(from: Point, to: Point): Point {
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    const a = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / (Math.PI / 4)) * (Math.PI / 4);
    return { x: from.x + Math.cos(a) * len, y: from.y + Math.sin(a) * len };
}

function square(from: Point, to: Point): Point {
    const s = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
    return { x: from.x + Math.sign(to.x - from.x || 1) * s, y: from.y + Math.sign(to.y - from.y || 1) * s };
}

const CURSORS = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'];
const HANDLE_ANGLE: Record<ResizeHandle, number> = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 };

function resizeCursor(h: ResizeHandle, rotationDeg: number): string {
    const a = (((HANDLE_ANGLE[h] + rotationDeg) % 180) + 180) % 180;
    return CURSORS[Math.round(a / 45) % 4];
}
