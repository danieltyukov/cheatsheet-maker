import type { CheatDocument, Id, ImageItem } from './types';

export const MIN_DPI = 150;
export const MIN_TEXT_PT = 5;

export interface PrintIssue {
    itemId: Id;
    pageIndex: number;
    kind: 'low-dpi' | 'small-text';
    value: number;
    message: string;
}

export function effectiveDpi(item: Pick<ImageItem, 'crop' | 'w' | 'h'>): number {
    const dx = item.w > 0 ? item.crop.w / (item.w / 72) : Infinity;
    const dy = item.h > 0 ? item.crop.h / (item.h / 72) : Infinity;
    return Math.min(dx, dy);
}

export function printCheck(doc: CheatDocument): PrintIssue[] {
    const out: PrintIssue[] = [];
    doc.pages.forEach((page, pageIndex) => {
        for (const item of page.items) {
            if (item.kind === 'image') {
                const dpi = effectiveDpi(item);
                if (dpi < MIN_DPI) {
                    out.push({
                        itemId: item.id, pageIndex, kind: 'low-dpi', value: dpi,
                        message: `Prints at ${Math.round(dpi)} DPI and may look blurry. Make it smaller or use a sharper source.`,
                    });
                }
            } else if (item.kind === 'text' && item.fontSize < MIN_TEXT_PT) {
                out.push({
                    itemId: item.id, pageIndex, kind: 'small-text', value: item.fontSize,
                    message: `Text is ${item.fontSize.toFixed(1)} pt; under ${MIN_TEXT_PT} pt is hard to read on paper.`,
                });
            }
        }
    });
    return out;
}
