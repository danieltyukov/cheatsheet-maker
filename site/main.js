import '@fontsource-variable/atkinson-hyperlegible-next';
import '@fontsource-variable/bricolage-grotesque';
import './style.css';

// Theme: shares the app's "cm-theme" key, so the site and the web app agree.
const root = document.documentElement;
const toggle = document.querySelector('[data-theme-toggle]');
const isDark = () =>
    root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
function reflect() {
    if (!toggle) return;
    toggle.setAttribute('aria-pressed', String(isDark()));
    toggle.setAttribute('aria-label', isDark() ? 'Switch to the light theme' : 'Switch to the dark theme');
}
toggle?.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
        localStorage.setItem('cm-theme', next);
    } catch {
        // Storage can be blocked; the choice then lasts for this visit.
    }
    reflect();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', reflect);
reflect();

// The download button names the visitor's platform.
const RELEASES = 'https://github.com/danieltyukov/cheatsheet-maker/releases/latest/download/';
const PLATFORMS = {
    windows: { label: 'Download for Windows', file: 'CheatsheetMaker_x64-setup.exe' },
    mac: { label: 'Download for macOS', file: 'CheatsheetMaker_universal.dmg' },
    linux: { label: 'Download for Linux', file: 'cheatsheet-maker_x86_64.AppImage' },
    android: { label: 'Download for Android', file: 'cheatsheet-maker.apk' },
    ios: { label: 'Install on iPhone or iPad', href: '#install-ios' },
};
function detect() {
    const ua = navigator.userAgent;
    const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua) || (/mac/i.test(platform) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/win/i.test(platform)) return 'windows';
    if (/mac/i.test(platform)) return 'mac';
    if (/linux|x11/i.test(platform)) return 'linux';
    return null;
}
const os = detect();
const download = document.querySelector('[data-download]');
if (download && os) {
    const p = PLATFORMS[os];
    download.textContent = p.label;
    download.setAttribute('href', p.href ?? RELEASES + p.file);
}
