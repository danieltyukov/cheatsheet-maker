// Writes the Playwright fixtures. Run once with `node app/e2e/make-fixtures.mjs`; the outputs are committed.
// locked.pdf (password "secret") was made from slides.pdf with pypdf: PdfWriter(clone_from=...).encrypt('secret').
import { copyFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const out = (name) => new URL(`./fixtures/${name}`, import.meta.url);

function crc32(buf) {
    let c, crc = 0xffffffff;
    for (const b of buf) {
        c = (crc ^ b) & 0xff;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
}

/** 600 x 400 RGB: a white border around a dark block, like a screenshot with margins. */
function photoPng() {
    const w = 600, h = 400;
    const rows = [];
    for (let y = 0; y < h; y++) {
        const row = Buffer.alloc(1 + w * 3);
        for (let x = 0; x < w; x++) {
            const inside = x >= 150 && x < 450 && y >= 100 && y < 300;
            const v = inside ? 30 : 255;
            row[1 + x * 3] = v;
            row[2 + x * 3] = inside ? 60 : 255;
            row[3 + x * 3] = inside ? 110 : 255;
        }
        rows.push(row);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(Buffer.concat(rows))),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

async function slidesPdf() {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const p1 = pdf.addPage([720, 405]);
    p1.drawText('Fourier transform', { x: 40, y: 340, size: 32, font });
    p1.drawRectangle({ x: 40, y: 60, width: 300, height: 220, color: rgb(0.1, 0.45, 0.8) });
    const p2 = pdf.addPage([720, 405]);
    p2.drawText('Page two', { x: 40, y: 340, size: 32, font });
    return pdf.save();
}

writeFileSync(out('photo.png'), photoPng());
writeFileSync(out('slides.pdf'), await slidesPdf());
copyFileSync(new URL('../src/test/fixtures/legacy-autosave.json', import.meta.url), out('legacy-autosave.json'));
console.log('fixtures written');
