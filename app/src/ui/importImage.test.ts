import { expect, test } from 'vitest';
import { chooseEncoding } from './importImage';

test('keeps small PNG, JPEG and WebP bytes as they are', () => {
    expect(chooseEncoding('image/png', false)).toBe('keep');
    expect(chooseEncoding('image/jpeg', false)).toBe('keep');
    expect(chooseEncoding('image/webp', false)).toBe('keep');
});

test('re-encodes GIFs and anything that was downscaled', () => {
    expect(chooseEncoding('image/gif', false)).toBe('png');
    expect(chooseEncoding('image/png', true)).toBe('png');
    expect(chooseEncoding('image/jpeg', true)).toBe('jpeg');
});
