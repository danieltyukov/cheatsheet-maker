// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { TextEditor } from './TextEditor';
import { EditorStore, StoreContext } from '../store';
import { EditorAssets } from '../editorAssets';
import { addItems } from '../../model/commands';
import { createDocument, createTextItem } from '../../model/factory';

function setup(text: string) {
    const t = createTextItem({ x: 10, y: 10 }, { font: 'sans', fontSize: 10, color: '#000', background: null, align: 'left' }, 100, text);
    const store = new EditorStore(createDocument('t', 0));
    store.beginGesture();
    store.apply((d) => addItems(d, 0, [t]));
    store.setEditingText(t.id);
    const assets = new EditorAssets(async () => null, () => {});
    render(<StoreContext.Provider value={store}><TextEditor assets={assets} /></StoreContext.Provider>);
    return { store, t };
}

test('typing updates the item and blur commits one undo step', () => {
    const { store } = setup('');
    const box = screen.getByRole('textbox', { name: 'Text box' });
    fireEvent.change(box, { target: { value: '**Bold** idea' } });
    expect(store.doc.pages[0].items[0]).toMatchObject({ text: '**Bold** idea' });
    act(() => box.blur());
    expect(store.getState().editingTextId).toBeNull();
    store.undo();
    expect(store.doc.pages[0].items).toHaveLength(0);
});

test('a new box left empty disappears without a trace', () => {
    const { store } = setup('');
    act(() => screen.getByRole('textbox', { name: 'Text box' }).blur());
    expect(store.doc.pages[0].items).toHaveLength(0);
    expect(store.getState().history.past).toHaveLength(0);
});
