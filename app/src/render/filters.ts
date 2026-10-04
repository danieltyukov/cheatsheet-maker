import type { ImageFilters, Rect } from '../model/types';

export interface RGBAImage {
    data: Uint8ClampedArray<ArrayBuffer>;
    width: number;
    height: number;
}

export function isIdentity(f: ImageFilters): boolean {
    return f.whiteToAlpha <= 0 && !f.invert && !f.grayscale && f.contrast === 1;
}

export function filtersKey(f: ImageFilters): string {
    return `${f.whiteToAlpha.toFixed(3)}|${f.invert ? 1 : 0}|${f.grayscale ? 1 : 0}|${f.contrast.toFixed(3)}`;
}

/**
 * Order matters: invert first, so a dark slide becomes dark ink on white, and
 * white-to-transparent last, so that white can then disappear.
 */
export function applyFilters(src: RGBAImage, f: ImageFilters): RGBAImage {
    const d = new Uint8ClampedArray(src.data);
    const t = Math.min(0.95, Math.max(0, f.whiteToAlpha));
    for (let i = 0; i < d.length; i += 4) {
        let r = d[i], g = d[i + 1], b = d[i + 2];
        if (f.invert) {
            r = 255 - r;
            g = 255 - g;
            b = 255 - b;
        }
        if (f.grayscale) r = g = b = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (f.contrast !== 1) {
            r = (r - 128) * f.contrast + 128;
            g = (g - 128) * f.contrast + 128;
            b = (b - 128) * f.contrast + 128;
        }
        let a = d[i + 3];
        if (t > 0) {
            r = Math.max(0, Math.min(255, r));
            g = Math.max(0, Math.min(255, g));
            b = Math.max(0, Math.min(255, b));
            const dist = Math.max(255 - r, 255 - g, 255 - b) / 255;
            const keep = dist <= t ? 0 : (dist - t) / (1 - t);
            if (keep > 0) {
                // Un-premultiply against white so the pixel still looks the same on paper.
                r = 255 - (255 - r) / keep;
                g = 255 - (255 - g) / keep;
                b = 255 - (255 - b) / keep;
            }
            a = a * keep;
        }
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
        d[i + 3] = a;
    }
    return { data: d, width: src.width, height: src.height };
}

/** Bounding box of pixels that differ from the border colour, grown by `padding` and clamped. */
export function findTrimRect(img: RGBAImage, tolerance = 24, padding = 2): Rect | null {
    const { data, width, height } = img;
    const at = (x: number, y: number) => (y * width + x) * 4;
    const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
    const same = (i: number, j: number) => {
        if (data[i + 3] < 8 && data[j + 3] < 8) return true;
        return Math.max(Math.abs(data[i] - data[j]), Math.abs(data[i + 1] - data[j + 1]),
            Math.abs(data[i + 2] - data[j + 2]), Math.abs(data[i + 3] - data[j + 3])) <= tolerance;
    };
    // The border colour is the corner that agrees with the most other corners.
    let ref = corners[0], bestVotes = -1;
    for (const c of corners) {
        const votes = corners.filter((o) => same(c, o)).length;
        if (votes > bestVotes) {
            bestVotes = votes;
            ref = c;
        }
    }
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (same(at(x, y), ref)) continue;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
        }
    }
    if (x1 < 0) return null;
    x0 = Math.max(0, x0 - padding);
    y0 = Math.max(0, y0 - padding);
    x1 = Math.min(width - 1, x1 + padding);
    y1 = Math.min(height - 1, y1 + padding);
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
