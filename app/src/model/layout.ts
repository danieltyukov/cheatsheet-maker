import { findItem, setItemBox, translateItems } from './commands';
import { boxBounds, rectContains, unionRect } from './geometry';
import { newId } from './ids';
import { arrange, fitScale, type Placement } from './pack';
import { printableArea } from './pageSizes';
import type { CheatDocument, Id, Item, Page, Rect } from './types';

export type PackMode = 'arrange' | 'fit';

export function isPackable(i: Item): boolean {
    if (i.locked) return false;
    return i.kind === 'image' || i.kind === 'text' || (i.kind === 'shape' && (i.shape === 'rect' || i.shape === 'ellipse'));
}

/** Map `item` so that the rectangle `from` lands on placement `to` inside `area`. */
function moveInto(item: Item, from: Rect, to: Placement, area: Rect): Item {
    const s = from.w > 0 ? to.w / from.w : from.h > 0 ? to.h / from.h : 1;
    const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
    const ncx = area.x + to.x + (cx - from.x) * s;
    const ncy = area.y + to.y + (cy - from.y) * s;
    const w = item.w * s, h = item.h * s;
    let out = setItemBox(item, { x: ncx - w / 2, y: ncy - h / 2, w, h, rotation: item.rotation });
    if (s !== 1) {
        if (out.kind === 'text') out = { ...out, fontSize: out.fontSize * s, padding: out.padding * s };
        else if (out.kind === 'stroke') out = { ...out, size: out.size * s };
    }
    return out;
}

export function packPage(doc: CheatDocument, pageIndex: number, ids: Id[] | null, mode: PackMode, gap: number): CheatDocument {
    const page = doc.pages[pageIndex];
    if (!page) return doc;
    const pick = ids ? new Set(ids) : null;
    const packed = page.items.filter((i) => isPackable(i) && (!pick || pick.has(i.id)));
    if (packed.length === 0) return doc;
    const bounds = new Map(packed.map((i) => [i.id, boxBounds(i)]));

    // Strokes, lines and arrows drawn inside one packed item travel with it.
    const owner = new Map<Id, Id>();
    for (const a of page.items) {
        if (isPackable(a) || a.locked || a.kind === 'image' || a.kind === 'text') continue;
        if (a.kind === 'shape' && (a.shape === 'rect' || a.shape === 'ellipse')) continue;
        const ab = boxBounds(a);
        let best: Rect | null = null;
        for (const p of packed) {
            const pb = bounds.get(p.id)!;
            if (rectContains(pb, ab, 1) && (!best || pb.w * pb.h < best.w * best.h)) {
                best = pb;
                owner.set(a.id, p.id);
            }
        }
    }

    const area = printableArea(doc.setup);
    const boxes = packed.map((i) => ({ id: i.id, w: bounds.get(i.id)!.w, h: bounds.get(i.id)!.h }));
    const fitted = mode === 'fit' ? fitScale(boxes, area.w, area.h, gap) : null;
    const placements = fitted ? fitted.placements : arrange(boxes, area.w, area.h, gap);
    const at = new Map(placements.map((p) => [p.id, p]));

    const moved = new Map<Id, { item: Item; bin: number }>();
    for (const i of page.items) {
        const ownerId = at.has(i.id) ? i.id : owner.get(i.id);
        const p = ownerId ? at.get(ownerId) : undefined;
        if (!ownerId || !p) continue;
        moved.set(i.id, { item: moveInto(i, bounds.get(ownerId)!, p, area), bin: p.bin });
    }

    const binCount = Math.max(...placements.map((p) => p.bin)) + 1;
    const onBin = (b: number) => page.items.flatMap((i) => {
        const m = moved.get(i.id);
        if (!m) return b === 0 ? [i] : [];
        return m.bin === b ? [m.item] : [];
    });
    const newPages: Page[] = [{ ...page, items: onBin(0) }];
    for (let b = 1; b < binCount; b++) newPages.push({ id: newId(), items: onBin(b) });
    const pages = [...doc.pages];
    pages.splice(pageIndex, 1, ...newPages);
    return { ...doc, pages };
}

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

export function alignItems(doc: CheatDocument, ids: Id[], mode: AlignMode): CheatDocument {
    const found = ids.map((id) => findItem(doc, id)).filter((f): f is NonNullable<typeof f> => f !== null && !f.item.locked);
    if (found.length === 0) return doc;
    const target = found.length === 1 ? printableArea(doc.setup) : unionRect(found.map((f) => boxBounds(f.item)))!;
    let out = doc;
    for (const f of found) {
        const b = boxBounds(f.item);
        let dx = 0, dy = 0;
        if (mode === 'left') dx = target.x - b.x;
        if (mode === 'hcenter') dx = target.x + target.w / 2 - (b.x + b.w / 2);
        if (mode === 'right') dx = target.x + target.w - (b.x + b.w);
        if (mode === 'top') dy = target.y - b.y;
        if (mode === 'vcenter') dy = target.y + target.h / 2 - (b.y + b.h / 2);
        if (mode === 'bottom') dy = target.y + target.h - (b.y + b.h);
        out = translateItems(out, [f.item.id], dx, dy);
    }
    return out;
}

export function distributeItems(doc: CheatDocument, ids: Id[], axis: 'h' | 'v'): CheatDocument {
    const found = ids.map((id) => findItem(doc, id)).filter((f): f is NonNullable<typeof f> => f !== null && !f.item.locked);
    if (found.length < 3) return doc;
    const withBounds = found.map((f) => ({ id: f.item.id, b: boxBounds(f.item) }));
    const start = (r: Rect) => (axis === 'h' ? r.x : r.y);
    const size = (r: Rect) => (axis === 'h' ? r.w : r.h);
    withBounds.sort((a, b) => start(a.b) - start(b.b));
    const first = withBounds[0].b, last = withBounds[withBounds.length - 1].b;
    const span = start(last) + size(last) - start(first);
    const total = withBounds.reduce((a, x) => a + size(x.b), 0);
    const gap = (span - total) / (withBounds.length - 1);
    let cursor = start(first);
    let out = doc;
    for (const { id, b } of withBounds) {
        const d = cursor - start(b);
        out = axis === 'h' ? translateItems(out, [id], d, 0) : translateItems(out, [id], 0, d);
        cursor += size(b) + gap;
    }
    return out;
}
