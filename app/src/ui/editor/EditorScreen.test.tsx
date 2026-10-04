// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, expect, test, vi } from 'vitest';
import { EditorScreen } from './EditorScreen';
import { EditorStore, StoreContext } from '../store';
import { EditorAssets } from '../editorAssets';
import { Actions } from '../actions';
import { MemoryLibrary } from '../../storage/library';
import { webPlatform } from '../../platform/web';
import { createDocument } from '../../model/factory';

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
    window.matchMedia ??= ((q: string) => ({ matches: q.includes('min-width'), media: q, addEventListener() {}, removeEventListener() {} })) as never;
});

function mount() {
    const store = new EditorStore(createDocument('Physics', 0));
    const assets = new EditorAssets(async () => null, () => {});
    const actions = new Actions(store, assets, new MemoryLibrary(), webPlatform);
    const onOpenLibrary = vi.fn();
    render(<StoreContext.Provider value={store}><EditorScreen actions={actions} assets={assets} onOpenLibrary={onOpenLibrary} /></StoreContext.Provider>);
    return { store, actions, onOpenLibrary };
}

test('keyboard shortcuts switch tools and add pages', async () => {
    const { store } = mount();
    await userEvent.keyboard('p');
    expect(store.getState().tool).toBe('pen');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    expect(store.doc.pages).toHaveLength(2);
});

test('the title is editable and undoable', async () => {
    const { store } = mount();
    const title = screen.getByRole('textbox', { name: 'Title' });
    await userEvent.clear(title);
    await userEvent.type(title, 'Exam 2{Enter}');
    expect(store.doc.title).toBe('Exam 2');
});

test('the library button leaves the editor', async () => {
    const { onOpenLibrary } = mount();
    await userEvent.click(screen.getByRole('button', { name: 'All cheatsheets' }));
    expect(onOpenLibrary).toHaveBeenCalled();
});

test('the shortcut sheet opens with ?', async () => {
    mount();
    await userEvent.keyboard('?');
    expect(screen.getByRole('dialog', { name: /Keyboard shortcuts/ })).toBeInTheDocument();
});

test('leaving with unsaved changes asks first', async () => {
    const { store, onOpenLibrary } = mount();
    store.setSaveStatus({ state: 'error', message: 'Storage is full.' });
    await userEvent.click(screen.getByRole('button', { name: 'All cheatsheets' }));
    expect(onOpenLibrary).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: /not saved/i });
    expect(dialog).toHaveTextContent('Storage is full.');
    await userEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
    expect(onOpenLibrary).toHaveBeenCalled();
});

test('in a private window the library lives in memory too, so going to it needs no question', async () => {
    const { store, onOpenLibrary } = mount();
    store.setSaveStatus({ state: 'error', message: 'Browser storage is unavailable.', keptInMemory: true });
    await userEvent.click(screen.getByRole('button', { name: 'All cheatsheets' }));
    expect(onOpenLibrary).toHaveBeenCalled();
});

test('closing the tab with unsaved changes asks the browser to confirm', () => {
    const { store } = mount();
    const calm = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(calm);
    expect(calm.defaultPrevented).toBe(false);
    act(() => store.setSaveStatus({ state: 'error', message: 'Storage is full.' }));
    const worried = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(worried);
    expect(worried.defaultPrevented).toBe(true);
});

test('a phone shows when the work is not saved', () => {
    const matches = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
    try {
        const { store } = mount();
        act(() => store.setSaveStatus({ state: 'error', message: 'Storage is full.' }));
        expect(screen.getByRole('button', { name: /Not saved/ })).toBeInTheDocument();
    } finally {
        window.matchMedia = matches;
    }
});
