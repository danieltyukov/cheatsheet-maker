import { useCallback, useEffect, useState, type DragEvent } from 'react';
import { packCheatsheet, type AssetBytes } from '../../model/format';
import { referencedAssetIds } from '../../model/commands';
import type { Id } from '../../model/types';
import { ACCEPT } from '../../platform/classify';
import type { Platform } from '../../platform';
import { safeFileName } from '../../render/exportPng';
import type { DocSummary, LibraryApi } from '../../storage/library';
import { Button } from '../components/Button';
import { MenuButton } from '../components/Menu';
import { ThemeToggle } from '../components/ThemeToggle';
import './library.css';

interface Props {
    library: LibraryApi;
    platform: Platform;
    onOpen: (id: Id) => void;
    onNew: () => void;
    onImport: (files: File[]) => void;
    legacyOffer: boolean;
    onImportLegacy: () => void;
    onDismissLegacy: () => void;
    storageWarning?: string;
    error?: string | null;
}

const rtf = typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;

export function relativeTime(ms: number, now = Date.now()): string {
    const s = Math.round((ms - now) / 1000);
    const steps: Array<[number, Intl.RelativeTimeFormatUnit]> = [[60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year']];
    let v = s;
    for (const [size, unit] of steps) {
        if (Math.abs(v) < size) return rtf ? rtf.format(Math.round(v), unit) : new Date(ms).toLocaleDateString();
        v /= size;
    }
    return new Date(ms).toLocaleDateString();
}

function Card({ doc, library, platform, onOpen, refresh }: { doc: DocSummary; library: LibraryApi; platform: Platform; onOpen: (id: Id) => void; refresh: () => void }) {
    const [thumb, setThumb] = useState<string | null>(null);
    const [mode, setMode] = useState<'idle' | 'rename' | 'confirm'>('idle');
    const [name, setName] = useState(doc.title);

    useEffect(() => {
        if (!doc.thumb) return;
        const url = URL.createObjectURL(doc.thumb);
        setThumb(url);
        return () => URL.revokeObjectURL(url);
    }, [doc.thumb]);

    const rename = async () => {
        const full = await library.get(doc.id);
        const title = name.trim() || doc.title;
        if (full && title !== full.title) await library.put({ ...full, title, updatedAt: Date.now() });
        setMode('idle');
        refresh();
    };
    const duplicate = async () => {
        const full = await library.get(doc.id);
        if (full) await library.importDocument({ ...full, title: `${full.title} copy` }, new Map());
        refresh();
    };
    const exportFile = async () => {
        const full = await library.get(doc.id);
        if (!full) return;
        const assets: AssetBytes = new Map();
        for (const id of referencedAssetIds(full)) {
            const bytes = await library.getAssetBytes(id);
            if (bytes) assets.set(id, { bytes, mime: full.assets[id]?.mime ?? 'image/png' });
        }
        const zip = packCheatsheet(full, assets);
        await platform.saveFile(`${safeFileName(full.title)}.cheatsheet`, new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), 'cheatsheet');
    };
    const remove = async () => {
        await library.remove(doc.id);
        refresh();
    };

    return (
        <li className="doc-card">
            <button type="button" className="doc-open" onClick={() => onOpen(doc.id)} aria-label={`Open ${doc.title}`}>
                {thumb ? <img src={thumb} alt="" /> : <span className="doc-blank" />}
            </button>
            {mode === 'rename' ? (
                <input
                    className="doc-rename"
                    aria-label="New title"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => void rename()}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') void rename();
                        if (e.key === 'Escape') {
                            setName(doc.title);
                            setMode('idle');
                        }
                    }}
                />
            ) : (
                <div className="doc-meta">
                    <div className="doc-text">
                        <span className="doc-title">{doc.title}</span>
                        <span className="doc-sub">
                            Edited {relativeTime(doc.updatedAt)}, {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
                        </span>
                    </div>
                    <MenuButton
                        label={`Options for ${doc.title}`}
                        icon="more"
                        iconOnly
                        align="end"
                        items={[
                            { label: 'Open', onSelect: () => onOpen(doc.id) },
                            { label: 'Rename', onSelect: () => setMode('rename') },
                            { label: 'Duplicate', icon: 'duplicate', onSelect: () => void duplicate() },
                            { label: 'Save a .cheatsheet file', icon: 'file', onSelect: () => void exportFile() },
                            'separator',
                            { label: 'Delete', icon: 'trash', onSelect: () => setMode('confirm') },
                        ]}
                    />
                </div>
            )}
            {mode === 'confirm' && (
                <div className="doc-confirm" role="alertdialog" aria-label="Confirm delete">
                    <span>Delete this cheatsheet? This cannot be undone.</span>
                    <div>
                        <Button size="sm" variant="danger" onClick={() => void remove()}>Delete</Button>
                        <Button size="sm" variant="quiet" onClick={() => setMode('idle')}>Cancel</Button>
                    </div>
                </div>
            )}
        </li>
    );
}

export function LibraryScreen({ library, platform, onOpen, onNew, onImport, legacyOffer, onImportLegacy, onDismissLegacy, storageWarning, error }: Props) {
    const [docs, setDocs] = useState<DocSummary[] | null>(null);
    const [dropping, setDropping] = useState(false);
    const refresh = useCallback(() => {
        void library.list().then(setDocs);
    }, [library]);
    useEffect(refresh, [refresh]);

    const onDrop = (e: DragEvent) => {
        if (![...e.dataTransfer.types].includes('Files')) return;
        e.preventDefault();
        setDropping(false);
        onImport([...e.dataTransfer.files]);
    };

    return (
        <div
            className={`library ${dropping ? 'is-dropping' : ''}`}
            onDragOver={(e) => {
                if ([...e.dataTransfer.types].includes('Files')) {
                    e.preventDefault();
                    setDropping(true);
                }
            }}
            onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false);
            }}
            onDrop={onDrop}
        >
            <header className="library-head">
                <div className="brand">
                    <img src="./favicon.svg" alt="" width={36} height={36} />
                    <h1>Cheatsheet Maker</h1>
                </div>
                <div className="library-actions">
                    <ThemeToggle />
                    <Button icon="file" onClick={() => void platform.pickFiles(`${ACCEPT.documents},${ACCEPT.pdf},${ACCEPT.images}`, true).then(onImport)}>Open file</Button>
                    <Button variant="primary" icon="plus" onClick={onNew}>New cheatsheet</Button>
                </div>
            </header>
            <main className="library-main">
                {storageWarning && <p className="banner banner-warn" role="alert">{storageWarning} Your work stays open until you close this tab; save a .cheatsheet file to keep it.</p>}
                {error && <p className="banner banner-warn" role="alert">{error}</p>}
                {legacyOffer && (
                    <div className="banner">
                        <span>Found a cheatsheet from the old Linux app.</span>
                        <div>
                            <Button size="sm" variant="primary" onClick={onImportLegacy}>Import it</Button>
                            <Button size="sm" variant="quiet" onClick={onDismissLegacy}>Not now</Button>
                        </div>
                    </div>
                )}
                {docs && docs.length === 0 && (
                    <div className="empty">
                        <h2>No cheatsheets yet</h2>
                        <p>Start a new one, or open a .cheatsheet file someone sent you. You can also drop files here.</p>
                    </div>
                )}
                {docs && docs.length > 0 && (
                    <ul className="doc-grid" aria-label="Your cheatsheets">
                        {docs.map((d) => (
                            <Card key={d.id} doc={d} library={library} platform={platform} onOpen={onOpen} refresh={refresh} />
                        ))}
                    </ul>
                )}
            </main>
            {dropping && <div className="drop-hint">Drop to open</div>}
        </div>
    );
}
