import type { CheatDocument } from '../model/types';

export type SaveStatus = { state: 'saved'; at: number } | { state: 'saving' } | { state: 'error'; message: string };

export function describeStorageError(e: unknown): string {
    const name = (e as { name?: string })?.name;
    if (name === 'QuotaExceededError') return 'Storage is full. Export a backup and delete cheatsheets you no longer need.';
    if (name === 'InvalidStateError' || name === 'UnknownError' || name === 'SecurityError') {
        return 'This browser is not letting the app store anything (a private window does this).';
    }
    return `Could not save: ${(e as Error)?.message ?? String(e)}`;
}

export interface Autosaver {
    schedule(doc: CheatDocument): void;
    flush(): Promise<void>;
    dispose(): void;
}

export function createAutosaver(save: (doc: CheatDocument) => Promise<void>, onStatus: (s: SaveStatus) => void, delay = 500): Autosaver {
    let pending: CheatDocument | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let chain: Promise<void> = Promise.resolve();
    let last: SaveStatus['state'] | null = null;
    const report = (s: SaveStatus) => {
        if (s.state === 'saving' && last === 'saving') return;
        last = s.state;
        onStatus(s);
    };

    const run = () => {
        timer = null;
        chain = chain.then(async () => {
            const doc = pending;
            if (!doc) return;
            pending = null;
            try {
                await save(doc);
                if (!pending && !timer) report({ state: 'saved', at: Date.now() });
            } catch (e) {
                pending ??= doc;
                report({ state: 'error', message: describeStorageError(e) });
            }
        });
        return chain;
    };

    return {
        schedule(doc) {
            pending = doc;
            report({ state: 'saving' });
            if (timer) clearTimeout(timer);
            timer = setTimeout(run, delay);
        },
        flush() {
            if (timer) clearTimeout(timer);
            return run();
        },
        dispose() {
            if (timer) clearTimeout(timer);
            timer = null;
        },
    };
}
