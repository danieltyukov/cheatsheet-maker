// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { Inspector } from './Inspector';
import { EditorStore, StoreContext } from '../../store';
import { EditorAssets } from '../../editorAssets';
import { Actions } from '../../actions';
import { MemoryLibrary } from '../../../storage/library';
import { webPlatform } from '../../../platform/web';
import { addItems } from '../../../model/commands';
import { createDocument, createImageItem, createTextItem } from '../../../model/factory';

function mount(selectKind: 'image' | 'text' | 'none') {
    const img = createImageItem({ id: 'a', mime: 'image/png', width: 100, height: 100 }, { x: 100, y: 100 }, 1e6, 1e6);
    const txt = createTextItem({ x: 0, y: 0 }, { font: 'sans', fontSize: 9, color: '#000', background: null, align: 'left' }, 100, 'hi');
    const store = new EditorStore(addItems(createDocument('t', 0), 0, [img, txt]));
    if (selectKind !== 'none') store.select([selectKind === 'image' ? img.id : txt.id]);
    const actions = new Actions(store, new EditorAssets(async () => null, () => {}), new MemoryLibrary(), webPlatform);
    render(<StoreContext.Provider value={store}><Inspector actions={actions} /></StoreContext.Provider>);
    return { store, img, txt };
}

test('image filters are undoable item changes', async () => {
    const { store, img } = mount('image');
    await userEvent.click(screen.getByRole('switch', { name: /Invert/ }));
    const out = store.doc.pages[0].items.find((i) => i.id === img.id)!;
    expect(out.kind === 'image' && out.filters.invert).toBe(true);
    store.undo();
    const back = store.doc.pages[0].items.find((i) => i.id === img.id)!;
    expect(back.kind === 'image' && back.filters.invert).toBe(false);
});

test('text font can be switched', async () => {
    const { store, txt } = mount('text');
    await userEvent.click(screen.getByRole('radio', { name: 'Narrow' }));
    expect(store.doc.pages[0].items.find((i) => i.id === txt.id)).toMatchObject({ font: 'narrow' });
});

test('with nothing selected the page setup shows', async () => {
    const { store } = mount('none');
    await userEvent.click(screen.getByRole('radio', { name: 'Landscape' }));
    expect(store.doc.setup.orientation).toBe('landscape');
});
