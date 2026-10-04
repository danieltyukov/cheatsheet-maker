import { expect, test } from 'vitest';
import { parseColor, toHex } from './colors';

test('parses hex forms', () => {
    expect(parseColor('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseColor('#112233')).toEqual({ r: 17, g: 34, b: 51, a: 1 });
    expect(parseColor('#11223380').a).toBeCloseTo(0.502, 2);
    expect(parseColor('nonsense')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
});

test('toHex drops alpha when opaque', () => {
    expect(toHex({ r: 255, g: 212, b: 59, a: 1 })).toBe('#ffd43b');
    expect(toHex({ r: 255, g: 212, b: 59, a: 0.5 })).toBe('#ffd43b80');
});
