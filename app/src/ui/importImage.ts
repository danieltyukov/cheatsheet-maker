import { downscaleSize, sniffImageMime } from '../model/imageSize';
import { canvasToBytes, createCanvas } from '../render/rasterize';

export interface DecodedImage {
    bytes: Uint8Array;
    mime: string;
    width: number;
    height: number;
    bitmap: ImageBitmap;
}

export function chooseEncoding(mime: string, scaled: boolean): 'keep' | 'png' | 'jpeg' {
    if (!scaled && ['image/png', 'image/jpeg', 'image/webp'].includes(mime)) return 'keep';
    return mime === 'image/jpeg' ? 'jpeg' : 'png';
}

export async function decodeImage(blob: Blob): Promise<DecodedImage> {
    const original = new Uint8Array(await blob.arrayBuffer());
    const mime = sniffImageMime(original) ?? blob.type;
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(blob);
    } catch {
        throw new Error('This image format is not supported. Use PNG, JPEG, WebP or GIF.');
    }
    const size = downscaleSize(bitmap.width, bitmap.height);
    const enc = chooseEncoding(mime, size.scale < 1);
    if (enc === 'keep') return { bytes: original, mime, width: bitmap.width, height: bitmap.height, bitmap };
    const c = createCanvas(size.width, size.height);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    const outMime = enc === 'jpeg' ? 'image/jpeg' : 'image/png';
    const bytes = await canvasToBytes(c, outMime, enc === 'jpeg' ? 0.92 : undefined);
    return { bytes, mime: outMime, width: size.width, height: size.height, bitmap: await createImageBitmap(c) };
}
