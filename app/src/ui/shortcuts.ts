import type { Tool } from './store';

export type ActionName =
    | 'undo' | 'redo' | 'duplicate' | 'delete' | 'selectAll' | 'forward' | 'backward' | 'toFront' | 'toBack'
    | 'exportPdf' | 'exportPng' | 'importImage' | 'importPdf' | 'saveFile' | 'zoomIn' | 'zoomOut' | 'zoomReset'
    | 'zoomFit' | 'addPage' | 'shortcuts' | 'escape' | 'crop';

export type Command = { kind: 'tool'; tool: Tool } | { kind: 'nudge'; dx: number; dy: number } | { kind: 'action'; name: ActionName };

export interface KeyLike {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
}

const TOOLS: Record<string, Tool> = {
    v: 'select', h: 'hand', p: 'pen', d: 'pen', m: 'highlighter', e: 'eraser', t: 'text',
    r: 'rect', o: 'ellipse', l: 'line', a: 'arrow',
};

export function matchShortcut(e: KeyLike, isMac: boolean): Command | null {
    const mod = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const act = (name: ActionName): Command => ({ kind: 'action', name });
    if (mod) {
        if (e.altKey) return null;
        if (k === 'z') return act(e.shiftKey ? 'redo' : 'undo');
        if (k === 'y' && !e.shiftKey) return act('redo');
        if (k === 'd' && !e.shiftKey) return act('duplicate');
        if (k === 'a' && !e.shiftKey) return act('selectAll');
        if (k === ']' || k === '}') return act(e.shiftKey ? 'toFront' : 'forward');
        if (k === '[' || k === '{') return act(e.shiftKey ? 'toBack' : 'backward');
        if (k === 'e') return act(e.shiftKey ? 'exportPng' : 'exportPdf');
        if (k === 'o') return act(e.shiftKey ? 'importPdf' : 'importImage');
        if (k === 's' && !e.shiftKey) return act('saveFile');
        if (k === '=' || k === '+') return act('zoomIn');
        if (k === '-' || k === '_') return act('zoomOut');
        if (k === '0') return act('zoomReset');
        if (k === '1') return act('zoomFit');
        if (k === 'Enter') return act('addPage');
        return null; // Ctrl+C, X and V stay with the browser so copy and paste events fire.
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    if (k === 'Delete' || k === 'Backspace') return act('delete');
    if (k === 'Escape') return act('escape');
    if (k === '?') return act('shortcuts');
    if (k === 'c' && !e.shiftKey) return act('crop');
    const step = e.shiftKey ? 10 : 1;
    if (k === 'ArrowLeft') return { kind: 'nudge', dx: -step, dy: 0 };
    if (k === 'ArrowRight') return { kind: 'nudge', dx: step, dy: 0 };
    if (k === 'ArrowUp') return { kind: 'nudge', dx: 0, dy: -step };
    if (k === 'ArrowDown') return { kind: 'nudge', dx: 0, dy: step };
    if (!e.shiftKey && TOOLS[k]) return { kind: 'tool', tool: TOOLS[k] };
    if (e.shiftKey && k === 'm') return { kind: 'tool', tool: 'highlighter' };
    return null;
}

export function isEditableTarget(t: EventTarget | null): boolean {
    const el = t as HTMLElement | null;
    if (!el || !el.tagName) return false;
    return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export const SHORTCUT_LIST: Array<{ group: string; items: Array<[string, string]> }> = [
    { group: 'Tools', items: [['V', 'Select'], ['H or hold Space', 'Hand'], ['P or D', 'Pen'], ['M', 'Highlighter'], ['E', 'Eraser'], ['T', 'Text'], ['R, O, L, A', 'Rectangle, ellipse, line, arrow'], ['C', 'Crop the selected image']] },
    { group: 'Edit', items: [['Mod+Z', 'Undo'], ['Mod+Shift+Z or Mod+Y', 'Redo'], ['Mod+C, X, V', 'Copy, cut, paste'], ['Mod+D', 'Duplicate'], ['Delete', 'Delete'], ['Arrows', 'Nudge 1 pt (Shift: 10 pt)'], ['Mod+A', 'Select all on the page'], ['Mod+] and Mod+[', 'Forward and backward (Shift: to front, to back)']] },
    { group: 'File', items: [['Mod+O', 'Import images'], ['Mod+Shift+O', 'Import from a PDF'], ['Mod+S', 'Save a .cheatsheet file'], ['Mod+E', 'Export PDF'], ['Mod+Shift+E', 'Export PNG']] },
    { group: 'View', items: [['Mod+plus, minus, 0', 'Zoom in, out, 100%'], ['Mod+1', 'Fit width'], ['Mod+Enter', 'Add a page'], ['?', 'This sheet']] },
];
