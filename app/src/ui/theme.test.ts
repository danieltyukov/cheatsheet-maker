// @vitest-environment jsdom
import { beforeEach, expect, test } from 'vitest';
import { applyTheme, readThemePref } from './theme';

beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
});

test('explicit themes set the attribute and persist', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(readThemePref()).toBe('dark');
});

test('system removes the attribute', () => {
    applyTheme('light');
    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(readThemePref()).toBe('system');
});
