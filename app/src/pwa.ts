import { isTauri } from './platform';

/** Registers the service worker on the web; `onUpdate` gets a function that activates the new version. */
export function registerPwa(onUpdate: (reload: () => void) => void): void {
    if (isTauri() || !('serviceWorker' in navigator) || !import.meta.env.PROD) return;
    void import('virtual:pwa-register').then(({ registerSW }) => {
        const update = registerSW({
            onNeedRefresh: () => onUpdate(() => void update(true)),
        });
    });
}
