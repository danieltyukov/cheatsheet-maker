import { Dialog } from '../components/Dialog';
import { SHORTCUT_LIST } from '../shortcuts';
import { useEditor, useStore } from '../store';

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

export function ShortcutsDialog({ isMac }: { isMac: boolean }) {
    const store = useStore();
    const open = useEditor((s) => s.dialog === 'shortcuts');
    const mod = isMac ? 'Cmd' : 'Ctrl';
    return (
        <Dialog open={open} onClose={() => store.openDialog(null)} title="Keyboard shortcuts" className="shortcuts-dialog">
            <div className="shortcut-groups">
                {SHORTCUT_LIST.map((g) => (
                    <section key={g.group}>
                        <h3>{g.group}</h3>
                        <dl>
                            {g.items.map(([keys, what]) => (
                                <div key={keys} className="shortcut">
                                    <dt><kbd>{keys.replace(/Mod/g, mod)}</kbd></dt>
                                    <dd>{what}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                ))}
            </div>
            <p className="version">Cheatsheet Maker {VERSION}</p>
        </Dialog>
    );
}
