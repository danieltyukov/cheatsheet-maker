import { describe, expect, test } from 'vitest';
import { parseInline, parseMarkdown } from './markdown';

const t = (text: string, o: Partial<{ bold: boolean; italic: boolean; code: boolean }> = {}) =>
    ({ kind: 'text', text, bold: false, italic: false, code: false, ...o });

describe('parseInline', () => {
    test('bold, italic and code', () => {
        expect(parseInline('a **b** *c* `d*e`')).toEqual([
            t('a '), t('b', { bold: true }), t(' '), t('c', { italic: true }), t(' '), t('d*e', { code: true }),
        ]);
    });
    test('inline math and escapes', () => {
        expect(parseInline('area $\\pi r^2$ and \\$5')).toEqual([t('area '), { kind: 'math', tex: '\\pi r^2' }, t(' and $5')]);
    });
    test('prices are not math', () => {
        expect(parseInline('costs $5 and $10')).toEqual([t('costs $5 and $10')]);
        expect(parseInline('a $ b $ c')).toEqual([t('a $ b $ c')]);
    });
});

describe('parseMarkdown', () => {
    test('headings, lists, paragraphs and blank lines', () => {
        const blocks = parseMarkdown('# Title\n## Sub\n- one\n  - two\n3. three\n\nplain');
        expect(blocks.map((b) => b.kind)).toEqual(['heading', 'heading', 'list', 'list', 'list', 'blank', 'paragraph']);
        expect(blocks[0]).toMatchObject({ level: 1 });
        expect(blocks[3]).toMatchObject({ marker: '•', depth: 1 });
        expect(blocks[4]).toMatchObject({ marker: '3.', depth: 0 });
    });
    test('display math on one line or across lines', () => {
        expect(parseMarkdown('$$E = mc^2$$')).toEqual([{ kind: 'math', tex: 'E = mc^2' }]);
        expect(parseMarkdown('$$\n\\int_0^1 x\\,dx\n$$\nafter')).toEqual([
            { kind: 'math', tex: '\\int_0^1 x\\,dx' },
            { kind: 'paragraph', spans: [t('after')] },
        ]);
    });
    test('bold at the start of a line is not a bullet', () => {
        expect(parseMarkdown('**Key** point')[0].kind).toBe('paragraph');
    });
});
