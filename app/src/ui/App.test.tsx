// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, expect, test } from 'vitest';
import { App, resetStartupForTests } from './App';

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
    window.matchMedia ??= ((q: string) => ({ matches: q.includes('min-width'), media: q, addEventListener() {}, removeEventListener() {} })) as never;
});

test('a first visit lands in a new cheatsheet and the library lists it', async () => {
    render(<App />);
    const title = await screen.findByRole('textbox', { name: 'Title' });
    expect(title).toHaveValue('Untitled cheatsheet');
    await userEvent.click(screen.getByRole('button', { name: 'All cheatsheets' }));
    expect(await screen.findByRole('heading', { name: 'Cheatsheet Maker' })).toBeInTheDocument();
    expect(await screen.findByText('Untitled cheatsheet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New cheatsheet' }));
    expect(await screen.findByRole('textbox', { name: 'Title' })).toHaveValue('Untitled cheatsheet');
});

test('starting twice (React StrictMode) still creates only one first cheatsheet', async () => {
    // A fresh, empty IndexedDB (deleting would wait on the first test's open connection).
    const { IDBFactory } = await import('fake-indexeddb');
    globalThis.indexedDB = new IDBFactory();
    resetStartupForTests();
    const { StrictMode } = await import('react');
    render(<StrictMode><App /></StrictMode>);
    await screen.findByRole('textbox', { name: 'Title' });
    const { openIdbLibrary } = await import('../storage/library');
    const lib = await openIdbLibrary();
    expect(await lib.list()).toHaveLength(1);
});
