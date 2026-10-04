import type { FontKey, TextAlign } from '../model/types';
import type { FontSpec } from './fonts';
import type { Block, Span } from './markdown';

export type Measurer = (text: string, font: FontSpec) => number;

/** Points: `ascent` above the baseline, `depth` below it. */
export interface MathMetrics {
    width: number;
    ascent: number;
    depth: number;
}

/** Returns null while the formula is still being typeset. */
export type MathSource = (tex: string, display: boolean, fontSize: number) => MathMetrics | null;

export type Run =
    | { kind: 'text'; x: number; baseline: number; text: string; font: FontSpec }
    | { kind: 'math'; x: number; top: number; w: number; h: number; tex: string; display: boolean };

export interface TextLayout {
    runs: Run[];
    height: number;
}

export interface LayoutOptions {
    width: number;
    fontSize: number;
    font: FontKey;
    align: TextAlign;
    measure: Measurer;
    math: MathSource;
    lineHeight?: number;
}

type Token =
    | { kind: 'text'; text: string; font: FontSpec; w: number; space: boolean }
    | { kind: 'math'; tex: string; w: number; ascent: number; depth: number };

function placeholder(size: number): MathMetrics {
    return { width: size * 2, ascent: size * 0.75, depth: size * 0.25 };
}

function tokenize(spans: Span[], base: FontSpec, o: LayoutOptions): Token[] {
    const out: Token[] = [];
    for (const s of spans) {
        if (s.kind === 'math') {
            const m = o.math(s.tex, false, base.size) ?? placeholder(base.size);
            out.push({ kind: 'math', tex: s.tex, w: m.width, ascent: m.ascent, depth: m.depth });
            continue;
        }
        const font: FontSpec = s.code
            ? { family: 'mono', size: base.size * 0.92, bold: base.bold || s.bold, italic: s.italic }
            : { family: base.family, size: base.size, bold: base.bold || s.bold, italic: base.italic || s.italic };
        for (const part of s.text.split(/(\s+)/)) {
            if (!part) continue;
            const space = /^\s+$/.test(part);
            const text = space ? ' ' : part;
            out.push({ kind: 'text', text, font, w: o.measure(text, font), space });
        }
    }
    return out;
}

/** Split a word that is wider than the line into pieces that fit. */
function hardBreak(t: Extract<Token, { kind: 'text' }>, avail: number, o: LayoutOptions): Token[] {
    const pieces: Token[] = [];
    let cur = '';
    for (const ch of t.text) {
        if (cur && o.measure(cur + ch, t.font) > avail) {
            pieces.push({ ...t, text: cur, w: o.measure(cur, t.font) });
            cur = '';
        }
        cur += ch;
    }
    if (cur) pieces.push({ ...t, text: cur, w: o.measure(cur, t.font) });
    return pieces;
}

function sameFont(a: FontSpec, b: FontSpec) {
    return a.family === b.family && a.size === b.size && a.bold === b.bold && a.italic === b.italic;
}

/** Lay out tokens from `y`, inside [x0, x0 + avail]; returns the new y. */
function flow(tokens: Token[], x0: number, avail: number, y: number, base: FontSpec, o: LayoutOptions, runs: Run[], firstBaseline?: (b: number) => void): number {
    const lh = o.lineHeight ?? 1.25;
    const lines: Token[][] = [[]];
    let x = 0;
    const queue = [...tokens];
    while (queue.length) {
        const t = queue.shift()!;
        const line = lines[lines.length - 1];
        if (t.kind === 'text' && t.space && line.length === 0) continue;
        if (x + t.w > avail + 1e-9 && line.length > 0 && !(t.kind === 'text' && t.space)) {
            lines.push([]);
            x = 0;
            queue.unshift(t);
            continue;
        }
        // A single character that is still too wide is placed anyway; splitting it again would loop forever.
        if (t.kind === 'text' && !t.space && t.w > avail + 1e-9 && [...t.text].length > 1) {
            queue.unshift(...hardBreak(t, avail, o));
            continue;
        }
        line.push(t);
        x += t.w;
    }
    lines.forEach((line, li) => {
        const lineStart = runs.length;
        while (line.length && line[line.length - 1].kind === 'text' && (line[line.length - 1] as { space: boolean }).space) line.pop();
        let ascent = base.size * 0.8, depth = base.size * 0.2;
        for (const t of line) {
            if (t.kind === 'math') {
                ascent = Math.max(ascent, t.ascent);
                depth = Math.max(depth, t.depth);
            } else {
                ascent = Math.max(ascent, t.font.size * 0.8);
                depth = Math.max(depth, t.font.size * 0.2);
            }
        }
        const box = Math.max(base.size * lh, ascent + depth + base.size * 0.1);
        const baseline = y + (box - (ascent + depth)) / 2 + ascent;
        if (li === 0) firstBaseline?.(baseline);
        const width = line.reduce((a, t) => a + t.w, 0);
        let x = x0 + (o.align === 'center' ? (avail - width) / 2 : o.align === 'right' ? avail - width : 0);
        for (const t of line) {
            if (t.kind === 'math') {
                runs.push({ kind: 'math', x, top: baseline - t.ascent, w: t.w, h: t.ascent + t.depth, tex: t.tex, display: false });
            } else {
                const prev = runs[runs.length - 1];
                if (runs.length > lineStart && prev.kind === 'text' && sameFont(prev.font, t.font)) prev.text += t.text;
                else runs.push({ kind: 'text', x, baseline, text: t.text, font: t.font });
            }
            x += t.w;
        }
        y += box;
    });
    return y;
}

export function layoutText(blocks: Block[], o: LayoutOptions): TextLayout {
    const runs: Run[] = [];
    let y = 0;
    const base: FontSpec = { family: o.font, size: o.fontSize, bold: false, italic: false };
    for (const b of blocks) {
        if (b.kind === 'blank') {
            y += o.fontSize * 0.5;
        } else if (b.kind === 'heading') {
            const font = { ...base, size: o.fontSize * (b.level === 1 ? 1.4 : 1.18), bold: true };
            y = flow(tokenize(b.spans, font, o), 0, o.width, y, font, o, runs) + font.size * 0.15;
        } else if (b.kind === 'list') {
            const indent = (b.depth + 1) * o.fontSize * 1.2;
            // Pushed first so it reads before the item; flow() fills in its position.
            const marker = { kind: 'text' as const, x: 0, baseline: 0, text: b.marker, font: base };
            runs.push(marker);
            const left = { ...o, align: 'left' as const };
            y = flow(tokenize(b.spans, base, left), indent, Math.max(o.fontSize, o.width - indent), y, base, left, runs, (bl) => {
                marker.x = indent - o.measure(b.marker, base) - o.fontSize * 0.35;
                marker.baseline = bl;
            });
        } else if (b.kind === 'math') {
            const m = o.math(b.tex, true, o.fontSize) ?? placeholder(o.fontSize * 1.2);
            const scale = Math.min(1, o.width / m.width);
            const w = m.width * scale, h = (m.ascent + m.depth) * scale;
            // Display formulas are centred whatever the paragraph alignment, as in print.
            const x = (o.width - w) / 2;
            y += o.fontSize * 0.2;
            runs.push({ kind: 'math', x, top: y, w, h, tex: b.tex, display: true });
            y += h + o.fontSize * 0.2;
        } else {
            y = flow(tokenize(b.spans, base, o), 0, o.width, y, base, o, runs);
        }
    }
    return { runs, height: y };
}
