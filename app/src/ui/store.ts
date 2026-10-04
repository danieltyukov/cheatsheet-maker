import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import { findItem } from '../model/commands';
import type { TextStyle } from '../model/factory';
import {
    amend, beginGesture, cancelGesture, commit, createHistory, endGesture, redo, undo, type History,
} from '../model/history';
import type { CheatDocument, Id } from '../model/types';
import type { SaveStatus } from '../storage/autosave';

export type Tool = 'select' | 'hand' | 'pen' | 'highlighter' | 'eraser' | 'text' | 'rect' | 'ellipse' | 'line' | 'arrow';

export interface ToolOptions {
    penColor: string;
    penSize: number;
    highlighterColor: string;
    highlighterSize: number;
    shapeStroke: string;
    shapeWidth: number;
    shapeFill: string | null;
    text: TextStyle;
}

export const DEFAULT_OPTIONS: ToolOptions = {
    penColor: '#1b1d22',
    penSize: 2,
    highlighterColor: '#ffd43b80',
    highlighterSize: 12,
    shapeStroke: '#1b1d22',
    shapeWidth: 1.5,
    shapeFill: null,
    text: { font: 'sans', fontSize: 9, color: '#1b1d22', background: null, align: 'left' },
};

export interface View {
    /** Screen pixels per point. */
    zoom: number;
    /** World coordinates (points) at the top-left of the viewport. */
    scrollX: number;
    scrollY: number;
}

export interface Toast {
    id: number;
    message: string;
    kind: 'info' | 'error';
    action?: { label: string; run: () => void };
}

export type DialogName = 'pdf-import' | 'shortcuts' | 'print-check' | null;

export interface EditorState {
    history: History;
    selection: Id[];
    tool: Tool;
    cropId: Id | null;
    editingTextId: Id | null;
    options: ToolOptions;
    view: View;
    currentPage: number;
    showGuides: boolean;
    packGap: number;
    exportDpi: number;
    pdfImportDpi: number;
    saveStatus: SaveStatus;
    toasts: Toast[];
    renderTick: number;
    snapGuides: { page: number; x: number | null; y: number | null } | null;
    dialog: DialogName;
}

type Listener = () => void;
let toastSeq = 0;

export class EditorStore {
    private state: EditorState;
    private listeners = new Set<Listener>();

    constructor(doc: CheatDocument, init: Partial<EditorState> = {}) {
        this.state = {
            history: createHistory(doc),
            selection: [],
            tool: 'select',
            cropId: null,
            editingTextId: null,
            options: DEFAULT_OPTIONS,
            view: { zoom: 1, scrollX: 0, scrollY: 0 },
            currentPage: 0,
            showGuides: true,
            packGap: 4,
            exportDpi: 300,
            pdfImportDpi: 200,
            saveStatus: { state: 'saved', at: doc.updatedAt },
            toasts: [],
            renderTick: 0,
            snapGuides: null,
            dialog: null,
            ...init,
        };
    }

    getState = (): EditorState => this.state;

    subscribe = (fn: Listener): (() => void) => {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    };

    get doc(): CheatDocument {
        return this.state.history.present;
    }

    private set(patch: Partial<EditorState>) {
        this.state = { ...this.state, ...patch };
        for (const l of this.listeners) l();
    }

    /** Keep selection, crop and editing ids pointing at items that exist. */
    private withHistory(history: History) {
        const doc = history.present;
        const exists = (id: Id | null) => (id && findItem(doc, id) ? id : null);
        const selection = this.state.selection.filter((id) => findItem(doc, id));
        const currentPage = Math.min(this.state.currentPage, doc.pages.length - 1);
        this.set({ history, selection, cropId: exists(this.state.cropId), editingTextId: exists(this.state.editingTextId), currentPage });
    }

    apply(fn: (doc: CheatDocument) => CheatDocument): void {
        const prev = this.doc;
        const next = fn(prev);
        if (next === prev) return;
        this.withHistory(commit(this.state.history, { ...next, updatedAt: Date.now() }));
    }

    amendDoc(fn: (doc: CheatDocument) => CheatDocument): void {
        const next = fn(this.doc);
        if (next !== this.doc) this.withHistory(amend(this.state.history, next));
    }

    beginGesture() { this.set({ history: beginGesture(this.state.history) }); }
    endGesture() { this.withHistory(endGesture(this.state.history)); this.set({ snapGuides: null }); }
    cancelGesture() { this.withHistory(cancelGesture(this.state.history)); this.set({ snapGuides: null }); }
    get gestureActive(): boolean { return this.state.history.gestureBase !== null; }

    undo() { this.withHistory(undo(this.state.history)); }
    redo() { this.withHistory(redo(this.state.history)); }

    replaceDocument(doc: CheatDocument) {
        this.set({ history: createHistory(doc), selection: [], cropId: null, editingTextId: null, currentPage: 0, snapGuides: null });
    }

    select(ids: Id[]) { this.set({ selection: ids, cropId: ids.length === 1 && ids[0] === this.state.cropId ? this.state.cropId : null }); }
    setTool(tool: Tool) { this.set({ tool, cropId: null, editingTextId: tool === 'select' ? this.state.editingTextId : null, selection: tool === 'select' ? this.state.selection : [] }); }
    setOptions(patch: Partial<ToolOptions>) { this.set({ options: { ...this.state.options, ...patch } }); }
    setView(view: View) { this.set({ view }); }
    setCurrentPage(i: number) { if (i !== this.state.currentPage) this.set({ currentPage: i }); }
    setCrop(id: Id | null) { this.set({ cropId: id, selection: id ? [id] : this.state.selection }); }
    setEditingText(id: Id | null) { this.set({ editingTextId: id, selection: id ? [id] : this.state.selection }); }
    setSaveStatus(saveStatus: SaveStatus) { this.set({ saveStatus }); }
    setSnapGuides(g: EditorState['snapGuides']) { this.set({ snapGuides: g }); }
    openDialog(dialog: DialogName) { this.set({ dialog }); }
    patch(p: Partial<Pick<EditorState, 'showGuides' | 'packGap' | 'exportDpi' | 'pdfImportDpi'>>) { this.set(p); }
    bumpRender() { this.set({ renderTick: this.state.renderTick + 1 }); }

    toast(message: string, kind: Toast['kind'] = 'info', action?: Toast['action']): number {
        const id = ++toastSeq;
        this.set({ toasts: [...this.state.toasts, { id, message, kind, action }] });
        return id;
    }
    dismissToast(id: number) { this.set({ toasts: this.state.toasts.filter((t) => t.id !== id) }); }
}

export const StoreContext = createContext<EditorStore | null>(null);

export function useStore(): EditorStore {
    const s = useContext(StoreContext);
    if (!s) throw new Error('useStore outside StoreContext');
    return s;
}

export function useEditor<T>(selector: (s: EditorState) => T): T {
    const store = useStore();
    const get = useCallback(() => selector(store.getState()), [store, selector]);
    return useSyncExternalStore(store.subscribe, get, get);
}
