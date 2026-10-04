import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import type { Platform, SaveKind } from './index';
import { pickFiles } from './web';

const FILTERS: Record<SaveKind, { name: string; extensions: string[] }> = {
    pdf: { name: 'PDF document', extensions: ['pdf'] },
    png: { name: 'PNG image', extensions: ['png'] },
    zip: { name: 'ZIP archive', extensions: ['zip'] },
    cheatsheet: { name: 'Cheatsheet Maker file', extensions: ['cheatsheet'] },
};

export const tauriPlatform: Platform = {
    kind: 'tauri',
    async saveFile(name, data, kind) {
        const path = await save({ defaultPath: name, filters: [FILTERS[kind]] });
        if (!path) return 'cancelled';
        await writeFile(path, new Uint8Array(await data.arrayBuffer()));
        return 'saved';
    },
    pickFiles,
    async readLegacyAutosave() {
        try {
            return await invoke<string | null>('legacy_autosave');
        } catch {
            return null;
        }
    },
};
