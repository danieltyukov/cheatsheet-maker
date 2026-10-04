import { useEffect, useRef, useState, type DragEvent } from 'react';
import { pageDimensions } from '../../model/pageSizes';
import type { Page, PageSetup } from '../../model/types';
import { drawPage } from '../../render/drawPage';
import type { Actions } from '../actions';
import { Button } from '../components/Button';
import { MenuButton } from '../components/Menu';
import type { EditorAssets } from '../editorAssets';
import { useEditor } from '../store';

const THUMB_W = 136;

function Thumb({ page, setup, assets }: { page: Page; setup: PageSetup; assets: EditorAssets }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const tick = useEditor((s) => s.renderTick);
    const { w, h } = pageDimensions(setup);
    useEffect(() => {
        const timer = setTimeout(() => {
            const c = ref.current;
            const ctx = c?.getContext('2d');
            if (!c || !ctx) return;
            const dpr = window.devicePixelRatio || 1;
            const s = (THUMB_W * dpr) / w;
            c.width = Math.round(w * s);
            c.height = Math.round(h * s);
            ctx.setTransform(s, 0, 0, s, 0, 0);
            drawPage(ctx, page, setup, assets);
        }, 150);
        return () => clearTimeout(timer);
    }, [page, setup, assets, tick, w, h]);
    return <canvas ref={ref} className="page-thumb" style={{ aspectRatio: `${w} / ${h}` }} aria-hidden="true" />;
}

export function PagesPanel({ actions, assets }: { actions: Actions; assets: EditorAssets }) {
    const doc = useEditor((s) => s.history.present);
    const current = useEditor((s) => s.currentPage);
    const [dragFrom, setDragFrom] = useState<number | null>(null);
    const [dropAt, setDropAt] = useState<number | null>(null);
    const count = doc.pages.length;

    const onDrop = (e: DragEvent, i: number) => {
        e.preventDefault();
        if (dragFrom !== null && dragFrom !== i) actions.movePage(dragFrom, i);
        setDragFrom(null);
        setDropAt(null);
    };

    return (
        <div className="pages-panel">
            <ol className="pages-list" aria-label="Pages">
                {doc.pages.map((page, i) => (
                    <li
                        key={page.id}
                        className={`page-card ${i === current ? 'is-current' : ''} ${dropAt === i ? 'is-drop' : ''}`}
                        draggable
                        onDragStart={(e) => {
                            setDragFrom(i);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/x-cheatsheet-page', String(i));
                        }}
                        onDragOver={(e) => {
                            if (dragFrom === null) return;
                            e.preventDefault();
                            setDropAt(i);
                        }}
                        onDragLeave={() => setDropAt((d) => (d === i ? null : d))}
                        onDrop={(e) => onDrop(e, i)}
                        onDragEnd={() => {
                            setDragFrom(null);
                            setDropAt(null);
                        }}
                    >
                        <button type="button" className="page-open" onClick={() => actions.goToPage(i)} aria-current={i === current ? 'page' : undefined} aria-label={`Go to page ${i + 1}`}>
                            <Thumb page={page} setup={doc.setup} assets={assets} />
                        </button>
                        <div className="page-meta">
                            <span className={i === current ? 'hl page-num' : 'page-num'}>{i + 1}</span>
                            <MenuButton
                                label={`Page ${i + 1} options`}
                                icon="more"
                                iconOnly
                                align="end"
                                items={[
                                    { label: 'Duplicate', icon: 'duplicate', onSelect: () => actions.duplicatePage(i) },
                                    { label: 'Move up', icon: 'chevronUp', disabled: i === 0, onSelect: () => actions.movePage(i, i - 1) },
                                    { label: 'Move down', icon: 'chevronDown', disabled: i === count - 1, onSelect: () => actions.movePage(i, i + 1) },
                                    'separator',
                                    { label: 'Delete', icon: 'trash', disabled: count === 1, onSelect: () => actions.removePage(i) },
                                ]}
                            />
                        </div>
                    </li>
                ))}
            </ol>
            <Button size="sm" icon="plus" className="add-page" onClick={() => actions.addPage()}>Add page</Button>
        </div>
    );
}
