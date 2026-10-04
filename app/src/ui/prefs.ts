import type { LibraryApi } from '../storage/library';
import { DEFAULT_OPTIONS, type EditorState } from './store';

export type Prefs = Pick<EditorState, 'options' | 'exportDpi' | 'pdfImportDpi' | 'packGap' | 'showGuides'>;

export function pickPrefs(s: EditorState): Prefs {
    return { options: s.options, exportDpi: s.exportDpi, pdfImportDpi: s.pdfImportDpi, packGap: s.packGap, showGuides: s.showGuides };
}

export function samePrefs(a: Prefs, b: Prefs): boolean {
    return a.options === b.options && a.exportDpi === b.exportDpi && a.pdfImportDpi === b.pdfImportDpi && a.packGap === b.packGap && a.showGuides === b.showGuides;
}

export async function loadPrefs(library: LibraryApi): Promise<Partial<Prefs>> {
    try {
        const p = await library.getMeta<Partial<Prefs>>('prefs');
        if (!p || typeof p !== 'object') return {};
        // Merge tool options so options added in later versions get their defaults.
        return { ...p, options: { ...DEFAULT_OPTIONS, ...(p.options ?? {}), text: { ...DEFAULT_OPTIONS.text, ...(p.options?.text ?? {}) } } };
    } catch {
        return {};
    }
}

export async function savePrefs(library: LibraryApi, prefs: Prefs): Promise<void> {
    try {
        await library.setMeta('prefs', prefs);
    } catch {
        // Preferences are a convenience; losing them is not worth an error.
    }
}
