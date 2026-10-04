import { useMemo } from 'react';
import { printCheck } from '../../model/printCheck';
import type { Actions } from '../actions';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { useEditor, useStore } from '../store';

export function PrintCheckDialog({ actions }: { actions: Actions }) {
    const store = useStore();
    const open = useEditor((s) => s.dialog === 'print-check');
    const doc = useEditor((s) => s.history.present);
    const issues = useMemo(() => (open ? printCheck(doc) : []), [open, doc]);
    const close = () => store.openDialog(null);
    return (
        <Dialog
            open={open}
            onClose={close}
            title="Print check"
            footer={
                <>
                    <Button
                        onClick={() => {
                            close();
                            actions.zoomActual();
                        }}
                    >
                        View at actual size
                    </Button>
                    <Button variant="primary" onClick={close}>Close</Button>
                </>
            }
        >
            {issues.length === 0 ? (
                <p>No problems found: every image is at least 150 DPI and all text is 5 pt or larger.</p>
            ) : (
                <ul className="issues">
                    {issues.map((i) => (
                        <li key={i.itemId}>
                            <span>
                                <strong>Page {i.pageIndex + 1}.</strong> {i.message}
                            </span>
                            <Button
                                size="sm"
                                onClick={() => {
                                    close();
                                    actions.goToPage(i.pageIndex);
                                    store.setTool('select');
                                    store.select([i.itemId]);
                                }}
                            >
                                Show
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </Dialog>
    );
}
