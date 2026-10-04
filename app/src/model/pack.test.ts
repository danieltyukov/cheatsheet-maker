import { describe, expect, test } from 'vitest';
import { arrange, fitScale, maxRectsPack, type Placement } from './pack';

function assertValid(placed: Placement[], binW: number, binH: number, gap: number) {
    for (const p of placed) {
        expect(p.x).toBeGreaterThanOrEqual(-1e-6);
        expect(p.y).toBeGreaterThanOrEqual(-1e-6);
        expect(p.x + p.w).toBeLessThanOrEqual(binW + 1e-6);
        expect(p.y + p.h).toBeLessThanOrEqual(binH + 1e-6);
    }
    for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
            const a = placed[i], b = placed[j];
            if (a.bin !== b.bin) continue;
            const apart = a.x + a.w + gap <= b.x + 1e-6 || b.x + b.w + gap <= a.x + 1e-6
                || a.y + a.h + gap <= b.y + 1e-6 || b.y + b.h + gap <= a.y + 1e-6;
            expect(apart, `${a.id} and ${b.id} overlap`).toBe(true);
        }
    }
}

// Deterministic pseudo-random sizes so failures reproduce.
function boxes(n: number, seed = 7) {
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: n }, (_, i) => ({ id: `b${i}`, w: 20 + rnd() * 120, h: 15 + rnd() * 90 }));
}

describe('maxRectsPack', () => {
    test.each(['topLeft', 'bestShortSide'] as const)('%s places without overlap and keeps the gap', (h) => {
        const { placed, rest } = maxRectsPack(boxes(30), 500, 700, 4, h);
        expect(placed.length + rest.length).toBe(30);
        assertValid(placed, 500, 700, 4);
    });
    test('the first box goes to the top-left corner', () => {
        const { placed } = maxRectsPack([{ id: 'a', w: 10, h: 10 }], 100, 100, 0, 'topLeft');
        expect(placed[0]).toMatchObject({ x: 0, y: 0 });
    });
});

describe('arrange', () => {
    test('spills onto further bins', () => {
        const out = arrange([{ id: 'a', w: 60, h: 60 }, { id: 'b', w: 60, h: 60 }, { id: 'c', w: 60, h: 60 }], 100, 100, 0);
        expect(out.map((p) => p.bin).sort()).toEqual([0, 1, 2]);
    });
    test('shrinks a box that is larger than the bin', () => {
        const [p] = arrange([{ id: 'a', w: 200, h: 50 }], 100, 100, 0);
        expect(p.w).toBeCloseTo(100);
        expect(p.h).toBeCloseTo(25);
    });
    test('places everything validly', () => {
        const out = arrange(boxes(60), 400, 400, 3);
        expect(out).toHaveLength(60);
        assertValid(out, 400, 400, 3);
    });
});

describe('fitScale', () => {
    test('two squares in a square bin scale to half the side', () => {
        const r = fitScale([{ id: 'a', w: 10, h: 10 }, { id: 'b', w: 10, h: 10 }], 100, 100, 0)!;
        expect(r.scale).toBeCloseTo(5, 2);
        assertValid(r.placements, 100, 100, 0);
    });
    test('shrinks when the boxes do not fit', () => {
        const r = fitScale(boxes(40), 300, 300, 2)!;
        expect(r.scale).toBeLessThan(1);
        expect(r.placements).toHaveLength(40);
        assertValid(r.placements, 300, 300, 2);
    });
    test('returns null for an empty list', () => {
        expect(fitScale([], 100, 100, 0)).toBeNull();
    });
});
