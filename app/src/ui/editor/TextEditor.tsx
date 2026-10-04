import { useEffect, useLayoutEffect, useRef } from 'react';
import { findItem, removeItems, updateItems } from '../../model/commands';
import type { TextItem } from '../../model/types';
import { FONT_FAMILIES } from '../../render/fonts';
import { fromPagePoint, toScreen } from '../canvas/viewport';
import type { EditorAssets } from '../editorAssets';
import { useEditor, useStore } from '../store';
import './textEditor.css';

export function TextEditor({ assets }: { assets: EditorAssets }) {
    const store = useStore();
    const id = useEditor((s) => s.editingTextId);
    const view = useEditor((s) => s.view);
    const doc = useEditor((s) => s.history.present);
    const ref = useRef<HTMLTextAreaElement>(null);
    const createdEmpty = useRef(false);

    const found = id ? findItem(doc, id) : null;
    const item = found?.item.kind === 'text' ? (found.item as TextItem) : null;

    useLayoutEffect(() => {
        if (!id) return;
        const f = findItem(store.doc, id);
        createdEmpty.current = !!f && f.item.kind === 'text' && f.item.text === '' && (store.getState().history.gestureBase ? !findItem(store.getState().history.gestureBase!, id) : false);
        const el = ref.current;
        if (el) {
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
        }
    }, [id, store]);

    useEffect(() => {
        if (id && !item) store.setEditingText(null);
    }, [id, item, store]);

    if (!id || !item || !found) return null;

    const finish = () => {
        const current = findItem(store.doc, id)?.item as TextItem | undefined;
        if (!current || current.text.trim() === '') {
            if (createdEmpty.current) store.cancelGesture();
            else {
                store.apply((d) => removeItems(d, [id]));
                store.endGesture();
            }
        } else store.endGesture();
        store.setEditingText(null);
    };

    const z = view.zoom;
    const topLeft = toScreen(view, fromPagePoint(doc.setup, found.pageIndex, { x: item.x, y: item.y }));
    return (
        <textarea
            ref={ref}
            aria-label="Text box"
            className="text-editor"
            value={item.text}
            spellCheck
            style={{
                left: topLeft.x,
                top: topLeft.y,
                width: item.w * z,
                height: Math.max(item.h, assets.textHeight(item)) * z,
                transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
                font: `${item.fontSize * z}px/1.25 ${FONT_FAMILIES[item.font]}`,
                padding: item.padding * z,
                color: item.color,
                background: item.background ?? 'rgb(255 255 255 / 0.92)',
                textAlign: item.align,
            }}
            onChange={(e) => {
                const text = e.target.value;
                store.apply((d) => updateItems(d, { [id]: { text, h: assets.textHeight({ ...item, text }) } }));
            }}
            onBlur={finish}
            onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                    e.preventDefault();
                    e.currentTarget.blur();
                }
            }}
            placeholder="Type here. **bold**, *italic*, `code`, - lists, $x^2$"
        />
    );
}
