import type { SaveStatus } from '../storage/autosave';
import type { EditorStore } from './store';

const REMEDY = 'Save a .cheatsheet file to keep your work.';

/**
 * Feeds autosave results to the store. A failing save raises one toast, not one per retry;
 * the next one comes only after a save has gone through again.
 */
export function createSaveReporter(store: EditorStore, persistent: boolean, reason = 'Browser storage is unavailable.'): (s: SaveStatus) => void {
    if (!persistent) {
        // Without storage the in-memory copy is not a save, so keep saying so.
        store.setSaveStatus({ state: 'error', message: reason, keptInMemory: true });
        store.toast(`${reason} ${REMEDY}`, 'error');
        return (s) => {
            if (s.state === 'error') store.setSaveStatus(s);
        };
    }
    let failing = false;
    return (s) => {
        store.setSaveStatus(s);
        if (s.state === 'saved') failing = false;
        else if (s.state === 'error' && !failing) {
            failing = true;
            store.toast(`${s.message} ${REMEDY}`, 'error');
        }
    };
}
