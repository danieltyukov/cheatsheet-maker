import type { ImageFilters, ImageItem } from '../../../model/types';
import { effectiveDpi, MIN_DPI } from '../../../model/printCheck';
import type { Actions } from '../../actions';
import { Button } from '../../components/Button';
import { Slider } from '../../components/Slider';
import { Toggle } from '../../components/Toggle';
import { useEditor, useStore } from '../../store';
import { itemEditor } from './edit';

export function ImagePanel({ item, actions }: { item: ImageItem; actions: Actions }) {
    const store = useStore();
    const cropId = useEditor((s) => s.cropId);
    const e = itemEditor(store, item.id);
    const f = item.filters;
    const setFilter = (patch: Partial<ImageFilters>) => e.set({ filters: { ...f, ...patch } });
    const dpi = Math.round(effectiveDpi(item));
    return (
        <section className="panel">
            <h3>Image</h3>
            <div className="panel-row">
                <Button size="sm" icon="crop" onClick={() => store.setCrop(cropId === item.id ? null : item.id)} disabled={item.locked}>
                    {cropId === item.id ? 'Done cropping' : 'Crop'}
                </Button>
                <Button size="sm" icon="trim" onClick={() => actions.trimSelected()} disabled={item.locked}>Auto-trim</Button>
            </div>
            <Slider
                label="Remove white"
                min={0}
                max={0.6}
                step={0.02}
                value={f.whiteToAlpha}
                format={(v) => (v === 0 ? 'Off' : `${Math.round(v * 100)}%`)}
                onChange={(v) => setFilter({ whiteToAlpha: v })}
                onStart={e.start}
                onEnd={e.end}
            />
            <Toggle label="Invert (dark slides)" checked={f.invert} onChange={(v) => setFilter({ invert: v })} />
            <Toggle label="Grayscale" checked={f.grayscale} onChange={(v) => setFilter({ grayscale: v })} />
            <Slider
                label="Contrast"
                min={0.5}
                max={2}
                step={0.05}
                value={f.contrast}
                format={(v) => `${v.toFixed(2)}x`}
                onChange={(v) => setFilter({ contrast: v })}
                onStart={e.start}
                onEnd={e.end}
            />
            <div className="panel-row panel-row-between">
                <span className={`dpi ${dpi < MIN_DPI ? 'dpi-low' : ''}`} title="Source pixels per inch on paper">
                    Prints at {dpi} DPI{dpi < MIN_DPI ? ', may look blurry' : ''}
                </span>
                <Button size="sm" variant="quiet" onClick={() => actions.resetFilters()}>Reset</Button>
            </div>
        </section>
    );
}
