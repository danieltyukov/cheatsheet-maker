import { useEffect, useRef, type ReactNode } from 'react';
import { pageDimensions } from '../../model/pageSizes';
import { drawPage } from '../../render/drawPage';
import type { EditorAssets } from '../editorAssets';
import { isEditableTarget } from '../shortcuts';
import { useStore, type View } from '../store';
import { GestureController, type PointerInfo } from './gestures';
import { drawOverlay } from './overlay';
import { clampView, fitWidth, pageAt, pageTops, toScreen, toWorld, visiblePages, zoomAround } from './viewport';
import './canvas.css';

interface Props {
    assets: EditorAssets;
    /** Reports the canvas size in CSS pixels whenever it changes. */
    onResize?: (w: number, h: number) => void;
    /** Rendered over the canvas inside the same positioned box (the text editor). */
    children?: ReactNode;
}

const GRID_PT = 18;

function css(el: Element, name: string, fallback: string): string {
    return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

export function CanvasView({ assets, onResize, children }: Props) {
    const store = useStore();
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const size = useRef({ w: 0, h: 0 });
    const frame = useRef(0);
    const scheduleRef = useRef<() => void>(() => {});
    const ctrlRef = useRef<GestureController | null>(null);
    if (!ctrlRef.current) ctrlRef.current = new GestureController(store, assets, () => size.current, () => scheduleRef.current());
    const ctrl = ctrlRef.current;

    useEffect(() => {
        const canvas = canvasRef.current!;
        const wrap = wrapRef.current!;
        const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

        const draw = () => {
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const dpr = window.devicePixelRatio || 1;
            const { w, h } = size.current;
            const st = store.getState();
            const doc = st.history.present;
            const v = st.view;
            const bg = css(wrap, '--canvas-bg', '#e4e8ed');
            const dot = css(wrap, '--canvas-dot', '#c9d0d9');
            const shadow = css(wrap, '--page-shadow', 'rgba(21, 24, 30, 0.18)');
            const ink = css(wrap, '--ink', '#15181e');

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);

            // Graph paper: dots every 18 pt, thinned out when zoomed far out.
            let step = GRID_PT * v.zoom;
            while (step < 10) step *= 2;
            const ox = ((-v.scrollX * v.zoom) % step + step) % step;
            const oy = ((-v.scrollY * v.zoom) % step + step) % step;
            ctx.fillStyle = dot;
            for (let y = oy; y < h; y += step) for (let x = ox; x < w; x += step) ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);

            const { w: pw, h: ph } = pageDimensions(doc.setup);
            const tops = pageTops(doc.setup, doc.pages.length);
            const hidden = st.editingTextId ? new Set([st.editingTextId]) : undefined;
            for (const i of visiblePages(doc.setup, doc.pages.length, v, w, h)) {
                const o = toScreen(v, { x: 0, y: tops[i] });
                ctx.save();
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.shadowColor = shadow;
                ctx.shadowBlur = 14 * dpr;
                ctx.shadowOffsetY = 2 * dpr;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(o.x, o.y, pw * v.zoom, ph * v.zoom);
                ctx.restore();

                ctx.save();
                ctx.setTransform(dpr * v.zoom, 0, 0, dpr * v.zoom, dpr * o.x, dpr * o.y);
                // Anything hanging off the page is shown faintly: it will not print.
                ctx.globalAlpha = 0.3;
                drawPage(ctx, doc.pages[i], doc.setup, assets, { background: null, hidden });
                ctx.globalAlpha = 1;
                ctx.beginPath();
                ctx.rect(0, 0, pw, ph);
                ctx.clip();
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, pw, ph);
                drawPage(ctx, doc.pages[i], doc.setup, assets, { background: null, guides: st.showGuides, hidden });
                ctx.restore();
            }
            drawOverlay(ctx, { state: st, doc, ctrl, assets, dpr, coarse, ink });
            canvas.style.cursor = ctrl.cursor;
        };

        scheduleRef.current = () => {
            if (frame.current) return;
            frame.current = requestAnimationFrame(() => {
                frame.current = 0;
                draw();
            });
        };

        let lastView: View | null = null;
        const unsubscribe = store.subscribe(() => {
            const st = store.getState();
            if (st.view !== lastView) {
                lastView = st.view;
                const doc = st.history.present;
                const centre = toWorld(st.view, { x: size.current.w / 2, y: size.current.h / 2 });
                store.setCurrentPage(pageAt(doc.setup, doc.pages.length, centre).index);
            }
            scheduleRef.current();
        });

        const ro = new ResizeObserver(() => {
            const r = wrap.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const first = size.current.w === 0;
            size.current = { w: r.width, h: r.height };
            canvas.width = Math.max(1, Math.round(r.width * dpr));
            canvas.height = Math.max(1, Math.round(r.height * dpr));
            onResize?.(r.width, r.height);
            const st = store.getState();
            const v = st.view;
            if (first && r.width > 0 && v.zoom === 1 && v.scrollX === 0 && v.scrollY === 0) {
                store.setView(fitWidth(st.history.present.setup, r.width, st.currentPage));
            }
            scheduleRef.current();
        });
        ro.observe(wrap);

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const st = store.getState();
            const doc = st.history.present;
            const r = canvas.getBoundingClientRect();
            const p = { x: e.clientX - r.left, y: e.clientY - r.top };
            const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? size.current.h : 1;
            let next: View;
            if (e.ctrlKey || e.metaKey) next = zoomAround(st.view, Math.exp(-e.deltaY * scale * 0.0025), p);
            else {
                const dx = (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * scale;
                const dy = (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * scale;
                next = { ...st.view, scrollX: st.view.scrollX + dx / st.view.zoom, scrollY: st.view.scrollY + dy / st.view.zoom };
            }
            store.setView(clampView(next, doc.setup, doc.pages.length, size.current.w, size.current.h));
        };
        canvas.addEventListener('wheel', onWheel, { passive: false });

        const key = (down: boolean) => (e: KeyboardEvent) => {
            if (e.code !== 'Space' || isEditableTarget(e.target)) return;
            if (down) e.preventDefault();
            if (ctrl.spaceHeld === down) return;
            ctrl.spaceHeld = down;
            ctrl.cursor = down ? 'grab' : 'default';
            scheduleRef.current();
        };
        const kd = key(true), ku = key(false);
        window.addEventListener('keydown', kd);
        window.addEventListener('keyup', ku);

        scheduleRef.current();
        return () => {
            unsubscribe();
            ro.disconnect();
            canvas.removeEventListener('wheel', onWheel);
            window.removeEventListener('keydown', kd);
            window.removeEventListener('keyup', ku);
            cancelAnimationFrame(frame.current);
            frame.current = 0;
        };
    }, [store, assets, ctrl, onResize]);

    const info = (e: React.PointerEvent<HTMLCanvasElement>): PointerInfo => {
        const r = e.currentTarget.getBoundingClientRect();
        return {
            id: e.pointerId,
            x: e.clientX - r.left,
            y: e.clientY - r.top,
            button: e.button,
            pointerType: e.pointerType,
            pressure: e.pressure || 0.5,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
        };
    };

    return (
        <div className="canvas-wrap" ref={wrapRef} tabIndex={-1}>
            <canvas
                ref={canvasRef}
                role="img"
                aria-label="Cheatsheet pages"
                onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    wrapRef.current?.focus({ preventScroll: true });
                    ctrl.down(info(e));
                }}
                onPointerMove={(e) => ctrl.move(info(e))}
                onPointerUp={(e) => ctrl.up(info(e))}
                onPointerCancel={() => ctrl.cancel()}
                onPointerLeave={(e) => {
                    if (e.buttons === 0 && ctrl.hover) {
                        ctrl.hover = null;
                        scheduleRef.current();
                    }
                }}
                onDoubleClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    ctrl.doubleClick({ x: e.clientX - r.left, y: e.clientY - r.top });
                }}
                onContextMenu={(e) => e.preventDefault()}
            />
            {children}
        </div>
    );
}
