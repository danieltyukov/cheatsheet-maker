import type { StrokeItem } from '../../../model/types';
import { ColorSwatches } from '../../components/ColorSwatches';
import { Slider } from '../../components/Slider';
import { HIGHLIGHTER_COLORS, INK_COLORS } from '../../palette';
import { useStore } from '../../store';
import { itemEditor } from './edit';

export function StrokePanel({ item }: { item: StrokeItem }) {
    const store = useStore();
    const e = itemEditor(store, item.id);
    const hl = item.tool === 'highlighter';
    return (
        <section className="panel">
            <h3>{hl ? 'Highlighter' : 'Pen stroke'}</h3>
            <ColorSwatches label="Colour" colors={hl ? HIGHLIGHTER_COLORS : INK_COLORS} value={item.color} onChange={(c) => c && e.set({ color: c })} />
            <Slider label="Size" min={hl ? 4 : 0.5} max={hl ? 32 : 12} step={0.5} value={item.size} format={(v) => `${v} pt`} onChange={(size) => e.set({ size })} onStart={e.start} onEnd={e.end} />
        </section>
    );
}
