import type { Item } from '../../../model/types';
import type { Actions } from '../../actions';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';

export function MultiPanel({ items, actions }: { items: Item[]; actions: Actions }) {
    return (
        <section className="panel">
            <h3>{items.length} items</h3>
            <div className="panel-label">Align</div>
            <div className="panel-row">
                <IconButton label="Align left" icon="alignLeft" onClick={() => actions.align('left')} />
                <IconButton label="Align centres" icon="alignHCenter" onClick={() => actions.align('hcenter')} />
                <IconButton label="Align right" icon="alignRight" onClick={() => actions.align('right')} />
                <IconButton label="Align top" icon="alignTop" onClick={() => actions.align('top')} />
                <IconButton label="Align middles" icon="alignVCenter" onClick={() => actions.align('vcenter')} />
                <IconButton label="Align bottom" icon="alignBottom" onClick={() => actions.align('bottom')} />
            </div>
            <div className="panel-label">Distribute</div>
            <div className="panel-row">
                <IconButton label="Distribute horizontally" icon="distributeH" disabled={items.length < 3} onClick={() => actions.distribute('h')} />
                <IconButton label="Distribute vertically" icon="distributeV" disabled={items.length < 3} onClick={() => actions.distribute('v')} />
            </div>
            <div className="panel-label">Auto-pack these</div>
            <div className="panel-row">
                <Button size="sm" icon="fit" onClick={() => actions.pack('fit')}>Fill the page</Button>
                <Button size="sm" icon="pack" onClick={() => actions.pack('arrange')}>Keep sizes</Button>
            </div>
        </section>
    );
}
