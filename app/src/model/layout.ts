import { setItemBox } from './commands';
import { boxBounds, rectContains } from './geometry';
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
