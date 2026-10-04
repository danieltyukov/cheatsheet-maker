import { expect, test } from 'vitest';
import { texToSvg } from './math';

test('typesets inline math as one SVG with sensible metrics', async () => {
    const m = await texToSvg('a+b+c+d+e', false);
    expect(m.svg.startsWith('<svg')).toBe(true);
    expect(m.svg.match(/<svg/g)).toHaveLength(1);
    expect(m.width).toBeGreaterThan(5);
    expect(m.ascent).toBeGreaterThan(0.4);
});

test('loads extra alphabets on demand', async () => {
    const m = await texToSvg('\\mathbb{R}^n \\to \\mathcal{L}', false);
    expect(m.width).toBeGreaterThan(3);
});

test('a bad formula renders an error box instead of throwing', async () => {
    const m = await texToSvg('\\frac{', true);
    expect(m.svg).toContain('merror');
});

test('the SVG stays well-formed when the TeX contains < or &', async () => {
    const m = await texToSvg('\\zeta < 1 \;\\&\; a > b', false);
    // A raw < or & inside an attribute value makes the SVG invalid XML, and the image never decodes.
    const attrs = [...m.svg.matchAll(/="([^"]*)"/g)].map((a) => a[1]);
    expect(attrs.filter((v) => /[<&](?!(?:lt|gt|amp|quot|#\d+);)/.test(v))).toEqual([]);
});
