import { expect, test } from 'vitest';
import {
    HISTORY_LIMIT, amend, beginGesture, cancelGesture, canRedo, canUndo, commit, createHistory, endGesture,
    redo, undo, updateGesture,
} from './history';
import { createDocument } from './factory';
import { setTitle } from './commands';

const base = createDocument('a', 0);

test('commit, undo and redo', () => {
    let h = createHistory(base);
    const b = setTitle(base, 'b');
    h = commit(h, b);
    expect(canUndo(h)).toBe(true);
    h = undo(h);
    expect(h.present).toBe(base);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.present).toBe(b);
});

test('committing the same document is a no-op', () => {
    const h = createHistory(base);
    expect(commit(h, base)).toBe(h);
});

test('a new commit clears the redo stack', () => {
    let h = commit(createHistory(base), setTitle(base, 'b'));
    h = undo(h);
    h = commit(h, setTitle(base, 'c'));
    expect(canRedo(h)).toBe(false);
});

test('a gesture with many updates is one undo step', () => {
    let h = beginGesture(createHistory(base));
    for (const t of ['x', 'xy', 'xyz']) h = updateGesture(h, setTitle(h.present, t));
    h = endGesture(h);
    expect(h.past).toHaveLength(1);
    expect(undo(h).present).toBe(base);
});

test('a cancelled gesture leaves no trace', () => {
    let h = beginGesture(createHistory(base));
    h = updateGesture(h, setTitle(base, 'moved'));
    h = cancelGesture(h);
    expect(h.present).toBe(base);
    expect(canUndo(h)).toBe(false);
});

test('a gesture that changed nothing records nothing', () => {
    const h = endGesture(beginGesture(createHistory(base)));
    expect(canUndo(h)).toBe(false);
});

test('undo during a gesture ends it first', () => {
    let h = commit(createHistory(base), setTitle(base, 'b'));
    h = beginGesture(h);
    h = updateGesture(h, setTitle(h.present, 'c'));
    h = undo(h);
    expect(h.present.title).toBe('b');
    expect(h.gestureBase).toBeNull();
});

test('amend replaces the present without an undo step', () => {
    const h = amend(createHistory(base), setTitle(base, 'derived'));
    expect(h.present.title).toBe('derived');
    expect(canUndo(h)).toBe(false);
});

test('history is capped', () => {
    let h = createHistory(base);
    for (let i = 0; i < HISTORY_LIMIT + 50; i++) h = commit(h, setTitle(h.present, String(i)));
    expect(h.past).toHaveLength(HISTORY_LIMIT);
});
