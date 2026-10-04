import { boxBounds, hitItem, rectsIntersect } from './geometry';
import type { Id, Item, Point, Rect } from './types';

export function topItemAt(items: Item[], p: Point, tol: number): Item | null {
    for (let i = items.length - 1; i >= 0; i--) if (hitItem(items[i], p, tol)) return items[i];
    return null;
}

export function itemsInRect(items: Item[], r: Rect): Item[] {
    return items.filter((i) => rectsIntersect(boxBounds(i), r));
}

export function strokesTouched(items: Item[], a: Point, b: Point, radius: number): Id[] {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(len / Math.max(0.5, radius / 2)));
    const out: Id[] = [];
    for (const item of items) {
        if (item.kind !== 'stroke' || item.locked) continue;
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            if (hitItem(item, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, radius)) {
                out.push(item.id);
                break;
            }
        }
    }
    return out;
}
