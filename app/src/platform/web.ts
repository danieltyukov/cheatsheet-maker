import type { Platform, SaveKind } from './index';

const TYPES: Record<SaveKind, { description: string; accept: Record<string, string[]> }> = {
    pdf: { description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } },
    png: { description: 'PNG image', accept: { 'image/png': ['.png'] } },
    zip: { description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } },
    cheatsheet: { description: 'Cheatsheet Maker file', accept: { 'application/zip': ['.cheatsheet'] } },
};

type SavePicker = (o: unknown) => Promise<{ createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }> }>;

export function pickFiles(accept: string, multiple: boolean, capture = false): Promise<File[]> {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.multiple = multiple;
        if (capture) input.setAttribute('capture', 'environment');
        input.style.display = 'none';
        document.body.append(input);
        const done = (files: File[]) => {
            input.remove();
            resolve(files);
        };
        input.addEventListener('change', () => done([...(input.files ?? [])]), { once: true });
        input.addEventListener('cancel', () => done([]), { once: true });
        input.click();
    });
}

export const webPlatform: Platform = {
    kind: 'web',
    async saveFile(name, data, kind) {
        const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
        if (picker) {
            try {
                const handle = await picker({ suggestedName: name, types: [TYPES[kind]] });
                const w = await handle.createWritable();
                await w.write(data);
                await w.close();
                return 'saved';
            } catch (e) {
                if ((e as Error).name === 'AbortError') return 'cancelled';
                // Fall through to a plain download if the picker is blocked.
            }
        }
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        return 'saved';
    },
    pickFiles,
    async readLegacyAutosave() {
        return null;
    },
};
