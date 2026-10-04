import { useMemo } from 'react';
import { findItem } from '../../../model/commands';
import type { Item } from '../../../model/types';
import type { Actions } from '../../actions';
import { useEditor } from '../../store';
import { ArrangePanel } from './ArrangePanel';
import { ImagePanel } from './ImagePanel';
import { MultiPanel } from './MultiPanel';
import { PagePanel } from './PagePanel';
import { ShapePanel } from './ShapePanel';
import { StrokePanel } from './StrokePanel';
import { TextPanel } from './TextPanel';
import { ToolPanel } from './ToolPanel';
import './inspector.css';

export function Inspector({ actions }: { actions: Actions }) {
    const selection = useEditor((s) => s.selection);
    const doc = useEditor((s) => s.history.present);
    const tool = useEditor((s) => s.tool);
    const items = useMemo(
        () => selection.map((id) => findItem(doc, id)?.item).filter((i): i is Item => !!i),
        [selection, doc],
    );
    const one = items.length === 1 ? items[0] : null;
    return (
        <div className="inspector">
            {items.length === 0 && (tool === 'select' || tool === 'hand' ? <PagePanel actions={actions} /> : <ToolPanel tool={tool} />)}
            {one?.kind === 'image' && <ImagePanel item={one} actions={actions} />}
            {one?.kind === 'text' && <TextPanel item={one} actions={actions} />}
            {one?.kind === 'shape' && <ShapePanel item={one} />}
            {one?.kind === 'stroke' && <StrokePanel item={one} />}
            {items.length > 1 && <MultiPanel items={items} actions={actions} />}
            {items.length > 0 && <ArrangePanel items={items} actions={actions} />}
        </div>
    );
}
