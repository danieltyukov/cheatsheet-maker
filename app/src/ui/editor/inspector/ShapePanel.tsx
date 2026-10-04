import type { ShapeItem } from '../../../model/types';
import { ColorSwatches } from '../../components/ColorSwatches';
import { Slider } from '../../components/Slider';
import { FILL_COLORS, INK_COLORS } from '../../palette';
import { useStore } from '../../store';
import { itemEditor } from './edit';

const NAMES = { rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', arrow: 'Arrow' } as const;

export function ShapePanel({ item }: { item: ShapeItem }) {
    const store = useStore();
    const e = itemEditor(store, item.id);
    return (
        <section className="panel">
            <h3>{NAMES[item.shape]}</h3>
            <ColorSwatches label="Line colour" colors={INK_COLORS} value={item.stroke} onChange={(c) => c && e.set({ stroke: c })} />
            <Slider label="Line width" min={0} max={8} step={0.25} value={item.strokeWidth} format={(v) => `${v} pt`} onChange={(strokeWidth) => e.set({ strokeWidth })} onStart={e.start} onEnd={e.end} />
            {(item.shape === 'rect' || item.shape === 'ellipse') && (
                <ColorSwatches label="Fill" colors={FILL_COLORS} value={item.fill} onChange={(fill) => e.set({ fill })} allowNone />
            )}
        </section>
    );
}
