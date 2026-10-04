import { updateItems, type ItemPatch } from '../../../model/commands';
import type { Id } from '../../../model/types';
import type { EditorStore } from '../../store';

/** Item edits from the inspector: every change is undoable; sliders group a drag into one step. */
export function itemEditor(store: EditorStore, id: Id) {
    return {
        set: (patch: ItemPatch) => store.apply((d) => updateItems(d, { [id]: patch })),
        start: () => store.beginGesture(),
        end: () => store.endGesture(),
    };
}

export const ptToMm = (pt: number) => (pt * 25.4) / 72;
export const mmToPt = (mm: number) => (mm * 72) / 25.4;
