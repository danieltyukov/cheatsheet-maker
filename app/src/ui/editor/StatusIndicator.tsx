import type { Actions } from '../actions';
import { Icon } from '../icons';
import { useEditor } from '../store';

export function StatusIndicator({ actions }: { actions: Actions }) {
    const s = useEditor((st) => st.saveStatus);
    if (s.state === 'error') {
        return (
            <button type="button" className="status status-error" title={`${s.message} Click to save a .cheatsheet file instead.`} onClick={() => void actions.saveCheatsheet()}>
                <Icon name="warning" size={16} />
                <span>Not saved</span>
            </button>
        );
    }
    return (
        <span className="status" role="status" aria-live="polite">
            {s.state === 'saved' ? <Icon name="check" size={16} /> : null}
            <span>{s.state === 'saved' ? 'Saved' : 'Saving'}</span>
        </span>
    );
}
