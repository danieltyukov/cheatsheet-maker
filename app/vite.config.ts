import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig(({ mode }) => ({
    base: './',
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    server: { port: 5173, strictPort: true, fs: { allow: ['..'] } },
    build: {
        target: 'es2022',
        sourcemap: true,
        chunkSizeWarningLimit: 2500,
        rollupOptions: {
            output: {
                // MathJax's extra alphabets (Greek, Cyrillic, Braille...) get their own folder so the
                // service worker can cache them on first use instead of on install.
                chunkFileNames: (chunk) =>
                    chunk.facadeModuleId?.includes('mathjax-newcm-font/mjs/svg/dynamic/')
                        ? 'assets/mathfont/[name]-[hash].js'
                        : 'assets/[name]-[hash].js',
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
