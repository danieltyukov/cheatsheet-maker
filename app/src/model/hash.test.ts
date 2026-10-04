import { expect, test } from 'vitest';
import { sha256Hex, sha256Sync } from './hash';

const abc = new TextEncoder().encode('abc');
const ABC_HASH = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

test('sha256Hex matches the standard test vector', async () => {
    expect(await sha256Hex(abc)).toBe(ABC_HASH);
});

test('the fallback agrees with WebCrypto, including multi-block input', async () => {
    const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    expect(hex(sha256Sync(abc))).toBe(ABC_HASH);
    const long = new Uint8Array(1000).map((_, i) => i % 251);
    expect(hex(sha256Sync(long))).toBe(await sha256Hex(long));
});
