import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['app/src/**/*.test.{ts,tsx}'],
        environment: 'node',
        setupFiles: ['app/src/test/setup.ts'],
    },
});
