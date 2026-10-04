import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { referencedAssetIds } from '../model/commands';
import type { AssetBytes } from '../model/format';
import { sha256Hex } from '../model/hash';
import { newId } from '../model/ids';
import type { CheatDocument, Id } from '../model/types';
import { describeStorageError } from './autosave';

export interface DocSummary {
    id: Id;
    title: string;
    updatedAt: number;
    pageCount: number;
    thumb: Blob | null;
}

export interface LibraryApi {
    list(): Promise<DocSummary[]>;
    get(id: Id): Promise<CheatDocument | null>;
    /** `thumb` undefined keeps the stored thumbnail. */
    put(doc: CheatDocument, thumb?: Blob | null): Promise<void>;
    remove(id: Id): Promise<void>;
    putAsset(bytes: Uint8Array, mime: string): Promise<Id>;
    getAsset(id: Id): Promise<Blob | null>;
    getAssetBytes(id: Id): Promise<Uint8Array | null>;
    /** Deletes assets no stored document references; returns how many. */
    gc(): Promise<number>;
    getMeta<T>(key: string): Promise<T | undefined>;
    setMeta(key: string, value: unknown): Promise<void>;
    /** Stores the assets and adds the document under a new id. */
    importDocument(doc: CheatDocument, assets: AssetBytes): Promise<CheatDocument>;
}

interface StoredDoc {
    id: Id;
    title: string;
    updatedAt: number;
    pageCount: number;
    doc: CheatDocument;
    thumb: { bytes: ArrayBuffer; mime: string } | null;
}
interface StoredAsset {
    id: Id;
    mime: string;
    bytes: ArrayBuffer;
}

interface Schema extends DBSchema {
    docs: { key: string; value: StoredDoc };
    assets: { key: string; value: StoredAsset };
    meta: { key: string; value: { key: string; value: unknown } };
}

const copyBuffer = (b: Uint8Array): ArrayBuffer => b.slice().buffer as ArrayBuffer;
const toBlob = (t: { bytes: ArrayBuffer; mime: string } | null) => (t ? new Blob([t.bytes], { type: t.mime }) : null);

function summary(s: StoredDoc): DocSummary {
    return { id: s.id, title: s.title, updatedAt: s.updatedAt, pageCount: s.pageCount, thumb: toBlob(s.thumb) };
}

async function stored(doc: CheatDocument, thumb: Blob | null | undefined, previous: StoredDoc | undefined): Promise<StoredDoc> {
    const t = thumb === undefined ? previous?.thumb ?? null : thumb ? { bytes: await thumb.arrayBuffer(), mime: thumb.type } : null;
    return { id: doc.id, title: doc.title, updatedAt: doc.updatedAt, pageCount: doc.pages.length, doc, thumb: t };
}

class IdbLibrary implements LibraryApi {
    constructor(private db: IDBPDatabase<Schema>) {}

    async list() {
        const all = await this.db.getAll('docs');
        return all.sort((a, b) => b.updatedAt - a.updatedAt).map(summary);
    }
    async get(id: Id) {
        return (await this.db.get('docs', id))?.doc ?? null;
    }
    async put(doc: CheatDocument, thumb?: Blob | null) {
        const prev = thumb === undefined ? await this.db.get('docs', doc.id) : undefined;
        await this.db.put('docs', await stored(doc, thumb, prev));
    }
    async remove(id: Id) {
        await this.db.delete('docs', id);
        await this.gc();
    }
    async putAsset(bytes: Uint8Array, mime: string) {
        const id = await sha256Hex(bytes);
        if (!(await this.db.getKey('assets', id))) await this.db.put('assets', { id, mime, bytes: copyBuffer(bytes) });
        return id;
    }
    async getAsset(id: Id) {
        const a = await this.db.get('assets', id);
        return a ? new Blob([a.bytes], { type: a.mime }) : null;
    }
    async getAssetBytes(id: Id) {
        const a = await this.db.get('assets', id);
        return a ? new Uint8Array(a.bytes) : null;
    }
    async gc() {
        const used = new Set<Id>();
        for (const d of await this.db.getAll('docs')) for (const id of referencedAssetIds(d.doc)) used.add(id);
        let removed = 0;
        for (const key of await this.db.getAllKeys('assets')) {
            if (!used.has(key)) {
                await this.db.delete('assets', key);
                removed++;
            }
        }
        return removed;
    }
    async getMeta<T>(key: string) {
        return (await this.db.get('meta', key))?.value as T | undefined;
    }
    async setMeta(key: string, value: unknown) {
        await this.db.put('meta', { key, value });
    }
    async importDocument(doc: CheatDocument, assets: AssetBytes) {
        for (const a of assets.values()) await this.putAsset(a.bytes, a.mime);
        const copy = { ...doc, id: newId(), updatedAt: Date.now() };
        await this.put(copy, null);
        return copy;
    }
}

export async function openIdbLibrary(name = 'cheatsheet-maker'): Promise<LibraryApi> {
    const db = await openDB<Schema>(name, 1, {
        upgrade(db) {
            db.createObjectStore('docs', { keyPath: 'id' });
            db.createObjectStore('assets', { keyPath: 'id' });
            db.createObjectStore('meta', { keyPath: 'key' });
        },
    });
    return new IdbLibrary(db);
}

/** Used when IndexedDB is unavailable: everything works until the tab closes. */
export class MemoryLibrary implements LibraryApi {
    private docs = new Map<Id, StoredDoc>();
    private assets = new Map<Id, StoredAsset>();
    private meta = new Map<string, unknown>();

    async list() {
        return [...this.docs.values()].sort((a, b) => b.updatedAt - a.updatedAt).map(summary);
    }
    async get(id: Id) {
        return this.docs.get(id)?.doc ?? null;
    }
    async put(doc: CheatDocument, thumb?: Blob | null) {
        this.docs.set(doc.id, await stored(doc, thumb, this.docs.get(doc.id)));
    }
    async remove(id: Id) {
        this.docs.delete(id);
        await this.gc();
    }
    async putAsset(bytes: Uint8Array, mime: string) {
        const id = await sha256Hex(bytes);
        if (!this.assets.has(id)) this.assets.set(id, { id, mime, bytes: copyBuffer(bytes) });
        return id;
    }
    async getAsset(id: Id) {
        const a = this.assets.get(id);
        return a ? new Blob([a.bytes], { type: a.mime }) : null;
    }
    async getAssetBytes(id: Id) {
        const a = this.assets.get(id);
        return a ? new Uint8Array(a.bytes) : null;
    }
    async gc() {
        const used = new Set<Id>();
        for (const d of this.docs.values()) for (const id of referencedAssetIds(d.doc)) used.add(id);
        let removed = 0;
        for (const id of [...this.assets.keys()]) {
            if (!used.has(id)) {
                this.assets.delete(id);
                removed++;
            }
        }
        return removed;
    }
    async getMeta<T>(key: string) {
        return this.meta.get(key) as T | undefined;
    }
    async setMeta(key: string, value: unknown) {
        this.meta.set(key, value);
    }
    async importDocument(doc: CheatDocument, assets: AssetBytes) {
        for (const a of assets.values()) await this.putAsset(a.bytes, a.mime);
        const copy = { ...doc, id: newId(), updatedAt: Date.now() };
        await this.put(copy, null);
        return copy;
    }
}

export async function openLibrary(): Promise<{ library: LibraryApi; persistent: boolean; reason?: string }> {
    try {
        const library = await openIdbLibrary();
        navigator.storage?.persist?.().catch(() => undefined);
        return { library, persistent: true };
    } catch (e) {
        return { library: new MemoryLibrary(), persistent: false, reason: describeStorageError(e) };
    }
}
