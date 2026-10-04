import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { Rect } from '../../model/types';
import { canvasToBytes } from '../../render/rasterize';
import type { Actions } from '../actions';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { IconButton } from '../components/IconButton';
import { Segmented } from '../components/Segmented';
import { useEditor, useStore } from '../store';
import './pdfImport.css';

type Load =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; pdf: PDFDocumentProxy; name: string };

/** pdf.js 6 tears a document down through its loading task, so both are returned. */
async function openPdf(file: File): Promise<{ pdf: PDFDocumentProxy; destroy: () => Promise<void> }> {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    try {
        return { pdf: await task.promise, destroy: () => task.destroy() };
    } catch (e) {
        void task.destroy();
        throw e;
    }
}

async function renderInto(page: PDFPageProxy, scale: number, canvas: HTMLCanvasElement): Promise<void> {
    const viewport = page.getViewport({ scale });
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    // Draw into this canvas's own 2D context so the pixels are ours to encode right after.
    const canvasContext = canvas.getContext('2d');
    if (!canvasContext) throw new Error('This browser cannot draw the PDF page.');
    await page.render({ canvas, canvasContext, viewport }).promise;
}

function Thumb({ pdf, n, active, count, onPick }: { pdf: PDFDocumentProxy; n: number; active: boolean; count: number; onPick: () => void }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        let done = false;
        const draw = async () => {
            if (done) return;
            done = true;
            const page = await pdf.getPage(n);
            const base = page.getViewport({ scale: 1 });
            await renderInto(page, 220 / base.width, canvas);
        };
        if (typeof IntersectionObserver === 'undefined') {
            void draw();
            return;
        }
        const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && void draw(), { rootMargin: '200px' });
        io.observe(canvas);
        return () => io.disconnect();
    }, [pdf, n]);
    return (
        <li>
            <button type="button" className={`pdf-thumb ${active ? 'is-on' : ''}`} onClick={onPick} aria-label={`Page ${n}`} aria-current={active ? 'page' : undefined}>
                <canvas ref={ref} />
                <span>{n}{count ? `, ${count} selected` : ''}</span>
            </button>
        </li>
    );
}

function PageView({ pdf, n, rects, onChange }: { pdf: PDFDocumentProxy; n: number; rects: Rect[]; onChange: (r: Rect[]) => void }) {
    const box = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const [scale, setScale] = useState(0);
    const [draft, setDraft] = useState<{ start: { x: number; y: number }; rect: Rect } | null>(null);

    useEffect(() => {
        let cancelled = false;
        const el = box.current;
        if (!el) return;
        const render = async () => {
            const page = await pdf.getPage(n);
            const base = page.getViewport({ scale: 1 });
            const s = Math.min(el.clientWidth / base.width, 1.6);
            if (cancelled || !canvas.current) return;
            const dpr = window.devicePixelRatio || 1;
            await renderInto(page, s * dpr, canvas.current);
            if (cancelled || !canvas.current) return;
            canvas.current.style.width = `${base.width * s}px`;
            canvas.current.style.height = `${base.height * s}px`;
            setScale(s);
        };
        void render();
        return () => {
            cancelled = true;
        };
    }, [pdf, n]);

    const toPdf = (e: ReactPointerEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
    };

    return (
        <div className="pdf-page" ref={box}>
            <div
                className="pdf-stage"
                onPointerDown={(e) => {
                    if (!scale || (e.target as HTMLElement).closest('button')) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    const p = toPdf(e);
                    setDraft({ start: p, rect: { x: p.x, y: p.y, w: 0, h: 0 } });
                }}
                onPointerMove={(e) => {
                    if (!draft) return;
                    const p = toPdf(e);
                    const s = draft.start;
                    setDraft({ start: s, rect: { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) } });
                }}
                onPointerUp={() => {
                    if (draft && draft.rect.w * scale > 6 && draft.rect.h * scale > 6) onChange([...rects, draft.rect]);
                    setDraft(null);
                }}
            >
                <canvas ref={canvas} />
                {[...rects, ...(draft ? [draft.rect] : [])].map((r, i) => (
                    <div key={i} className="pdf-rect" style={{ left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale }}>
                        {i < rects.length && (
                            <IconButton label="Remove this region" icon="close" size={14} onClick={() => onChange(rects.filter((_, j) => j !== i))} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function PdfImportDialog({ actions }: { actions: Actions }) {
    const store = useStore();
    const open = useEditor((s) => s.dialog === 'pdf-import');
    const dpi = useEditor((s) => s.pdfImportDpi);
    const [load, setLoad] = useState<Load>({ status: 'idle' });
    const [page, setPage] = useState(1);
    const [regions, setRegions] = useState<Record<number, Rect[]>>({});
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        const file = actions.pendingPdf;
        if (!file) {
            store.openDialog(null);
            return;
        }
        let destroy: (() => Promise<void>) | null = null;
        let cancelled = false;
        setLoad({ status: 'loading' });
        setPage(1);
        setRegions({});
        openPdf(file).then(
            (opened) => {
                destroy = opened.destroy;
                if (cancelled) void opened.destroy();
                else setLoad({ status: 'ready', pdf: opened.pdf, name: file.name });
            },
            (e: { name?: string }) => {
                if (cancelled) return;
                setLoad({
                    status: 'error',
                    message: e?.name === 'PasswordException'
                        ? 'This PDF is password protected. Remove the password and import it again.'
                        : 'This file could not be read as a PDF.',
                });
            },
        );
        return () => {
            cancelled = true;
            void destroy?.();
        };
    }, [open, actions, store]);

    const close = useCallback(() => {
        actions.pendingPdf = null;
        setLoad({ status: 'idle' });
        store.openDialog(null);
    }, [actions, store]);

    const total = Object.values(regions).reduce((a, r) => a + r.length, 0);

    const add = async (whole: boolean) => {
        if (load.status !== 'ready') return;
        setBusy(true);
        try {
            const jobs: Array<[number, Rect[]]> = whole ? [[page, []]] : Object.entries(regions).map(([k, v]) => [Number(k), v] as [number, Rect[]]).filter(([, v]) => v.length);
            let added = 0;
            for (const [n, rects] of jobs) {
                const p = await load.pdf.getPage(n);
                const base = p.getViewport({ scale: 1 });
                const canvas = document.createElement('canvas');
                await renderInto(p, dpi / 72, canvas);
                const png = await canvasToBytes(canvas);
                const list = whole ? [{ x: 0, y: 0, w: base.width, h: base.height }] : rects;
                await actions.addImageRegions(png, { width: canvas.width, height: canvas.height }, list, dpi);
                added += list.length;
            }
            close();
            store.toast(whole ? 'Added the page. Use Layout, then Auto-pack, to tidy the sheet.' : `Added ${added} region${added === 1 ? '' : 's'}. Use Layout, then Auto-pack, to tidy the sheet.`);
        } catch (e) {
            store.toast(`Could not add from the PDF: ${(e as Error).message}`, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={close}
            title={load.status === 'ready' ? `Import from ${load.name}` : 'Import from a PDF'}
            className="pdf-dialog"
            footer={load.status === 'ready' && (
                <>
                    <Segmented
                        label="Resolution"
                        value={dpi}
                        onChange={(v) => store.patch({ pdfImportDpi: v })}
                        options={[{ value: 150, label: '150 DPI' }, { value: 200, label: '200 DPI' }, { value: 300, label: '300 DPI' }]}
                    />
                    <span className="pdf-spacer" />
                    <Button onClick={() => void add(true)} disabled={busy}>Add whole page</Button>
                    <Button variant="primary" onClick={() => void add(false)} disabled={busy || total === 0}>
                        {total === 1 ? 'Add 1 region' : `Add ${total} regions`}
                    </Button>
                </>
            )}
        >
            {load.status === 'loading' && <p className="pdf-note">Opening the PDF.</p>}
            {load.status === 'error' && <p className="pdf-note pdf-error" role="alert">{load.message}</p>}
            {load.status === 'ready' && (
                <div className="pdf-layout">
                    <ol className="pdf-thumbs" aria-label="Pages">
                        {Array.from({ length: load.pdf.numPages }, (_, i) => (
                            <Thumb key={i} pdf={load.pdf} n={i + 1} active={page === i + 1} count={regions[i + 1]?.length ?? 0} onPick={() => setPage(i + 1)} />
                        ))}
                    </ol>
                    <div className="pdf-main">
                        <p className="pdf-hint">Drag boxes around the parts you want on your sheet. Each box becomes an image you can still re-crop later.</p>
                        <PageView pdf={load.pdf} n={page} rects={regions[page] ?? []} onChange={(r) => setRegions((all) => ({ ...all, [page]: r }))} />
                    </div>
                </div>
            )}
        </Dialog>
    );
}
