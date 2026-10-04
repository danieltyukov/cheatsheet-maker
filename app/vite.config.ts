import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// \mathbb, \mathcal, \mathfrak, \mathscr, \mathtt, and symbols such as \Re, \wp, \checkmark and \triangleq.
const PRECACHED_MATH_FONTS = new Set(['double-struck', 'calligraphic', 'fraktur', 'script', 'monospace', 'math', 'shapes']);

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig(({ mode }) => ({
    base: './',
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    // Tauri builds have no service worker, so the PWA plugin's virtual module becomes a no-op.
    resolve: mode === 'tauri' ? { alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/pwaNoop.ts', import.meta.url)) } } : undefined,
    server: { port: 5173, strictPort: true, fs: { allow: ['..'] } },
    build: {
        target: 'es2022',
        sourcemap: true,
        chunkSizeWarningLimit: 2500,
        rollupOptions: {
            output: {
                // MathJax loads some symbols from extra font files. Those common in formulas stay in
                // assets/ and are precached, so they work offline from the first visit; the rest
                // (Cyrillic, Braille, accented text...) go to mathfont/ and are cached on first use.
                chunkFileNames: (chunk) => {
                    const font = /mathjax-newcm-font\/mjs\/svg\/dynamic\/([\w-]+)\.js$/.exec(chunk.facadeModuleId ?? '')?.[1];
                    return font && !PRECACHED_MATH_FONTS.has(font) ? 'assets/mathfont/[name]-[hash].js' : 'assets/[name]-[hash].js';
                },
            },
        },
    },
    plugins: [
        react(),
        mode !== 'tauri' &&
            VitePWA({
                registerType: 'prompt',
                injectRegister: null,
                includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
                manifest: {
                    id: './',
                    name: 'Cheatsheet Maker',
                    short_name: 'Cheatsheet',
                    description: 'Turn screenshots, lecture slides, notes and formulas into a dense, printable cheatsheet.',
                    start_url: './',
                    scope: './',
                    display: 'standalone',
                    background_color: '#eef0f3',
                    theme_color: '#eef0f3',
                    categories: ['education', 'productivity'],
                    icons: [
                        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                        { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                        { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
                    ],
                    file_handlers: [{ action: './', accept: { 'application/x-cheatsheet': ['.cheatsheet'] } }],
                },
                workbox: {
                    globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'],
                    globIgnores: ['assets/mathfont/**'],
                    runtimeCaching: [
                        {
                            urlPattern: ({ url }) => url.pathname.includes('/assets/mathfont/'),
                            handler: 'CacheFirst',
                            options: { cacheName: 'math-fonts', expiration: { maxEntries: 80 } },
                        },
                    ],
                    maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
                    navigateFallback: 'index.html',
                    cleanupOutdatedCaches: true,
                },
            }),
    ],
}));
