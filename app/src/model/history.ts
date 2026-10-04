import type { CheatDocument } from './types';

export const HISTORY_LIMIT = 200;

export interface History {
    past: CheatDocument[];
    present: CheatDocument;
    future: CheatDocument[];
    /** Document at the start of the current drag, crop or resize; null when no gesture is running. */
    gestureBase: CheatDocument | null;
}

export function createHistory(doc: CheatDocument): History {
    return { past: [], present: doc, future: [], gestureBase: null };
}

function pushPast(past: CheatDocument[], doc: CheatDocument): CheatDocument[] {
    const next = [...past, doc];
    return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

export function commit(h: History, next: CheatDocument): History {
    if (h.gestureBase) return updateGesture(h, next);
    if (next === h.present) return h;
    return { past: pushPast(h.past, h.present), present: next, future: [], gestureBase: null };
}

/** Replace the present without recording a step (derived data such as measured text heights). */
export function amend(h: History, next: CheatDocument): History {
    return next === h.present ? h : { ...h, present: next };
}

export function beginGesture(h: History): History {
    return h.gestureBase ? h : { ...h, gestureBase: h.present };
}

export function updateGesture(h: History, next: CheatDocument): History {
    return next === h.present ? h : { ...h, present: next };
}

export function endGesture(h: History): History {
    const base = h.gestureBase;
    if (!base) return h;
    if (base === h.present) return { ...h, gestureBase: null };
    return { past: pushPast(h.past, base), present: h.present, future: [], gestureBase: null };
}

export function cancelGesture(h: History): History {
    return h.gestureBase ? { ...h, present: h.gestureBase, gestureBase: null } : h;
}

export const canUndo = (h: History) => h.past.length > 0 || (h.gestureBase !== null && h.gestureBase !== h.present);
export const canRedo = (h: History) => h.future.length > 0;

export function undo(h: History): History {
    const ended = endGesture(h);
    if (ended.past.length === 0) return ended;
    const prev = ended.past[ended.past.length - 1];
    return { past: ended.past.slice(0, -1), present: prev, future: [ended.present, ...ended.future], gestureBase: null };
}

export function redo(h: History): History {
    const ended = endGesture(h);
    if (ended.future.length === 0) return ended;
    const [next, ...rest] = ended.future;
    return { past: pushPast(ended.past, ended.present), present: next, future: rest, gestureBase: null };
}
