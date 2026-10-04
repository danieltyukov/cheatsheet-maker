// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeAll, expect, test, vi } from 'vitest';

// Storage opens, then fails on the first read (a corrupted or locked database does this).
vi.mock('../storage/library', async (importOriginal) => {
    const real = await importOriginal<typeof import('../storage/library')>();
    class Broken extends real.MemoryLibrary {
        override async getMeta<T>(): Promise<T | undefined> {
            throw Object.assign(new Error('The database connection is closing.'), { name: 'InvalidStateError' });
        }
    }
    return { ...real, openLibrary: async () => ({ library: new Broken(), persistent: true }) };
});

const { App } = await import('./App');

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
    window.matchMedia ??= ((q: string) => ({ matches: q.includes('min-width'), media: q, addEventListener() {}, removeEventListener() {} })) as never;
});

test('storage that fails after opening still lands in a working editor that says it is not saving', async () => {
    render(<App />);
    expect(await screen.findByRole('textbox', { name: 'Title' })).toHaveValue('Untitled cheatsheet');
    expect(screen.getByRole('button', { name: /Not saved/ })).toHaveAttribute('title', expect.stringContaining('not letting the app store anything'));
});
