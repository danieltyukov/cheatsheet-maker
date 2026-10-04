import { describe, expect, test } from 'vitest';
import { layoutText, type LayoutOptions, type Run } from './textLayout';
import { parseMarkdown } from './markdown';

// Every character is half the font size wide; bold is a little wider.
const measure: LayoutOptions['measure'] = (text, f) => text.length * f.size * (f.bold ? 0.55 : 0.5);
const math: LayoutOptions['math'] = (tex, _display, size) => ({ width: tex.length * size * 0.5, ascent: size * 0.8, depth: size * 0.2 });
const opts = (o: Partial<LayoutOptions> = {}): LayoutOptions => ({ width: 100, fontSize: 10, font: 'sans', align: 'left', measure, math, ...o });
const texts = (runs: Run[]) => runs.filter((r): r is Extract<Run, { kind: 'text' }> => r.kind === 'text');

describe('layoutText', () => {
    test('wraps words at the width and stacks lines', () => {
        // "aaaa bbbb cccc" at 5 pt per character: 20 + 5 + 20 = 45 per pair, three words need 70
        const out = layoutText(parseMarkdown('aaaa bbbb cccc dddd'), opts({ width: 50 }));
        const lines = [...new Set(texts(out.runs).map((r) => r.baseline))];
        expect(lines).toHaveLength(2);
        expect(out.height).toBeCloseTo(25, 5);
    });
    test('centre alignment offsets the line', () => {
        const out = layoutText(parseMarkdown('ab'), opts({ align: 'center' }));
        expect(texts(out.runs)[0].x).toBeCloseTo(45);
    });
    test('list items are indented with a marker', () => {
        const out = layoutText(parseMarkdown('- item'), opts());
        const [marker, body] = texts(out.runs);
        expect(marker.text).toBe('•');
        expect(body.x).toBeCloseTo(12);
        expect(marker.x).toBeLessThan(body.x);
    });
    test('a word longer than the width is broken', () => {
        const out = layoutText(parseMarkdown('x'.repeat(30)), opts({ width: 50 }));
        expect(texts(out.runs).every((r) => measure(r.text, r.font) <= 50 + 1e-9)).toBe(true);
        expect(texts(out.runs).map((r) => r.text).join('')).toBe('x'.repeat(30));
    });
    test('display math is centred and scaled down to fit', () => {
        const out = layoutText(parseMarkdown('$$' + 'y'.repeat(40) + '$$'), opts());
        const m = out.runs.find((r) => r.kind === 'math')!;
        expect(m.kind === 'math' && m.w).toBeCloseTo(100);
        expect(m.x).toBeCloseTo(0);
    });
    test('missing math metrics reserve a placeholder', () => {
        const out = layoutText(parseMarkdown('a $x$'), opts({ math: () => null }));
        expect(out.runs.some((r) => r.kind === 'math')).toBe(true);
    });
    test('headings are bigger and bold', () => {
        const out = layoutText(parseMarkdown('# H'), opts());
        expect(texts(out.runs)[0].font).toMatchObject({ bold: true, size: 14 });
    });
});

test('a box narrower than one character still lays out (one character per line)', () => {
    const out = layoutText(parseMarkdown('ab'), opts({ width: 2 }));
    expect(texts(out.runs).map((r) => r.text)).toEqual(['a', 'b']);
}, 2000);
