import { expect, test } from 'vitest';
import { createSaveReporter } from './saveStatus';
import { EditorStore } from './store';
import { createDocument } from '../model/factory';

const error = { state: 'error' as const, message: 'Storage is full.' };

test('the first failed save raises one error toast; repeats do not pile up', () => {
    const store = new EditorStore(createDocument('t', 0));
    const report = createSaveReporter(store, true);
    report({ state: 'saving' });
    report(error);
    report({ state: 'saving' });
    report(error);
    expect(store.getState().saveStatus).toEqual(error);
    expect(store.getState().toasts.filter((t) => t.kind === 'error')).toHaveLength(1);
    report({ state: 'saved', at: 1 });
    report(error);
    expect(store.getState().toasts.filter((t) => t.kind === 'error')).toHaveLength(2);
});

test('without real storage, a save into memory never reads as saved', () => {
    const store = new EditorStore(createDocument('t', 0));
    const report = createSaveReporter(store, false, 'Browser storage is unavailable.');
    expect(store.getState().saveStatus).toMatchObject({ state: 'error', keptInMemory: true });
    expect(store.getState().toasts.filter((t) => t.kind === 'error')).toHaveLength(1);
    report({ state: 'saved', at: 1 });
    expect(store.getState().saveStatus.state).toBe('error');
});
