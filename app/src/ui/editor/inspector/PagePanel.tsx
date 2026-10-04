import { useId } from 'react';
import { setSetup } from '../../../model/commands';
import { PAGE_SIZES } from '../../../model/pageSizes';
import type { PageSetup, PageSize } from '../../../model/types';
import type { Actions } from '../../actions';
import { Button } from '../../components/Button';
import { NumberField } from '../../components/NumberField';
import { Segmented } from '../../components/Segmented';
import { Toggle } from '../../components/Toggle';
import { useEditor, useStore } from '../../store';
import { mmToPt, ptToMm } from './edit';

export function PagePanel({ actions }: { actions: Actions }) {
    const store = useStore();
    const setup = useEditor((s) => s.history.present.setup);
    const showGuides = useEditor((s) => s.showGuides);
    const gap = useEditor((s) => s.packGap);
    const sizeId = useId();
    const set = (patch: Partial<PageSetup>) => store.apply((d) => setSetup(d, patch));
    const gridMm = Math.round(ptToMm(setup.grid));
    return (
        <>
            <section className="panel">
                <h3>Page</h3>
                <div className="field">
                    <label htmlFor={sizeId} className="field-label">Size</label>
                    <select id={sizeId} className="select" value={setup.size} onChange={(e) => set({ size: e.target.value as PageSize })}>
                        {(Object.keys(PAGE_SIZES) as PageSize[]).map((k) => (
                            <option key={k} value={k}>{PAGE_SIZES[k].label}</option>
                        ))}
                    </select>
                </div>
                <Segmented
                    label="Orientation"
                    value={setup.orientation}
                    onChange={(orientation) => set({ orientation })}
                    options={[{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]}
                />
                <div className="panel-grid">
                    <NumberField label="Margin" unit="mm" value={ptToMm(setup.margin)} min={0} max={50} onChange={(v) => set({ margin: mmToPt(v) })} />
                    <NumberField label="Columns" value={setup.columns} digits={0} min={1} max={6} onChange={(v) => set({ columns: Math.round(v) })} />
                    <NumberField label="Gutter" unit="mm" value={ptToMm(setup.gutter)} min={0} max={30} onChange={(v) => set({ gutter: mmToPt(v) })} />
                </div>
                <Segmented
                    label="Grid"
                    value={gridMm === 5 || gridMm === 10 ? gridMm : 0}
                    onChange={(mm) => set({ grid: mm ? mmToPt(mm) : 0 })}
                    options={[{ value: 0, label: 'Off' }, { value: 5, label: '5 mm' }, { value: 10, label: '10 mm' }]}
                />
                <Toggle label="Show margins and columns" checked={showGuides} onChange={(v) => store.patch({ showGuides: v })} />
            </section>
            <section className="panel">
                <h3>Auto-pack</h3>
                <p className="panel-hint">Rearranges this page so nothing overlaps. Fill the page also scales everything up or down to use the space.</p>
                <NumberField label="Gap" unit="pt" value={gap} min={0} max={36} onChange={(v) => store.patch({ packGap: v })} />
                <div className="panel-row">
                    <Button size="sm" icon="fit" onClick={() => actions.pack('fit')}>Fill the page</Button>
                    <Button size="sm" icon="pack" onClick={() => actions.pack('arrange')}>Keep sizes</Button>
                </div>
            </section>
            <section className="panel">
                <h3>Before printing</h3>
                <Button size="sm" icon="warning" onClick={() => store.openDialog('print-check')}>Print check</Button>
            </section>
        </>
    );
}
