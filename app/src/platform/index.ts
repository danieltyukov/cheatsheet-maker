export type SaveKind = 'pdf' | 'png' | 'zip' | 'cheatsheet';

export interface Platform {
    kind: 'web' | 'tauri';
    saveFile(name: string, data: Blob, kind: SaveKind): Promise<'saved' | 'cancelled'>;
    pickFiles(accept: string, multiple: boolean, capture?: boolean): Promise<File[]>;
    readLegacyAutosave(): Promise<string | null>;
}

export function isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

let cached: Promise<Platform> | null = null;

export function getPlatform(): Promise<Platform> {
    cached ??= isTauri() ? import('./tauri').then((m) => m.tauriPlatform) : import('./web').then((m) => m.webPlatform);
    return cached;
}
