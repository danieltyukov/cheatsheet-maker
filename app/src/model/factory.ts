import { newId } from './ids';
import type {
    AssetMeta, CheatDocument, FontKey, ImageFilters, ImageItem, Page, PageSetup, Point, Rect,
    ShapeItem, ShapeKind, StrokeItem, StrokeTool, TextAlign, TextItem,
} from './types';

export const DEFAULT_SETUP: PageSetup = {
    size: 'A4',
    orientation: 'portrait',
    margin: 18,
    columns: 1,
    gutter: 12,
    grid: 0,
};

export const DEFAULT_FILTERS: ImageFilters = { whiteToAlpha: 0, invert: false, grayscale: false, contrast: 1 };

/** Screen pixels to points at 96 DPI, so a screenshot lands at the size it had on screen. */
export const PX_TO_PT = 72 / 96;

export function createPage(): Page {
    return { id: newId(), items: [] };
}

export function createDocument(title = 'Untitled cheatsheet', now = Date.now()): CheatDocument {
    return {
        version: 1,
        id: newId(),
        title,
        createdAt: now,
        updatedAt: now,
        setup: { ...DEFAULT_SETUP },
        pages: [createPage()],
        assets: {},
    };
}

/** `pixelRatio` is the screen's device pixel ratio for screenshots, so they land at their on-screen size. */
export function createImageItem(asset: AssetMeta, center: Point, maxW: number, maxH: number, pixelRatio = 1): ImageItem {
    let w = (asset.width * PX_TO_PT) / pixelRatio;
    let h = (asset.height * PX_TO_PT) / pixelRatio;
    const fit = Math.min(1, maxW / w, maxH / h);
    w *= fit;
    h *= fit;
    return {
        id: newId(),
        kind: 'image',
        x: center.x - w / 2,
        y: center.y - h / 2,
        w,
        h,
        rotation: 0,
        assetId: asset.id,
        crop: { x: 0, y: 0, w: asset.width, h: asset.height },
        filters: { ...DEFAULT_FILTERS },
    };
}

export interface TextStyle {
    font: FontKey;
    fontSize: number;
    color: string;
    background: string | null;
    align: TextAlign;
}

export function createTextItem(at: Point, style: TextStyle, width: number, text = ''): TextItem {
    const padding = 4;
    return {
        id: newId(),
        kind: 'text',
        x: at.x,
        y: at.y,
        w: width,
        h: style.fontSize * 1.25 + padding * 2,
        rotation: 0,
        text,
        padding,
        ...style,
    };
}

export interface ShapeStyle {
    stroke: string;
    strokeWidth: number;
    fill: string | null;
}

export function createShapeItem(shape: ShapeKind, rect: Rect, style: ShapeStyle, flipX = false, flipY = false): ShapeItem {
    return { id: newId(), kind: 'shape', ...rect, rotation: 0, shape, flipX, flipY, ...style };
}

/** `absPoints` is flat [x, y, pressure, ...] in page coordinates. */
export function createStrokeItem(absPoints: number[], tool: StrokeTool, color: string, size: number): StrokeItem {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < absPoints.length; i += 3) {
        minX = Math.min(minX, absPoints[i]);
        maxX = Math.max(maxX, absPoints[i]);
        minY = Math.min(minY, absPoints[i + 1]);
        maxY = Math.max(maxY, absPoints[i + 1]);
    }
    const pad = size / 2;
    const x = minX - pad;
    const y = minY - pad;
    const points: number[] = [];
    for (let i = 0; i < absPoints.length; i += 3) {
        points.push(absPoints[i] - x, absPoints[i + 1] - y, absPoints[i + 2]);
    }
    return {
        id: newId(),
        kind: 'stroke',
        x,
        y,
        w: maxX - minX + size,
        h: maxY - minY + size,
        rotation: 0,
        tool,
        color,
        size,
        points,
    };
}
