export type Span =
    | { kind: 'text'; text: string; bold: boolean; italic: boolean; code: boolean }
    | { kind: 'math'; tex: string };

export type Block =
    | { kind: 'paragraph'; spans: Span[] }
    | { kind: 'heading'; level: 1 | 2; spans: Span[] }
    | { kind: 'list'; marker: string; depth: number; spans: Span[] }
    | { kind: 'math'; tex: string }
    | { kind: 'blank' };

/** Pandoc's rule: `$` opens before a non-space and closes after a non-space, not followed by a digit. */
function closingDollar(src: string, from: number): number {
    if (from >= src.length || /\s/.test(src[from])) return -1;
    for (let i = from; i < src.length; i++) {
        if (src[i] === '\\') {
            i++;
            continue;
        }
        if (src[i] === '$' && !/\s/.test(src[i - 1]) && !/[0-9]/.test(src[i + 1] ?? '')) return i;
    }
    return -1;
}

export function parseInline(src: string): Span[] {
    const out: Span[] = [];
    let bold = false, italic = false, buf = '';
    const flush = () => {
        if (buf) out.push({ kind: 'text', text: buf, bold, italic, code: false });
        buf = '';
    };
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (c === '\\' && i + 1 < src.length && '\\*`$'.includes(src[i + 1])) {
            buf += src[++i];
            continue;
        }
        if (c === '`') {
            const end = src.indexOf('`', i + 1);
            if (end > i) {
                flush();
                out.push({ kind: 'text', text: src.slice(i + 1, end), bold, italic, code: true });
                i = end;
                continue;
            }
        }
        if (c === '$') {
            const end = closingDollar(src, i + 1);
            if (end > i + 1) {
                flush();
                out.push({ kind: 'math', tex: src.slice(i + 1, end) });
                i = end;
                continue;
            }
        }
        if (c === '*') {
            flush();
            if (src[i + 1] === '*') {
                bold = !bold;
                i++;
            } else italic = !italic;
            continue;
        }
        buf += c;
    }
    flush();
    return out;
}

export function parseMarkdown(src: string): Block[] {
    const lines = src.replace(/\r\n?/g, '\n').split('\n');
    const out: Block[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const t = line.trim();
        if (t.startsWith('$$')) {
            const rest = t.slice(2);
            const close = rest.indexOf('$$');
            if (close >= 0) {
                out.push({ kind: 'math', tex: rest.slice(0, close).trim() });
                continue;
            }
            let j = i + 1;
            while (j < lines.length && !lines[j].includes('$$')) j++;
            if (j < lines.length) {
                const body = [rest, ...lines.slice(i + 1, j), lines[j].slice(0, lines[j].indexOf('$$'))];
                out.push({ kind: 'math', tex: body.join('\n').trim() });
                i = j;
                continue;
            }
        }
        if (t === '') {
            out.push({ kind: 'blank' });
            continue;
        }
        const indent = (s: string) => Math.floor(s.replace(/\t/g, '  ').length / 2);
        const h = /^(#{1,2})\s+(.*)$/.exec(t);
        if (h) {
            out.push({ kind: 'heading', level: h[1].length as 1 | 2, spans: parseInline(h[2]) });
            continue;
        }
        const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line);
        if (bullet) {
            out.push({ kind: 'list', marker: '•', depth: indent(bullet[1]), spans: parseInline(bullet[2]) });
            continue;
        }
        const numbered = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(line);
        if (numbered) {
            out.push({ kind: 'list', marker: `${numbered[2]}.`, depth: indent(numbered[1]), spans: parseInline(numbered[3]) });
            continue;
        }
        out.push({ kind: 'paragraph', spans: parseInline(line) });
    }
    return out;
}
