import { useEffect, useState } from 'react';
import { setTitle } from '../../model/commands';
import { canRedo, canUndo } from '../../model/history';
import type { Actions } from '../actions';
import { IconButton } from '../components/IconButton';
import { MenuButton } from '../components/Menu';
import { ThemeToggle } from '../components/ThemeToggle';
import { useEditor, useStore } from '../store';
import { exportItems, insertItems, layoutItems, viewItems, type MenuContext } from './menus';
import { StatusIndicator } from './StatusIndicator';

interface Props {
    actions: Actions;
    onOpenLibrary: () => void;
    phone: boolean;
    coarse: boolean;
    isMac: boolean;
    onTogglePages?: () => void;
    pagesOpen?: boolean;
}

function TitleField() {
    const store = useStore();
    const title = useEditor((s) => s.history.present.title);
    const [text, setText] = useState(title);
    useEffect(() => setText(title), [title]);
    const commit = () => {
        const t = text.trim() || 'Untitled cheatsheet';
        store.apply((d) => setTitle(d, t));
        setText(t);
    };
    return (
        <input
            className="title-field"
            aria-label="Title"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    commit();
                    e.currentTarget.blur();
                }
                if (e.key === 'Escape') {
                    setText(title);
                    e.currentTarget.blur();
                }
            }}
        />
    );
}

export function TopBar({ actions, onOpenLibrary, phone, coarse, isMac, onTogglePages, pagesOpen }: Props) {
    const store = useStore();
    const history = useEditor((s) => s.history);
    const selectionCount = useEditor((s) => s.selection.length);
    const showGuides = useEditor((s) => s.showGuides);
    const ctx: MenuContext = { actions, mod: isMac ? 'Cmd' : 'Ctrl', coarse, selectionCount, showGuides };
    return (
        <header className="top-bar">
            <div className="top-left">
                <IconButton label="All cheatsheets" icon="library" onClick={onOpenLibrary} />
                {onTogglePages && <IconButton label="Pages" icon="pages" pressed={pagesOpen} onClick={onTogglePages} />}
                <TitleField />
            </div>
            <div className="top-mid">
                <IconButton label="Undo" icon="undo" shortcut={`${ctx.mod}+Z`} disabled={!canUndo(history)} onClick={() => store.undo()} />
                <IconButton label="Redo" icon="redo" shortcut={`${ctx.mod}+Shift+Z`} disabled={!canRedo(history)} onClick={() => store.redo()} />
                {phone ? (
                    <MenuButton
                        label="More"
                        icon="more"
                        iconOnly
                        align="end"
                        items={[...insertItems(ctx), 'separator', ...layoutItems(ctx).slice(0, 2), 'separator', ...exportItems(ctx), 'separator', ...viewItems(ctx)]}
                    />
                ) : (
                    <>
                        <span className="top-sep" />
                        <MenuButton label="Insert" items={insertItems(ctx)} />
                        <MenuButton label="Layout" items={layoutItems(ctx)} />
                        <MenuButton label="View" items={viewItems(ctx)} />
                        <MenuButton label="Export" items={exportItems(ctx)} />
                    </>
                )}
            </div>
            <div className="top-right">
                {!phone && <StatusIndicator actions={actions} />}
                <ThemeToggle />
                {!phone && <IconButton label="Keyboard shortcuts" icon="keyboard" shortcut="?" onClick={() => store.openDialog('shortcuts')} />}
            </div>
        </header>
    );
}
