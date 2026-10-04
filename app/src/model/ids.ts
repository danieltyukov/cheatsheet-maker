const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function newId(length = 12): string {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let out = '';
    for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
    return out;
}
