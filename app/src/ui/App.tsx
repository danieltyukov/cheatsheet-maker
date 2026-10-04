import { useCallback, useEffect, useRef, useState } from 'react';
import { createDocument } from '../model/factory';
import { importLegacyAutosave } from '../model/legacy';
import type { CheatDocument, Id } from '../model/types';
import { getPlatform, type Platform } from '../platform';
import { ensureFontsLoaded } from '../render/fonts';
import { createAutosaver, describeStorageError, type Autosaver } from '../storage/autosave';
import { MemoryLibrary, openLibrary, type LibraryApi } from '../storage/library';
import { Actions } from './actions';
import { EditorScreen } from './editor/EditorScreen';
import { EditorAssets } from './editorAssets';
import { LibraryScreen } from './library/LibraryScreen';
import { loadPrefs, pickPrefs, samePrefs, savePrefs, type Prefs } from './prefs';
import { EditorStore, StoreContext } from './store';
import { registerPwa } from '../pwa';
import { Toasts } from './components/Toasts';
import { syncTextHeights } from './syncTextHeights';
import { createSaveReporter } from './saveStatus';
import { renderThumbnail } from './thumbnail';
import { isDocumentFile, openDocumentFile } from './openFile';

interface Boot {
    library: LibraryApi;
    platform: Platform;
    persistent: boolean;
    reason?: string;
    prefs: Partial<Prefs>;
    legacy: string | null;
}

type Mode = { kind: 'loading' } | { kind: 'library' } | { kind: 'editor'; doc: CheatDocument; files?: File[] };

const fontsReady = ensureFontsLoaded();

/**
 * Opening the library and creating the very first document happen once per page load, even
 * when React mounts the app twice (StrictMode), or the first visit would get two documents.
 */
let startup: Promise<{ boot: Boot; doc: CheatDocument | null }> | null = null;

async function start(library: LibraryApi, persistent: boolean, reason: string | undefined, platform: Platform) {
    const prefs = await loadPrefs(library);
    const legacyText = await platform.readLegacyAutosave().catch(() => null);
    const legacy = legacyText && !(await library.getMeta<boolean>('legacyOffered')) ? legacyText : null;
    let doc: CheatDocument | null = null;
    const last = await library.getMeta<Id>('lastDoc');
    if (last) doc = await library.get(last);
    if (!doc && (await library.list()).length === 0) {
        doc = createDocument();
        await library.put(doc, null);
    }
    void library.gc().catch(() => undefined);
    return { boot: { library, platform, persistent, reason, prefs, legacy }, doc };
}

function startOnce() {
    startup ??= (async () => {
        const [{ library, persistent, reason }, platform] = await Promise.all([openLibrary(), getPlatform()]);
        try {
            return await start(library, persistent, reason, platform);
        } catch (e) {
            // Storage opened and then failed: carry on in memory, and say so.
            return start(new MemoryLibrary(), false, describeStorageError(e), platform);
        }
    })();
    return startup;
}

/** Tests mount the app repeatedly against fresh storage. */
export function resetStartupForTests() {
    startup = null;
}

interface HostProps {
    boot: Boot;
    doc: CheatDocument;
    files?: File[];
    onLeave: (next: () => void) => void;
    toLibrary: () => void;
    open: (doc: CheatDocument) => void;
    importLegacy: (onError: (message: string) => void) => void;
    exposeSaver: (s: Autosaver | null) => void;
}

function EditorHost({ boot, doc, files, toLibrary, open, importLegacy, exposeSaver, onLeave }: HostProps) {
    const [env] = useState(() => {
        const store = new EditorStore(doc, boot.prefs);
        // Assigned right after; the callbacks only run once something is drawn or has loaded.
        let assets: EditorAssets;
        let actions: Actions;
        assets = new EditorAssets(
            (id) => actions.getAsset(id),
            () => {
                syncTextHeights(store, (i) => assets.textHeight(i));
                store.bumpRender();
            },
        );
        actions = new Actions(store, assets, boot.library, boot.platform);
        return { store, assets, actions };
    });
    const { store, assets, actions } = env;

    useEffect(() => {
        if (import.meta.env.MODE === 'e2e') (window as unknown as { __cm: unknown }).__cm = { store, actions, assets };
    }, [store, actions, assets]);

    useEffect(() => {
        actions.onOpenDocument = (d) => onLeave(() => open(d));
    }, [actions, onLeave, open]);

    // Files dropped or picked on the library screen are imported once the editor exists.
    const imported = useRef(false);
    useEffect(() => {
        if (files?.length && !imported.current) {
            imported.current = true;
            void actions.importFiles(files);
        }
    }, [files, actions]);

    useEffect(() => {
        const { library } = boot;
        const report = createSaveReporter(store, boot.persistent, boot.reason);
        const saver = createAutosaver(async (d) => {
            await actions.flushAssets();
            await library.put(d, await renderThumbnail(d, assets));
        }, report);
        exposeSaver(saver);
        void library.setMeta('lastDoc', doc.id);

        let lastDoc = store.doc;
        let lastPrefs = pickPrefs(store.getState());
        let prefTimer: ReturnType<typeof setTimeout> | undefined;
        const unsubscribe = store.subscribe(() => {
            const st = store.getState();
            if (st.history.present !== lastDoc) {
                lastDoc = st.history.present;
                saver.schedule(lastDoc);
            }
            const p = pickPrefs(st);
            if (!samePrefs(p, lastPrefs)) {
                lastPrefs = p;
                clearTimeout(prefTimer);
                prefTimer = setTimeout(() => void savePrefs(library, p), 1000);
            }
        });

        void fontsReady.then(() => {
            assets.invalidateText();
            syncTextHeights(store, (i) => assets.textHeight(i));
            store.bumpRender();
        });

        if (boot.legacy) {
            store.toast('Found a cheatsheet from the old Linux app.', 'info', {
                label: 'Import it',
                run: () => importLegacy((message) => store.toast(message, 'error')),
            });
        }

        const flush = () => void saver.flush();
        const onHide = () => document.visibilityState === 'hidden' && flush();
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', flush);
        return () => {
            unsubscribe();
            clearTimeout(prefTimer);
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('pagehide', flush);
            flush();
            saver.dispose();
            exposeSaver(null);
        };
    }, [boot, doc.id, store, assets, actions, exposeSaver, importLegacy]);

    return (
        <StoreContext.Provider value={store}>
            <EditorScreen actions={actions} assets={assets} onOpenLibrary={() => onLeave(toLibrary)} />
        </StoreContext.Provider>
    );
}

export function App() {
    const [boot, setBoot] = useState<Boot | null>(null);
    const [mode, setMode] = useState<Mode>({ kind: 'loading' });
    const [libraryError, setLibraryError] = useState<string | null>(null);
    const [update, setUpdate] = useState<(() => void) | null>(null);
    const saver = useRef<Autosaver | null>(null);

    useEffect(() => {
        let cancelled = false;
        void startOnce().then(({ boot: b, doc }) => {
            if (cancelled) return;
            setBoot(b);
            setMode(doc ? { kind: 'editor', doc } : { kind: 'library' });
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => registerPwa((reload) => setUpdate(() => reload)), []);

    const exposeSaver = useCallback((s: Autosaver | null) => {
        saver.current = s;
    }, []);
    // Leaving a document waits for its last edits to reach storage.
    const onLeave = useCallback((next: () => void) => {
        const s = saver.current;
        if (s) void s.flush().finally(next);
        else next();
    }, []);
    const toLibrary = useCallback(() => setMode({ kind: 'library' }), []);
    const open = useCallback((doc: CheatDocument) => setMode({ kind: 'editor', doc }), []);

    const openById = useCallback(async (id: Id) => {
        if (!boot) return;
        const doc = await boot.library.get(id);
        if (doc) setMode({ kind: 'editor', doc });
    }, [boot]);

    const createNew = useCallback(async () => {
        if (!boot) return;
        const doc = createDocument();
        await boot.library.put(doc, null);
        setMode({ kind: 'editor', doc });
    }, [boot]);

    const dismissLegacy = useCallback(() => {
        if (!boot) return;
        void boot.library.setMeta('legacyOffered', true);
        setBoot({ ...boot, legacy: null });
    }, [boot]);

    const importLegacy = useCallback(async (onError: (message: string) => void) => {
        if (!boot?.legacy) return;
        try {
            const { doc, assets } = await importLegacyAutosave(boot.legacy, 'From the old Linux app');
            const stored = await boot.library.importDocument(doc, assets);
            await boot.library.setMeta('legacyOffered', true);
            setBoot({ ...boot, legacy: null });
            onLeave(() => setMode({ kind: 'editor', doc: stored }));
        } catch (e) {
            onError(`The old autosave could not be imported: ${(e as Error).message}`);
        }
    }, [boot, onLeave]);

    const importFromLibrary = useCallback(async (files: File[]) => {
        if (!boot) return;
        setLibraryError(null);
        let last: CheatDocument | null = null;
        const problems: string[] = [];
        for (const f of files.filter(isDocumentFile)) {
            try {
                last = await openDocumentFile(f, boot.library);
            } catch (e) {
                problems.push(`${f.name}: ${(e as Error).message}`);
            }
        }
        const media = files.filter((f) => !isDocumentFile(f));
        if (media.length) {
            // Images and PDFs start a new cheatsheet; the editor imports them (and reports what it cannot open).
            const doc = createDocument();
            await boot.library.put(doc, null);
            setMode({ kind: 'editor', doc, files: media });
        } else if (last) {
            setMode({ kind: 'editor', doc: last });
        }
        if (problems.length) setLibraryError(problems.join(' '));
    }, [boot]);

    // Chromium desktop hands over .cheatsheet files opened from the operating system.
    useEffect(() => {
        if (!boot) return;
        const lq = (window as unknown as { launchQueue?: { setConsumer(cb: (p: { files?: Array<{ getFile(): Promise<File> }> }) => void): void } }).launchQueue;
        lq?.setConsumer((p) => {
            if (p.files?.length) void Promise.all(p.files.map((f) => f.getFile())).then((files) => onLeave(() => void importFromLibrary(files)));
        });
    }, [boot, importFromLibrary, onLeave]);

    const updateToast = update && (
        <Toasts
            toasts={[{ id: -1, message: 'A new version of Cheatsheet Maker is ready.', kind: 'info', action: { label: 'Reload', run: update } }]}
            onDismiss={() => setUpdate(null)}
        />
    );

    if (!boot || mode.kind === 'loading') {
        return <div className="boot" aria-busy="true">Opening your cheatsheets</div>;
    }
    if (mode.kind === 'library') {
        return (
            <>
            {updateToast}
            <LibraryScreen
                library={boot.library}
                platform={boot.platform}
                onOpen={(id) => void openById(id)}
                onNew={() => void createNew()}
                onImport={(files) => void importFromLibrary(files)}
                legacyOffer={!!boot.legacy}
                onImportLegacy={() => void importLegacy(setLibraryError)}
                onDismissLegacy={dismissLegacy}
                storageWarning={boot.persistent ? undefined : boot.reason}
                error={libraryError}
            />
            </>
        );
    }
    return (
        <>
        {updateToast}
        <EditorHost
            key={mode.doc.id}
            boot={boot}
            doc={mode.doc}
            files={mode.files}
            onLeave={onLeave}
            toLibrary={toLibrary}
            open={open}
            importLegacy={(onError) => void importLegacy(onError)}
            exposeSaver={exposeSaver}
        />
        </>
    );
}
