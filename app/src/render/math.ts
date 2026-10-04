import type { MathMetrics, MathSource } from './textLayout';

export interface MathSvg {
    svg: string;
    /** em */
    width: number;
    ascent: number;
    depth: number;
}

// Every on-demand MathJax font file, keyed by base name. The relative path
// reaches the workspace-root node_modules where npm hoists the package.
const dynamicFonts = import.meta.glob('../../../node_modules/@mathjax/mathjax-newcm-font/mjs/svg/dynamic/*.js');
const fontLoaders = new Map(Object.entries(dynamicFonts).map(([path, load]) => [path.split('/').pop()!, load]));

type Engine = { convert(tex: string, display: boolean): Promise<string> };
let engine: Promise<Engine> | null = null;

async function createEngine(): Promise<Engine> {
    const [{ mathjax }, { TeX }, { SVG }, { liteAdaptor }, { RegisterHTMLHandler }, { MathJaxNewcmFont }] = await Promise.all([
        import('@mathjax/src/js/mathjax.js'),
        import('@mathjax/src/js/input/tex.js'),
        import('@mathjax/src/js/output/svg.js'),
        import('@mathjax/src/js/adaptors/liteAdaptor.js'),
        import('@mathjax/src/js/handlers/html.js'),
        import('@mathjax/mathjax-newcm-font/js/svg.js'),
        import('@mathjax/src/js/input/tex/base/BaseConfiguration.js'),
        import('@mathjax/src/js/input/tex/ams/AmsConfiguration.js'),
        import('@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js'),
        import('@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js'),
        import('@mathjax/src/js/input/tex/cancel/CancelConfiguration.js'),
        import('@mathjax/src/js/input/tex/color/ColorConfiguration.js'),
    ]);
    mathjax.asyncLoad = (name: string) => {
        const load = fontLoaders.get(name.split('/').pop()!);
        if (!load) return Promise.reject(new Error(`MathJax asked for ${name}, which is not bundled`));
        return load();
    };
    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    const doc = mathjax.document('', {
        InputJax: new TeX({ packages: ['base', 'ams', 'newcommand', 'boldsymbol', 'cancel', 'color'] }),
        OutputJax: new SVG({ fontCache: 'none', linebreaks: { inline: false }, font: new MathJaxNewcmFont() }),
    });
    return {
        async convert(tex, display) {
            const node = await doc.convertPromise(tex, { display });
            return adaptor.innerHTML(node);
        },
    };
}

export async function texToSvg(tex: string, display: boolean): Promise<MathSvg> {
    engine ??= createEngine();
    const svg = await (await engine).convert(tex, display);
    const vb = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(svg);
    const [minY, w, h] = vb ? [Number(vb[2]), Number(vb[3]), Number(vb[4])] : [-750, 1000, 1000];
    return { svg, width: w / 1000, ascent: -minY / 1000, depth: (h + minY) / 1000 };
}

/** Typesets on demand, caches results and tells the editor when something new is ready. */
export class MathCache {
    private svgs = new Map<string, MathSvg | 'pending' | 'failed'>();
    private images = new Map<string, HTMLImageElement | 'pending'>();
    private inflight = new Set<Promise<unknown>>();

    constructor(private onReady: () => void) {}

    private track<T>(p: Promise<T>) {
        this.inflight.add(p);
        p.finally(() => this.inflight.delete(p));
    }

    private svgFor(tex: string, display: boolean): MathSvg | null {
        const key = `${display ? 'D' : 'I'}:${tex}`;
        const hit = this.svgs.get(key);
        if (hit && hit !== 'pending' && hit !== 'failed') return hit;
        if (!hit) {
            this.svgs.set(key, 'pending');
            this.track(texToSvg(tex, display).then(
                (m) => { this.svgs.set(key, m); this.onReady(); },
                () => { this.svgs.set(key, 'failed'); },
            ));
        }
        return null;
    }

    metrics: MathSource = (tex, display, fontSize): MathMetrics | null => {
        const m = this.svgFor(tex, display);
        return m && { width: m.width * fontSize, ascent: m.ascent * fontSize, depth: m.depth * fontSize };
    };

    image(tex: string, display: boolean, color: string): CanvasImageSource | null {
        const m = this.svgFor(tex, display);
        if (!m || typeof Image === 'undefined') return null;
        const key = `${display ? 'D' : 'I'}:${color}:${tex}`;
        const hit = this.images.get(key);
        if (hit && hit !== 'pending') return hit;
        if (!hit) {
            this.images.set(key, 'pending');
            // Large intrinsic size so the browser never upscales a small raster.
            const svg = m.svg
                .replace(/currentColor/g, color)
                .replace(/width="[^"]*"/, `width="${(m.width * 64).toFixed(1)}px"`)
                .replace(/height="[^"]*"/, `height="${((m.ascent + m.depth) * 64).toFixed(1)}px"`);
            const img = new Image();
            const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
            img.src = url;
            this.track(img.decode().then(
                () => { this.images.set(key, img); this.onReady(); },
                () => { this.images.delete(key); },
            ).finally(() => URL.revokeObjectURL(url)));
        }
        return null;
    }

    /** Resolves when nothing is being typeset or decoded (used before export). */
    async whenIdle(): Promise<void> {
        while (this.inflight.size) await Promise.allSettled([...this.inflight]);
    }
}
