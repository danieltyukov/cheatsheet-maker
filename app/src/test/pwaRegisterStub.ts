// Vitest stand-in for vite-plugin-pwa's virtual module.
export function registerSW(): (reload?: boolean) => Promise<void> {
    return async () => undefined;
}
