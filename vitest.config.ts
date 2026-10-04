import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    resolve: {
        alias: { 'virtual:pwa-register': fileURLToPath(new URL('./app/src/test/pwaRegisterStub.ts', import.meta.url)) },
    },
    test: {
        include: ['app/src/**/*.test.{ts,tsx}'],
        environment: 'node',
        setupFiles: ['app/src/test/setup.ts'],
    },
});
