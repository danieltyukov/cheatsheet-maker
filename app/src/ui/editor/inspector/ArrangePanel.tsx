import { setBoxes } from '../../../model/commands';
import type { Item, TextItem } from '../../../model/types';
import type { Actions } from '../../actions';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import { NumberField } from '../../components/NumberField';
import { Toggle } from '../../components/Toggle';
import { useStore } from '../../store';
import { mmToPt, ptToMm } from './edit';

export function ArrangePanel({ items, actions }: { items: Item[]; actions: Actions }) {
    const store = useStore();
    const one = items.length === 1 ? items[0] : null;
    const locked = items.every((i) => i.locked);
    const setBox = (patch: Partial<Pick<Item, 'x' | 'y' | 'w' | 'h' | 'rotation'>>) => {
        if (!one) return;
        const next = { ...one, ...patch };
        if (one.kind === 'text') next.h = actions.assets.textHeight(next as TextItem);
        store.apply((d) => setBoxes(d, { [one.id]: { x: next.x, y: next.y, w: next.w, h: next.h, rotation: next.rotation } }));
    };
    return (
        <section className="panel">
            <h3>Arrange</h3>
            {one && (
                <div className="panel-grid">
                    <NumberField label="X" unit="mm" value={ptToMm(one.x)} onChange={(v) => setBox({ x: mmToPt(v) })} />
                    <NumberField label="Y" unit="mm" value={ptToMm(one.y)} onChange={(v) => setBox({ y: mmToPt(v) })} />
                    <NumberField label="Width" unit="mm" value={ptToMm(one.w)} min={1} onChange={(v) => setBox({ w: mmToPt(v) })} />
                    <NumberField label="Height" unit="mm" value={ptToMm(one.h)} min={1} onChange={(v) => setBox({ h: mmToPt(v) })} />
                    <NumberField label="Rotation" unit="deg" value={one.rotation} digits={0} min={-180} max={180} onChange={(rotation) => setBox({ rotation })} />
                </div>
            )}
            <Toggle label="Lock in place" checked={locked} onChange={() => actions.toggleLock()} />
            <div className="panel-label">Order</div>
            <div className="panel-row">
                <IconButton label="Bring to front" icon="toFront" onClick={() => actions.reorder('front')} />
                <IconButton label="Bring forward" icon="forward" onClick={() => actions.reorder('forward')} />
                <IconButton label="Send backward" icon="backward" onClick={() => actions.reorder('backward')} />
                <IconButton label="Send to back" icon="toBack" onClick={() => actions.reorder('back')} />
            </div>
            <div className="panel-row">
                <Button size="sm" icon="duplicate" onClick={() => actions.duplicateSelection()} disabled={locked}>Duplicate</Button>
                <Button size="sm" icon="trash" variant="danger" onClick={() => actions.deleteSelection()} disabled={locked}>Delete</Button>
            </div>
        </section>
    );
}
