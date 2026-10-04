import {
    addAsset, addItems, addPage, cloneItems, duplicateItems, duplicatePage, findItem, movePage, removeItems,
    removePage, reorderItems, translateItems, updateItems, type ItemPatch, type Reorder,
} from '../model/commands';
import { createImageItem, createTextItem, DEFAULT_FILTERS } from '../model/factory';
import { FormatError, packCheatsheet, type AssetBytes } from '../model/format';
import { alignItems, distributeItems, packPage, type AlignMode, type PackMode } from '../model/layout';
import { pageDimensions, printableArea } from '../model/pageSizes';
import type { AssetMeta, CheatDocument, Id, ImageItem, Item, Point, Rect } from '../model/types';
import { classifyFile } from '../platform/classify';
import type { Platform } from '../platform';
import { exportPdf } from '../render/exportPdf';
import { exportPngs, safeFileName } from '../render/exportPng';
import { ensureFontsLoaded } from '../render/fonts';
import { findTrimRect } from '../render/filters';
import { browserPdfDeps } from '../render/rasterize';
import type { LibraryApi } from '../storage/library';
import { ACTUAL_SIZE, clampView, fitPage, fitWidth, pageTops, zoomAround } from './canvas/viewport';
import type { EditorAssets } from './editorAssets';
import { decodeImage } from './importImage';
import { openDocumentFile } from './openFile';
import type { Command } from './shortcuts';
import type { EditorStore } from './store';
import { zipSync } from 'fflate';

export type Drop = { page: number; point: Point };

const bytesBlob = (b: Uint8Array, type: string) => new Blob([b as Uint8Array<ArrayBuffer>], { type });

export class Actions {
    onOpenDocument: (doc: CheatDocument) => void = () => {};
    pendingPdf: File | null = null;
    viewport = { w: 1000, h: 800 };
    private clipboard: Item[] = [];
    private pasteCount = 0;

    constructor(readonly store: EditorStore, readonly assets: EditorAssets, readonly library: LibraryApi, readonly platform: Platform) {}

    private get doc() { return this.store.doc; }
    private get page() { return this.store.getState().currentPage; }
    private error(e: unknown) {
        this.store.toast(e instanceof Error ? e.message : String(e), 'error');
    }
    private selected(): Item[] {
        return this.store.getState().selection.map((id) => findItem(this.doc, id)?.item).filter((i): i is Item => !!i);
    }
    private unlockedSelection(): Id[] {
        return this.selected().filter((i) => !i.locked).map((i) => i.id);
    }
    private centre(at?: Drop): { page: number; point: Point } {
        if (at) return at;
        const { w, h } = pageDimensions(this.doc.setup);
        return { page: this.page, point: { x: w / 2, y: h / 2 } };
    }

    // Import

    async importFiles(files: File[], at?: Drop): Promise<void> {
        const images: File[] = [];
        for (const f of files) {
            const kind = classifyFile(f.name, f.type);
            try {
                if (kind === 'image') images.push(f);
                else if (kind === 'pdf') {
                    this.pendingPdf = f;
                    this.store.openDialog('pdf-import');
                } else if (kind === 'cheatsheet' || kind === 'legacy-json') {
                    const stored = await openDocumentFile(f, this.library);
                    this.onOpenDocument(stored);
                    this.store.toast(`Opened "${stored.title}".`);
                } else {
                    this.store.toast(`${f.name} is not something Cheatsheet Maker can open.`, 'error');
                }
            } catch (e) {
                this.error(e instanceof FormatError ? e : new Error(`${f.name}: ${(e as Error).message}`));
            }
        }
        if (images.length) await this.importImages(images, at);
    }

    async importImages(blobs: Blob[], at?: Drop): Promise<void> {
        const { page, point } = this.centre(at);
        const area = printableArea(this.doc.setup);
        const items: ImageItem[] = [];
        const metas: AssetMeta[] = [];
        for (const [n, blob] of blobs.entries()) {
            try {
                const img = await decodeImage(blob);
                const id = await this.library.putAsset(img.bytes, img.mime);
                this.assets.images.prime(id, img.bitmap);
                const meta = { id, mime: img.mime, width: img.width, height: img.height };
                metas.push(meta);
                // Screenshots arrive at device pixels; place them at their on-screen size, and no wider than
                // 60% of the printable area so a paste never swamps the sheet.
                const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
                items.push(createImageItem(meta, { x: point.x + n * 16, y: point.y + n * 16 }, area.w * 0.6, area.h * 0.6, dpr));
            } catch (e) {
                this.error(e);
            }
        }
        if (!items.length) return;
        const ids = items.map((i) => i.id);
        // Several images at once are laid out side by side instead of in a pile.
        this.store.apply((d) => {
            const added = addItems(metas.reduce(addAsset, d), page, items);
            return items.length > 1 ? packPage(added, page, ids, 'arrange', this.store.getState().packGap) : added;
        });
        this.store.setTool('select');
        this.store.select(ids);
    }

    /** Regions are in PDF points on a page rasterised at `dpi`; the raster is stored once. */
    async addImageRegions(pagePng: Uint8Array, pixelSize: { width: number; height: number }, regions: Rect[], dpi: number): Promise<void> {
        const id = await this.library.putAsset(pagePng, 'image/png');
        const meta = { id, mime: 'image/png', ...pixelSize };
        const area = printableArea(this.doc.setup);
        const { point } = this.centre();
        const s = dpi / 72;
        const items: ImageItem[] = regions.map((r, n) => {
            const fit = Math.min(1, area.w / r.w, area.h / r.h);
            const w = r.w * fit, h = r.h * fit;
            return {
                ...createImageItem(meta, point, area.w, area.h),
                x: point.x - w / 2 + n * 16,
                y: point.y - h / 2 + n * 16,
                w,
                h,
                crop: { x: Math.round(r.x * s), y: Math.round(r.y * s), w: Math.max(1, Math.round(r.w * s)), h: Math.max(1, Math.round(r.h * s)) },
                filters: { ...DEFAULT_FILTERS },
            };
        });
        this.store.apply((d) => addItems(addAsset(d, meta), this.page, items));
        this.store.setTool('select');
        this.store.select(items.map((i) => i.id));
    }

    pasteText(text: string, at?: Drop): void {
        const { page, point } = this.centre(at);
        const area = printableArea(this.doc.setup);
        const width = Math.min(240, area.w);
        const t = createTextItem({ x: 0, y: 0 }, this.store.getState().options.text, width, text.trim());
        const h = this.assets.textHeight(t);
        const x = Math.max(area.x, Math.min(point.x - width / 2, area.x + area.w - width));
        this.store.apply((d) => addItems(d, page, [{ ...t, x, y: Math.max(area.y, point.y - h / 2), h }]));
        this.store.select([t.id]);
    }

    async pasteFromClipboard(): Promise<void> {
        if (this.clipboard.length) return this.paste();
        try {
            const items = await navigator.clipboard.read();
            const blobs: Blob[] = [];
            for (const item of items) {
                const type = item.types.find((t) => t.startsWith('image/'));
                if (type) blobs.push(await item.getType(type));
                else if (item.types.includes('text/plain')) {
                    const text = await (await item.getType('text/plain')).text();
                    if (text.trim()) this.pasteText(text);
                }
            }
            if (blobs.length) await this.importImages(blobs);
        } catch {
            this.store.toast('The browser blocked clipboard access. Press Ctrl+V (Cmd+V on a Mac) to paste instead.');
        }
    }

    // Clipboard (items inside the app)

    hasClipboard() { return this.clipboard.length > 0; }
    copy() {
        this.clipboard = this.selected();
        this.pasteCount = 0;
    }
    cut() {
        this.copy();
        this.deleteSelection();
        this.pasteCount = -1;
    }
    paste() {
        if (!this.clipboard.length) return;
        this.pasteCount++;
        const copies = cloneItems(this.clipboard, 12 * this.pasteCount);
        this.store.apply((d) => addItems(d, this.page, copies));
        this.store.select(copies.map((i) => i.id));
    }

    // Editing

    deleteSelection() {
        const ids = this.unlockedSelection();
        if (ids.length) this.store.apply((d) => removeItems(d, ids));
    }
    duplicateSelection() {
        const ids = this.unlockedSelection();
        if (!ids.length) return;
        let created: Id[] = [];
        this.store.apply((d) => {
            const r = duplicateItems(d, ids);
            created = r.ids;
            return r.doc;
        });
        this.store.select(created);
    }
    nudge(dx: number, dy: number) {
        const ids = this.unlockedSelection();
        if (ids.length) this.store.apply((d) => translateItems(d, ids, dx, dy));
    }
    selectAll() {
        this.store.setTool('select');
        this.store.select(this.doc.pages[this.page].items.map((i) => i.id));
    }
    reorder(how: Reorder) {
        const ids = this.store.getState().selection;
        if (ids.length) this.store.apply((d) => reorderItems(d, ids, how));
    }
    align(mode: AlignMode) { this.store.apply((d) => alignItems(d, this.store.getState().selection, mode)); }
    distribute(axis: 'h' | 'v') { this.store.apply((d) => distributeItems(d, this.store.getState().selection, axis)); }
    pack(mode: PackMode) {
        const sel = this.store.getState().selection;
        const before = this.doc.pages.length;
        this.store.apply((d) => packPage(d, this.page, sel.length > 1 ? sel : null, mode, this.store.getState().packGap));
        const added = this.doc.pages.length - before;
        if (added > 0) this.store.toast(`Everything did not fit, so ${added} new page${added > 1 ? 's were' : ' was'} added after this one.`);
    }
    toggleLock() {
        const items = this.selected();
        if (!items.length) return;
        const lock = !items.every((i) => i.locked);
        const patches: Record<Id, ItemPatch> = {};
        for (const i of items) patches[i.id] = { locked: lock };
        this.store.apply((d) => updateItems(d, patches));
    }
    trimSelected() {
        const patches: Record<Id, ItemPatch> = {};
        for (const item of this.selected()) {
            if (item.kind !== 'image' || item.locked) continue;
            const src = this.assets.images.rgba(item.assetId);
            if (!src) continue;
            // Trim inside the current crop only.
            const { x, y, w, h } = item.crop;
            const data = new Uint8ClampedArray(w * h * 4);
            for (let row = 0; row < h; row++) data.set(src.data.subarray(((y + row) * src.width + x) * 4, ((y + row) * src.width + x + w) * 4), row * w * 4);
            const r = findTrimRect({ data, width: w, height: h });
            if (!r || (r.w === w && r.h === h)) continue;
            const sx = item.w / w, sy = item.h / h;
            patches[item.id] = { crop: { x: x + r.x, y: y + r.y, w: r.w, h: r.h }, w: r.w * sx, h: r.h * sy, x: item.x + r.x * sx, y: item.y + r.y * sy };
        }
        if (Object.keys(patches).length) this.store.apply((d) => updateItems(d, patches));
        else this.store.toast('Nothing to trim: the image has no plain border.');
    }
    resetFilters() {
        const patches: Record<Id, ItemPatch> = {};
        for (const i of this.selected()) if (i.kind === 'image') patches[i.id] = { filters: { ...DEFAULT_FILTERS } };
        this.store.apply((d) => updateItems(d, patches));
    }

    // Pages

    addPage() {
        const at = this.page + 1;
        this.store.apply((d) => addPage(d, at));
        this.goToPage(at);
    }
    duplicatePage(i: number) { this.store.apply((d) => duplicatePage(d, i)); this.goToPage(i + 1); }
    removePage(i: number) {
        if (this.doc.pages.length <= 1) return;
        this.store.apply((d) => removePage(d, i));
        this.goToPage(Math.min(i, this.doc.pages.length - 1));
    }
    movePage(from: number, to: number) { this.store.apply((d) => movePage(d, from, to)); this.goToPage(to); }
    goToPage(i: number) {
        const v = this.store.getState().view;
        this.store.setCurrentPage(i);
        this.store.setView({ ...v, scrollY: pageTops(this.doc.setup, this.doc.pages.length)[i] - 16 / v.zoom });
    }

    // View

    private setView(v: ReturnType<typeof fitWidth>) {
        this.store.setView(clampView(v, this.doc.setup, this.doc.pages.length, this.viewport.w, this.viewport.h));
    }
    zoomBy(f: number) { this.setView(zoomAround(this.store.getState().view, f, { x: this.viewport.w / 2, y: this.viewport.h / 2 })); }
    zoomActual() { this.zoomBy(ACTUAL_SIZE / this.store.getState().view.zoom); }
    zoomFit() { this.setView(fitPage(this.doc.setup, this.viewport.w, this.viewport.h, this.page)); }
    zoomFitWidth() { this.setView(fitWidth(this.doc.setup, this.viewport.w, this.page)); }

    // Export

    private async ready() {
        await ensureFontsLoaded();
        this.assets.invalidateText();
        const ids = new Set<Id>();
        for (const p of this.doc.pages) for (const i of p.items) if (i.kind === 'image') ids.add(i.assetId);
        await this.assets.images.ensure(ids);
        // Laying out every text box queues its formulas; wait for them and their images.
        for (const p of this.doc.pages) for (const i of p.items) if (i.kind === 'text') {
            const layout = this.assets.textLayout(i);
            for (const r of layout.runs) if (r.kind === 'math') this.assets.math(r.tex, r.display, i.color);
        }
        await this.assets.maths.whenIdle();
        for (const p of this.doc.pages) for (const i of p.items) if (i.kind === 'text') {
            for (const r of this.assets.textLayout(i).runs) if (r.kind === 'math') this.assets.math(r.tex, r.display, i.color);
        }
        await this.assets.maths.whenIdle();
    }

    async exportPdf(pages?: number[]) {
        try {
            await this.ready();
            const bytes = await exportPdf(this.doc, browserPdfDeps(this.assets, (id) => this.doc.assets[id]?.mime ?? 'image/png'), { dpi: this.store.getState().exportDpi, pages });
            const res = await this.platform.saveFile(`${safeFileName(this.doc.title)}.pdf`, bytesBlob(bytes, 'application/pdf'), 'pdf');
            if (res === 'saved') this.store.toast('PDF exported.');
        } catch (e) {
            this.error(e);
        }
    }

    async exportPng(pages?: number[]) {
        try {
            await this.ready();
            const list = pages ?? [this.page];
            const files = await exportPngs(this.doc, list, this.store.getState().exportDpi, this.assets);
            if (files.length === 1) {
                await this.platform.saveFile(files[0].name, files[0].blob, 'png');
            } else {
                const entries: Record<string, Uint8Array> = {};
                for (const f of files) entries[f.name] = new Uint8Array(await f.blob.arrayBuffer());
                await this.platform.saveFile(`${safeFileName(this.doc.title)} pages.zip`, bytesBlob(zipSync(entries, { level: 0 }), 'application/zip'), 'zip');
            }
        } catch (e) {
            this.error(e);
        }
    }

    async saveCheatsheet() {
        try {
            const assets: AssetBytes = new Map();
            for (const p of this.doc.pages) for (const i of p.items) {
                if (i.kind !== 'image' || assets.has(i.assetId)) continue;
                const bytes = await this.library.getAssetBytes(i.assetId);
                if (bytes) assets.set(i.assetId, { bytes, mime: this.doc.assets[i.assetId]?.mime ?? 'image/png' });
            }
            const zip = packCheatsheet(this.doc, assets);
            await this.platform.saveFile(`${safeFileName(this.doc.title)}.cheatsheet`, bytesBlob(zip, 'application/zip'), 'cheatsheet');
        } catch (e) {
            this.error(e);
        }
    }

    // Commands from shortcuts and menus

    run(c: Command) {
        const st = this.store.getState();
        if (c.kind === 'tool') return this.store.setTool(c.tool);
        if (c.kind === 'nudge') return this.nudge(c.dx, c.dy);
        switch (c.name) {
            case 'undo': return this.store.undo();
            case 'redo': return this.store.redo();
            case 'duplicate': return this.duplicateSelection();
            case 'delete': return this.deleteSelection();
            case 'selectAll': return this.selectAll();
            case 'forward': return this.reorder('forward');
            case 'backward': return this.reorder('backward');
            case 'toFront': return this.reorder('front');
            case 'toBack': return this.reorder('back');
            case 'exportPdf': return void this.exportPdf();
            case 'exportPng': return void this.exportPng();
            case 'importImage': return void this.platform.pickFiles('image/*', true).then((f) => this.importFiles(f));
            case 'importPdf': return void this.platform.pickFiles('application/pdf,.pdf', false).then((f) => this.importFiles(f));
            case 'saveFile': return void this.saveCheatsheet();
            case 'zoomIn': return this.zoomBy(1.2);
            case 'zoomOut': return this.zoomBy(1 / 1.2);
            case 'zoomReset': return this.zoomActual();
            case 'zoomFit': return this.zoomFit();
            case 'addPage': return this.addPage();
            case 'shortcuts': return this.store.openDialog('shortcuts');
            case 'crop': {
                const one = st.selection.length === 1 ? findItem(this.doc, st.selection[0])?.item : null;
                if (one?.kind === 'image' && !one.locked) this.store.setCrop(st.cropId ? null : one.id);
                return;
            }
            case 'escape':
                if (st.dialog) return this.store.openDialog(null);
                if (st.cropId) return this.store.setCrop(null);
                if (st.tool !== 'select') return this.store.setTool('select');
                return this.store.select([]);
        }
    }
}
