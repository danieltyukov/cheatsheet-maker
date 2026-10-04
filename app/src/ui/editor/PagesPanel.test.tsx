// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { PagesPanel } from './PagesPanel';
import { EditorStore, StoreContext } from '../store';
import { EditorAssets } from '../editorAssets';
import { Actions } from '../actions';
import { MemoryLibrary } from '../../storage/library';
import { webPlatform } from '../../platform/web';
import { addPage } from '../../model/commands';
import { createDocument } from '../../model/factory';

test('lists pages, adds one and moves one', async () => {
    const store = new EditorStore(addPage(createDocument('t', 0)));
    const assets = new EditorAssets(async () => null, () => {});
    const actions = new Actions(store, assets, new MemoryLibrary(), webPlatform);
    render(<StoreContext.Provider value={store}><PagesPanel actions={actions} assets={assets} /></StoreContext.Provider>);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    const firstId = store.doc.pages[0].id;
    await userEvent.click(screen.getAllByRole('button', { name: /Page 1 options/ })[0]);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move down' }));
    expect(store.doc.pages[1].id).toBe(firstId);
    await userEvent.click(screen.getByRole('button', { name: 'Add page' }));
    expect(store.doc.pages).toHaveLength(3);
});
