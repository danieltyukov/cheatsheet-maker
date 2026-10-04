import { expect, test } from 'vitest';
import { dataUrlBytes } from './rasterize';

test('decodes a data URL back to the exact bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255, 128]);
    expect(dataUrlBytes(`data:image/png;base64,${Buffer.from(bytes).toString('base64')}`)).toEqual(bytes);
    expect(() => dataUrlBytes('data:,')).toThrow();
});

test('decodes a 12 MB image quickly enough not to freeze the editor', () => {
    const bytes = new Uint8Array(12 * 1024 * 1024).map((_, i) => (i * 31) & 255);
    const url = `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
    const t0 = performance.now();
    const out = dataUrlBytes(url);
    const ms = performance.now() - t0;
    expect(out.length).toBe(bytes.length);
    expect(out[12345]).toBe(bytes[12345]);
    // Uint8Array.from(atob(s), mapFn) takes about 600 ms for this; a plain loop about 50 ms.
    expect(ms).toBeLessThan(250);
});
