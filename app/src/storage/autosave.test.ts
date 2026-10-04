import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createAutosaver, describeStorageError, type SaveStatus } from './autosave';
import { createDocument } from '../model/factory';
import { setTitle } from '../model/commands';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('debounces to the last document after 500 ms', async () => {
    const saved: string[] = [];
    const statuses: SaveStatus['state'][] = [];
    const a = createAutosaver(async (d) => { saved.push(d.title); }, (s) => statuses.push(s.state));
    const doc = createDocument('one', 0);
    a.schedule(doc);
    a.schedule(setTitle(doc, 'two'));
    await vi.advanceTimersByTimeAsync(499);
    expect(saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(saved).toEqual(['two']);
    expect(statuses).toEqual(['saving', 'saved']);
});

test('reports failures and keeps editing possible', async () => {
    const statuses: SaveStatus[] = [];
    const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    const a = createAutosaver(async () => { throw quota; }, (s) => statuses.push(s));
    a.schedule(createDocument('x', 0));
    await vi.advanceTimersByTimeAsync(500);
    expect(statuses.at(-1)).toEqual({ state: 'error', message: describeStorageError(quota) });
    expect(describeStorageError(quota)).toMatch(/full/i);
});

test('flush saves immediately and saves run one at a time', async () => {
    let running = 0, maxRunning = 0;
    const a = createAutosaver(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 100));
        running--;
    }, () => {});
    const doc = createDocument('x', 0);
    a.schedule(doc);
    const f1 = a.flush();
    a.schedule(setTitle(doc, 'y'));
    const f2 = a.flush();
    await vi.advanceTimersByTimeAsync(300);
    await Promise.all([f1, f2]);
    expect(maxRunning).toBe(1);
});
