import { apply, itemMatrix, type ResizeHandle } from './geometry';
import type { ImageItem, Point, Rect } from './types';

export const MIN_CROP_PX = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The whole source image in the item's local coordinates. */
export function fullImageRect(item: ImageItem, image: { width: number; height: number }): Rect {
    const sx = item.w / item.crop.w, sy = item.h / item.crop.h;
    return { x: -item.crop.x * sx, y: -item.crop.y * sy, w: image.width * sx, h: image.height * sy };
}

export function cropDrag(start: ImageItem, handle: ResizeHandle | 'pan', d: Point, image: { width: number; height: number }): ImageItem {
    const sx = start.w / start.crop.w, sy = start.h / start.crop.h;
    const c = start.crop;
    // Crops stay on whole source pixels: pixel work such as auto-trim and export reads them as indices.
    const R = Math.round;
    if (handle === 'pan') {
        return {
            ...start,
            crop: { ...c, x: R(clamp(c.x - d.x / sx, 0, image.width - c.w)), y: R(clamp(c.y - d.y / sy, 0, image.height - c.h)) },
        };
    }
    let x0 = c.x, y0 = c.y, x1 = c.x + c.w, y1 = c.y + c.h;
    if (handle.includes('w')) x0 = R(clamp(c.x + d.x / sx, 0, x1 - MIN_CROP_PX));
    if (handle.includes('e')) x1 = R(clamp(x1 + d.x / sx, x0 + MIN_CROP_PX, image.width));
    if (handle.includes('n')) y0 = R(clamp(c.y + d.y / sy, 0, y1 - MIN_CROP_PX));
    if (handle.includes('s')) y1 = R(clamp(y1 + d.y / sy, y0 + MIN_CROP_PX, image.height));
    // New box edges in the start item's local frame, at the same scale.
    const l = (x0 - c.x) * sx, t = (y0 - c.y) * sy;
    const r = start.w + (x1 - (c.x + c.w)) * sx, b = start.h + (y1 - (c.y + c.h)) * sy;
    const w = r - l, h = b - t;
    const centre = apply(itemMatrix(start), { x: (l + r) / 2, y: (t + b) / 2 });
    return { ...start, x: centre.x - w / 2, y: centre.y - h / 2, w, h, crop: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}
