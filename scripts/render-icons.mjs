// Renders every raster icon from app/icon-source.svg. Needs rsvg-convert (librsvg2-bin).
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const master = join(root, 'app/icon-source.svg');
const svg = readFileSync(master, 'utf8');

function png(src, size, out) {
    mkdirSync(dirname(out), { recursive: true });
    execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), src, '-o', out]);
}

// Maskable: the mark inside the 80% safe zone on a full-bleed yellow square.
const maskable = svg
    .replace('<rect width="1024" height="1024" rx="228" fill="#FFD43B"/>', '<rect width="1024" height="1024" fill="#FFD43B"/>')
    .replace(/<g transform="(rotate\([^)]*\))">/, '<g transform="translate(512 512) scale(0.8) translate(-512 -512) $1">');
if (maskable === svg) throw new Error('icon-source.svg changed shape; update the maskable rewrite');
const maskablePath = join(root, 'app/public/icons/maskable-source.svg');
mkdirSync(dirname(maskablePath), { recursive: true });
writeFileSync(maskablePath, maskable);

png(master, 192, join(root, 'app/public/icons/icon-192.png'));
png(master, 512, join(root, 'app/public/icons/icon-512.png'));
png(maskablePath, 512, join(root, 'app/public/icons/maskable-512.png'));
png(master, 180, join(root, 'app/public/icons/apple-touch-icon.png'));
png(master, 1024, join(root, 'app/src-tauri/icon-1024.png'));
copyFileSync(master, join(root, 'app/public/favicon.svg'));
console.log('Icons rendered. Next: cd app && npx tauri icon src-tauri/icon-1024.png');
