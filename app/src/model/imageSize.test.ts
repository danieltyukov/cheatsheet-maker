import { expect, test } from 'vitest';
import { downscaleSize, readPngSize, sniffImageMime } from './imageSize';

const PNG_1x1 = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

test('reads PNG dimensions and rejects other bytes', () => {
    expect(readPngSize(PNG_1x1)).toEqual({ width: 1, height: 1 });
    expect(readPngSize(new Uint8Array([1, 2, 3]))).toBeNull();
});

test('sniffs common image types', () => {
    expect(sniffImageMime(PNG_1x1)).toBe('image/png');
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImageMime(new TextEncoder().encode('RIFF\0\0\0\0WEBP'))).toBe('image/webp');
    expect(sniffImageMime(new Uint8Array([0]))).toBeNull();
});

test('downscales only past the limit and keeps the aspect ratio', () => {
    expect(downscaleSize(800, 600)).toEqual({ width: 800, height: 600, scale: 1 });
    expect(downscaleSize(8000, 6000)).toEqual({ width: 4096, height: 3072, scale: 0.512 });
    expect(downscaleSize(10, 20000).height).toBe(4096);
});
