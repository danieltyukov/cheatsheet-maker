export interface RGBA {
    r: number;
    g: number;
    b: number;
    /** 0 to 1. */
    a: number;
}

export function parseColor(css: string): RGBA {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(css.trim());
    if (!m) return { r: 0, g: 0, b: 0, a: 1 };
    let h = m[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const v = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: v(0), g: v(2), b: v(4), a: h.length === 8 ? v(6) / 255 : 1 };
}

export function toHex(c: RGBA): string {
    const two = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
    return `#${two(c.r)}${two(c.g)}${two(c.b)}${c.a < 1 ? two(c.a * 255) : ''}`;
}
