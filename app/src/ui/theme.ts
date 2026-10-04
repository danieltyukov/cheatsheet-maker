export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'cm-theme';

export function readThemePref(): ThemePref {
    try {
        const v = localStorage.getItem(KEY);
        return v === 'light' || v === 'dark' ? v : 'system';
    } catch {
        return 'system';
    }
}

export function applyTheme(pref: ThemePref): void {
    const root = document.documentElement;
    if (pref === 'system') delete root.dataset.theme;
    else root.dataset.theme = pref;
    try {
        if (pref === 'system') localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, pref);
    } catch {
        // Storage can be blocked; the choice then lasts for this visit only.
    }
}

export function resolvedTheme(): 'light' | 'dark' {
    const t = document.documentElement.dataset.theme;
    if (t === 'light' || t === 'dark') return t;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
