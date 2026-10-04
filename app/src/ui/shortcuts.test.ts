import { expect, test } from 'vitest';
import { matchShortcut } from './shortcuts';

const key = (key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) =>
    ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods });

test('tools are single letters', () => {
    expect(matchShortcut(key('p'), false)).toEqual({ kind: 'tool', tool: 'pen' });
    expect(matchShortcut(key('d'), false)).toEqual({ kind: 'tool', tool: 'pen' });
    expect(matchShortcut(key('M'), false)).toEqual({ kind: 'tool', tool: 'highlighter' });
    expect(matchShortcut(key('v'), false)).toEqual({ kind: 'tool', tool: 'select' });
});

test('Ctrl on Linux and Windows, Cmd on macOS', () => {
    expect(matchShortcut(key('z', { ctrlKey: true }), false)).toEqual({ kind: 'action', name: 'undo' });
    expect(matchShortcut(key('z', { metaKey: true }), true)).toEqual({ kind: 'action', name: 'undo' });
    expect(matchShortcut(key('z', { ctrlKey: true }), true)).toBeNull();
    expect(matchShortcut(key('Z', { ctrlKey: true, shiftKey: true }), false)).toEqual({ kind: 'action', name: 'redo' });
    expect(matchShortcut(key('y', { ctrlKey: true }), false)).toEqual({ kind: 'action', name: 'redo' });
    expect(matchShortcut(key('E', { ctrlKey: true, shiftKey: true }), false)).toEqual({ kind: 'action', name: 'exportPng' });
    expect(matchShortcut(key(']', { ctrlKey: true, shiftKey: true }), false)).toEqual({ kind: 'action', name: 'toFront' });
});

test('arrows nudge 1 pt, 10 pt with Shift', () => {
    expect(matchShortcut(key('ArrowLeft'), false)).toEqual({ kind: 'nudge', dx: -1, dy: 0 });
    expect(matchShortcut(key('ArrowDown', { shiftKey: true }), false)).toEqual({ kind: 'nudge', dx: 0, dy: 10 });
});

test('clipboard keys are left to the browser', () => {
    expect(matchShortcut(key('c', { ctrlKey: true }), false)).toBeNull();
    expect(matchShortcut(key('v', { ctrlKey: true }), false)).toBeNull();
});
