import type { ItemPatch } from '../../../model/commands';
import type { FontKey, TextItem } from '../../../model/types';
import { FONT_LABELS } from '../../../render/fonts';
import type { Actions } from '../../actions';
import { ColorSwatches } from '../../components/ColorSwatches';
import { NumberField } from '../../components/NumberField';
import { Segmented } from '../../components/Segmented';
import { FILL_COLORS, HIGHLIGHTER_COLORS, INK_COLORS } from '../../palette';
import { useStore } from '../../store';
import { itemEditor } from './edit';

export const FONT_OPTIONS = (Object.keys(FONT_LABELS) as FontKey[]).map((k) => ({ value: k, label: FONT_LABELS[k] }));
export const TEXT_BACKGROUNDS = [HIGHLIGHTER_COLORS[0], ...FILL_COLORS];

export function TextPanel({ item, actions }: { item: TextItem; actions: Actions }) {
    const store = useStore();
    const e = itemEditor(store, item.id);
    // Anything that changes the layout also updates the stored height.
    const relayout = (patch: ItemPatch) => e.set({ ...patch, h: actions.assets.textHeight({ ...item, ...patch } as TextItem) });
    return (
        <section className="panel">
            <h3>Text</h3>
            <Segmented label="Font" value={item.font} options={FONT_OPTIONS} onChange={(font) => relayout({ font })} />
            <div className="panel-grid">
                <NumberField label="Size" unit="pt" value={item.fontSize} min={3} max={96} step={0.5} onChange={(fontSize) => relayout({ fontSize })} />
                <NumberField label="Padding" unit="pt" value={item.padding} min={0} max={36} step={1} onChange={(padding) => relayout({ padding })} />
            </div>
            <Segmented
                label="Alignment"
                value={item.align}
                onChange={(align) => e.set({ align })}
                options={[
                    { value: 'left', label: 'Left', icon: 'alignLeft' },
                    { value: 'center', label: 'Centre', icon: 'alignHCenter' },
                    { value: 'right', label: 'Right', icon: 'alignRight' },
                ]}
            />
            <ColorSwatches label="Colour" colors={INK_COLORS} value={item.color} onChange={(c) => c && e.set({ color: c })} />
            <ColorSwatches label="Background" colors={TEXT_BACKGROUNDS} value={item.background} onChange={(background) => e.set({ background })} allowNone />
            <p className="panel-hint">Double-click the box to edit. Write **bold**, *italic*, `code`, - lists, $x^2$ inline and $$...$$ for a centred formula.</p>
        </section>
    );
}
