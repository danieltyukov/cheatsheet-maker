import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { findItem } from '../../model/commands';
import type { Actions } from '../actions';
import { CanvasView } from '../canvas/CanvasView';
import { pageAt, toPagePoint, toWorld } from '../canvas/viewport';
import { Dialog } from '../components/Dialog';
import { IconButton } from '../components/IconButton';
import { MenuButton } from '../components/Menu';
import { Toasts } from '../components/Toasts';
import type { EditorAssets } from '../editorAssets';
import { isEditableTarget, matchShortcut } from '../shortcuts';
import { useEditor, useStore } from '../store';
import { useMediaQuery } from '../useMediaQuery';
import { Inspector } from './inspector/Inspector';
import { PagesPanel } from './PagesPanel';
import { PdfImportDialog } from './PdfImportDialog';
import { PrintCheckDialog } from './PrintCheck';
import { ShortcutsDialog } from './ShortcutsDialog';
import { TextEditor } from './TextEditor';
import { TOOLS } from './ToolRail';
import { ToolRail } from './ToolRail';
import { TopBar } from './TopBar';
import './editor.css';

const CLIPBOARD_MARKER = 'cheatsheet-maker:items';

interface Props {
    actions: Actions;
    assets: EditorAssets;
    onOpenLibrary: () => void;
}

function PhoneBar({ actions, onSheet }: { actions: Actions; onSheet: (s: 'pages' | 'inspect') => void }) {
    const store = useStore();
    const tool = useEditor((s) => s.tool);
    const selection = useEditor((s) => s.selection);
    const doc = useEditor((s) => s.history.present);
    const cropId = useEditor((s) => s.cropId);
    const one = selection.length === 1 ? findItem(doc, selection[0])?.item : null;
    const shapeTools = TOOLS.filter((t) => ['rect', 'ellipse', 'line', 'arrow'].includes(t.tool));
    const shapeActive = shapeTools.some((t) => t.tool === tool);
    return (
        <nav className="phone-bar" aria-label="Tools">
            {TOOLS.filter((t) => ['select', 'pen', 'highlighter', 'eraser', 'text'].includes(t.tool)).map((t) => (
                <IconButton key={t.tool} label={t.label} icon={t.icon} pressed={tool === t.tool} onClick={() => store.setTool(t.tool)} />
            ))}
            <MenuButton
                label="Shapes"
                icon="shapes"
                iconOnly
                className={shapeActive ? 'is-on-menu' : ''}
                items={shapeTools.map((t) => ({ label: t.label, icon: t.icon, checked: tool === t.tool, onSelect: () => store.setTool(t.tool) }))}
            />
            {one?.kind === 'image' && !one.locked && (
                <IconButton label="Crop" icon="crop" pressed={cropId === one.id} onClick={() => actions.run({ kind: 'action', name: 'crop' })} />
            )}
            <span className="phone-spacer" />
            <IconButton label="Pages" icon="pages" onClick={() => onSheet('pages')} />
            <IconButton label="Inspect" icon="sliders" onClick={() => onSheet('inspect')} />
        </nav>
    );
}

export function EditorScreen({ actions, assets, onOpenLibrary }: Props) {
    const store = useStore();
    const desktop = useMediaQuery('(min-width: 720px)');
    const wide = useMediaQuery('(min-width: 1100px)');
    const coarse = useMediaQuery('(pointer: coarse)');
    const toasts = useEditor((s) => s.toasts);
    const [sheet, setSheet] = useState<'pages' | 'inspect' | null>(null);
    const [pagesOpen, setPagesOpen] = useState(false);
    const [dropping, setDropping] = useState(false);
    const isMac = useMemo(() => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.defaultPrevented || isEditableTarget(e.target)) return;
            const cmd = matchShortcut(e, isMac);
            if (!cmd) return;
            const st = store.getState();
            const escape = cmd.kind === 'action' && cmd.name === 'escape';
            if ((st.dialog || st.editingTextId) && !escape) return;
            e.preventDefault();
            actions.run(cmd);
        };
        const busy = (e: Event) => isEditableTarget(e.target) || store.getState().dialog !== null || store.getState().editingTextId !== null;
        const onCopy = (e: ClipboardEvent) => {
            if (busy(e) || store.getState().selection.length === 0) return;
            if (e.type === 'cut') actions.cut();
            else actions.copy();
            e.clipboardData?.setData('text/plain', CLIPBOARD_MARKER);
            e.preventDefault();
        };
        const onPaste = (e: ClipboardEvent) => {
            if (busy(e)) return;
            const dt = e.clipboardData;
            if (!dt) return;
            const files = [...dt.files];
            if (files.length) {
                e.preventDefault();
                void actions.importFiles(files);
                return;
            }
            const text = dt.getData('text/plain');
            if (text === CLIPBOARD_MARKER) {
                e.preventDefault();
                actions.paste();
            } else if (text.trim()) {
                e.preventDefault();
                actions.pasteText(text);
            }
        };
        window.addEventListener('keydown', onKey);
        document.addEventListener('copy', onCopy);
        document.addEventListener('cut', onCopy);
        document.addEventListener('paste', onPaste);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.removeEventListener('copy', onCopy);
            document.removeEventListener('cut', onCopy);
            document.removeEventListener('paste', onPaste);
        };
    }, [actions, store, isMac]);

    const onResize = useCallback((w: number, h: number) => {
        actions.viewport = { w, h };
    }, [actions]);

    const hasFiles = (e: DragEvent) => [...e.dataTransfer.types].includes('Files');
    const onDrop = (e: DragEvent<HTMLElement>) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDropping(false);
        const files = [...e.dataTransfer.files];
        const canvas = e.currentTarget.querySelector('canvas');
        const st = store.getState();
        const doc = st.history.present;
        let at;
        if (canvas) {
            const r = canvas.getBoundingClientRect();
            const world = toWorld(st.view, { x: e.clientX - r.left, y: e.clientY - r.top });
            const { index } = pageAt(doc.setup, doc.pages.length, world);
            at = { page: index, point: toPagePoint(doc.setup, index, world) };
        }
        void actions.importFiles(files, at);
    };

    const showPages = desktop && (wide || pagesOpen);
    return (
        <div className={`editor ${desktop ? 'is-desktop' : 'is-phone'} ${showPages ? 'with-pages' : ''}`}>
            <TopBar
                actions={actions}
                onOpenLibrary={onOpenLibrary}
                phone={!desktop}
                coarse={coarse}
                isMac={isMac}
                onTogglePages={desktop && !wide ? () => setPagesOpen((o) => !o) : undefined}
                pagesOpen={pagesOpen}
            />
            {desktop && <ToolRail />}
            {showPages && (
                <aside className="pages-col" aria-label="Pages">
                    <PagesPanel actions={actions} assets={assets} />
                </aside>
            )}
            <main
                className={`canvas-col ${dropping ? 'is-dropping' : ''}`}
                onDragOver={(e) => {
                    if (!hasFiles(e)) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    setDropping(true);
                }}
                onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false);
                }}
                onDrop={onDrop}
            >
                <CanvasView assets={assets} onResize={onResize}>
                    <TextEditor assets={assets} />
                </CanvasView>
                {dropping && <div className="drop-hint">Drop to add to the page</div>}
            </main>
            {desktop && (
                <aside className="inspector-col" aria-label="Inspector">
                    <Inspector actions={actions} />
                </aside>
            )}
            {!desktop && (
                <>
                    <PhoneBar actions={actions} onSheet={setSheet} />
                    <Dialog open={sheet === 'pages'} title="Pages" className="sheet" onClose={() => setSheet(null)}>
                        <PagesPanel actions={actions} assets={assets} />
                    </Dialog>
                    <Dialog open={sheet === 'inspect'} title="Inspect" className="sheet" onClose={() => setSheet(null)}>
                        <Inspector actions={actions} />
                    </Dialog>
                </>
            )}
            <Toasts toasts={toasts} onDismiss={(id) => store.dismissToast(id)} />
            <PdfImportDialog actions={actions} />
            <PrintCheckDialog actions={actions} />
            <ShortcutsDialog isMac={isMac} />
        </div>
    );
}
