import type { FontKey } from '../model/types';

export const FONT_FAMILIES: Record<FontKey, string> = {
    sans: "'Atkinson Hyperlegible Next Variable', system-ui, sans-serif",
    narrow: "'Archivo Narrow Variable', 'Arial Narrow', sans-serif",
    serif: "'Source Serif 4 Variable', Georgia, serif",
    mono: "'JetBrains Mono Variable', ui-monospace, monospace",
};

export const FONT_LABELS: Record<FontKey, string> = { sans: 'Sans', narrow: 'Narrow', serif: 'Serif', mono: 'Mono' };

export interface FontSpec {
    family: FontKey;
    size: number;
    bold: boolean;
    italic: boolean;
}

export function cssFont(f: FontSpec): string {
    return `${f.italic ? 'italic ' : ''}${f.bold ? 700 : 400} ${f.size}px ${FONT_FAMILIES[f.family]}`;
}

/** Wait for every document font in regular, bold and italic so canvas measurements are final. */
export async function ensureFontsLoaded(): Promise<void> {
    if (typeof document === 'undefined' || !document.fonts) return;
    const loads: Promise<unknown>[] = [];
    for (const family of Object.keys(FONT_FAMILIES) as FontKey[]) {
        for (const bold of [false, true]) {
            for (const italic of [false, true]) loads.push(document.fonts.load(cssFont({ family, size: 16, bold, italic })));
        }
    }
    await Promise.allSettled(loads);
}
