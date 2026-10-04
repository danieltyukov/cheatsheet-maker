export const MAX_IMAGE_SIDE = 4096;

export function readPngSize(b: Uint8Array): { width: number; height: number } | null {
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    if (b.length < 24 || sig.some((v, i) => b[i] !== v)) return null;
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { width: v.getUint32(16), height: v.getUint32(20) };
}

export function sniffImageMime(b: Uint8Array): string | null {
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp';
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
    return null;
}

export function downscaleSize(width: number, height: number, max = MAX_IMAGE_SIDE) {
    const scale = Math.min(1, max / Math.max(width, height));
    return { width: Math.round(width * scale), height: Math.round(height * scale), scale };
}
