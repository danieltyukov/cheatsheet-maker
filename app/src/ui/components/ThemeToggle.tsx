import { useState } from 'react';
import { applyTheme, readThemePref, type ThemePref } from '../theme';
import { IconButton } from './IconButton';

const NEXT: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<ThemePref, string> = { system: 'Theme: follows the system', light: 'Theme: light', dark: 'Theme: dark' };

export function ThemeToggle() {
    const [pref, setPref] = useState<ThemePref>(readThemePref);
    return (
        <IconButton
            label={LABEL[pref]}
            icon={pref === 'dark' ? 'moon' : pref === 'light' ? 'sun' : 'system'}
            onClick={() => {
                const next = NEXT[pref];
                applyTheme(next);
                setPref(next);
            }}
        />
    );
}
