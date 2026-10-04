// Captures the README and website screenshots from the real app.
//
//   node scripts/screenshots.mjs
//
// Builds the e2e bundle (which exposes window.__cm), serves it, assembles a demo cheatsheet
// through the app's own actions, and saves desktop and phone shots in light and dark to docs/img.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs/img');
mkdirSync(out, { recursive: true });

const FIGURES = ['bode.png', 'polezero.png', 'step.png'].map((f) => readFileSync(join(root, 'scripts/demo', f)).toString('base64'));

const TEXTS = [
    { text: '## Laplace transform\n$$X(s) = \\int_0^{\\infty} x(t)\\,e^{-st}\\,dt$$\n- $\\mathcal{L}\\{e^{-at}\\} = \\frac{1}{s+a}$\n- $\\mathcal{L}\\{\\sin \\omega t\\} = \\frac{\\omega}{s^2+\\omega^2}$\n- final value: $\\lim_{t\\to\\infty} x(t) = \\lim_{s\\to 0} sX(s)$', background: null },
    { text: '## Second-order system\n$$H(s) = \\frac{\\omega_n^2}{s^2 + 2\\zeta\\omega_n s + \\omega_n^2}$$\n- overshoot $M_p = e^{-\\pi\\zeta/\\sqrt{1-\\zeta^2}}$\n- settling time $t_s \\approx 4/(\\zeta\\omega_n)$\n- **underdamped** when $\\zeta < 1$', background: '#fff3bf' },
    { text: '## Fourier pairs\n- $e^{-a|t|} \\leftrightarrow \\frac{2a}{a^2+4\\pi^2 f^2}$\n- $\\delta(t) \\leftrightarrow 1$\n- $x(t-t_0) \\leftrightarrow e^{-j2\\pi f t_0}X(f)$\n**Parseval** $\\int |x|^2 dt = \\int |X|^2 df$', background: null },
    { text: '## Z-transform\n$$X(z) = \\sum_{n} x[n]\\, z^{-n}$$\nCausal and stable when every pole lies inside the unit circle, $|p| < 1$.', background: '#d0ebff' },
];

async function waitFor(url) {
    for (let i = 0; i < 120; i++) {
        try {
            if ((await fetch(url)).ok) return;
        } catch {
            // not up yet
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`${url} did not come up`);
}

async function buildDemo(page) {
    await page.evaluate(async ({ figures, texts }) => {
        const cm = window.__cm;
        const blobs = figures.map((b64) => new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'image/png' }));
        await cm.actions.importImages(blobs);
        // Imports scale by the screen's pixel ratio; give the figures one fixed size so every
        // screenshot shows the same packed sheet.
        cm.store.apply((d) => ({
            ...d,
            pages: d.pages.map((p) => ({
                ...p,
                items: p.items.map((i) => (i.kind === 'image' ? { ...i, w: i.crop.w * 0.25, h: i.crop.h * 0.25 } : i)),
            })),
        }));
        for (const t of texts) {
            cm.actions.pasteText(t.text);
            const id = cm.store.getState().selection[0];
            cm.store.apply((d) => ({
                ...d,
                title: 'Signals and Systems final',
                pages: d.pages.map((p) => ({ ...p, items: p.items.map((i) => (i.id === id ? { ...i, background: t.background, fontSize: 9, w: 230 } : i)) })),
            }));
        }
    }, { figures: FIGURES, texts: TEXTS });
    // Let MathJax typeset so text boxes have their final heights before packing.
    await page.waitForTimeout(2500);
    await page.evaluate(async () => {
        const cm = window.__cm;
        await cm.assets.maths.whenIdle();
        cm.store.select([]);
        cm.store.patch({ packGap: 6 });
        cm.actions.pack('fit');
        // A highlighter swipe across the key line of the second-order box.
        const items = cm.store.doc.pages[0].items;
        const text = items.find((i) => i.kind === 'text' && i.text.startsWith('## Second-order'));
        const mark = {
            id: 'demo-hl', kind: 'stroke', tool: 'highlighter', color: '#ffd43b80', size: 9, rotation: 0,
            x: text.x + 8, y: text.y + text.h * 0.86, w: text.w * 0.55, h: 10,
            points: [5, 5, 0.5, text.w * 0.27, 4, 0.5, text.w * 0.55 - 5, 5, 0.5],
        };
        const extra = [mark];
        cm.store.apply((d) => ({ ...d, pages: d.pages.map((p, i) => (i === 0 ? { ...p, items: [...p.items, ...extra] } : p)) }));
        cm.store.select([]);
        cm.actions.zoomFit();
    });
    await page.waitForTimeout(1500);
}

async function shoot(browser, { name, width, height, scheme, scale }) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: scheme, hasTouch: width < 720 });
    const page = await context.newPage();
    await page.goto('http://localhost:4173/');
    await page.getByRole('textbox', { name: 'Title' }).waitFor();
    await buildDemo(page);
    const png = join(out, `${name}.png`);
    await page.screenshot({ path: png });
    await context.close();
    return png;
}

execFileSync('npm', ['run', 'build:e2e', '-w', 'app'], { cwd: root, stdio: 'inherit' });
const server = spawn('npm', ['run', 'preview', '-w', 'app'], { cwd: root, stdio: 'ignore', detached: true });
try {
    await waitFor('http://localhost:4173/');
    const browser = await chromium.launch();
    const shots = [
        { name: 'editor-light', width: 1440, height: 900, scheme: 'light', scale: 2 },
        { name: 'editor-dark', width: 1440, height: 900, scheme: 'dark', scale: 2 },
        { name: 'phone', width: 390, height: 844, scheme: 'light', scale: 3 },
        { name: 'phone-dark', width: 390, height: 844, scheme: 'dark', scale: 3 },
    ];
    for (const s of shots) {
        const png = await shoot(browser, s);
        // WebP keeps the repository small; Pillow ships with a WebP encoder.
        const webp = png.replace(/\.png$/, '.webp');
        execFileSync('python3', ['-c', 'import sys; from PIL import Image; Image.open(sys.argv[1]).save(sys.argv[2], quality=88, method=6)', png, webp]);
        rmSync(png);
        console.log('wrote', s.name);
    }
    await browser.close();
} finally {
    process.kill(-server.pid);
}
