import { unpackCheatsheet } from '../model/format';
import { importLegacyAutosave } from '../model/legacy';
import type { CheatDocument } from '../model/types';
import { classifyFile } from '../platform/classify';
import type { LibraryApi } from '../storage/library';

export const isDocumentFile = (f: File) => {
    const k = classifyFile(f.name, f.type);
    return k === 'cheatsheet' || k === 'legacy-json';
};

/** Adds a .cheatsheet or old autosave file to the library as a new document. Throws FormatError on bad input. */
export async function openDocumentFile(file: File, library: LibraryApi): Promise<CheatDocument> {
    const { doc, assets } = classifyFile(file.name, file.type) === 'cheatsheet'
        ? unpackCheatsheet(new Uint8Array(await file.arrayBuffer()))
        : await importLegacyAutosave(await file.text(), file.name.replace(/\.json$/i, ''));
    return library.importDocument(doc, assets);
}
