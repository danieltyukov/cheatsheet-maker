/** A stand-in for CanvasRenderingContext2D that records calls and property writes. */
export function recordingContext() {
    const calls: Array<[string, ...unknown[]]> = [];
    const target: Record<string, unknown> = {};
    const ctx = new Proxy(target, {
        get(_t, prop: string) {
            if (prop === 'calls') return calls;
            if (prop in target) return target[prop];
            return (...args: unknown[]) => {
                calls.push([prop, ...args]);
            };
        },
        set(_t, prop: string, value) {
            target[prop] = value;
            calls.push([`set:${prop}`, value]);
            return true;
        },
    });
    return ctx as unknown as CanvasRenderingContext2D & { calls: typeof calls };
}

/** Node has no Path2D; tests only need to know which path was drawn. */
export class FakePath2D {
    constructor(public d = '') {}
}
