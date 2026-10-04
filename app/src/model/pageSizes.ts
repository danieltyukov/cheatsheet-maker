import type { PageSetup, PageSize, Rect } from './types';

const MM = 72 / 25.4;

export const PAGE_SIZES: Record<PageSize, { w: number; h: number; label: string }> = {
    A4: { w: 210 * MM, h: 297 * MM, label: 'A4' },
    Letter: { w: 612, h: 792, label: 'US Letter' },
    A3: { w: 297 * MM, h: 420 * MM, label: 'A3' },
    A5: { w: 148 * MM, h: 210 * MM, label: 'A5' },
    Legal: { w: 612, h: 1008, label: 'US Legal' },
};

export function pageDimensions(setup: Pick<PageSetup, 'size' | 'orientation'>): { w: number; h: number } {
    const s = PAGE_SIZES[setup.size];
    return setup.orientation === 'landscape' ? { w: s.h, h: s.w } : { w: s.w, h: s.h };
}

export function printableArea(setup: PageSetup): Rect {
    const { w, h } = pageDimensions(setup);
    const m = setup.margin;
    return { x: m, y: m, w: Math.max(0, w - 2 * m), h: Math.max(0, h - 2 * m) };
}

/** x positions of both edges of each gutter between columns. */
export function columnGuides(setup: PageSetup): number[] {
    if (setup.columns <= 1) return [];
    const area = printableArea(setup);
    const colW = (area.w - setup.gutter * (setup.columns - 1)) / setup.columns;
    const out: number[] = [];
    for (let i = 1; i < setup.columns; i++) {
        const left = area.x + i * colW + (i - 1) * setup.gutter;
        out.push(left, left + setup.gutter);
    }
    return out;
}
