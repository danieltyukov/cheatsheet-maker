export type FileKind = 'image' | 'pdf' | 'cheatsheet' | 'legacy-json' | 'unknown';

export const ACCEPT = {
    images: 'image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif',
    pdf: 'application/pdf,.pdf',
    documents: '.cheatsheet,.json,application/json',
    any: 'image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif,application/pdf,.pdf,.cheatsheet,.json',
};

export function classifyFile(name: string, mime: string): FileKind {
    const ext = name.toLowerCase().split('.').pop() ?? '';
    if (ext === 'cheatsheet') return 'cheatsheet';
    if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
    if (ext === 'json' || mime === 'application/json') return 'legacy-json';
    if (['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mime)) return 'image';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
    return 'unknown';
}
