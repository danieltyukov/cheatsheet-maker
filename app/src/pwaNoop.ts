// Stands in for vite-plugin-pwa's virtual module where there is no service worker (Tauri, tests).
export function registerSW(): (reload?: boolean) => Promise<void> {
    return async () => undefined;
}
