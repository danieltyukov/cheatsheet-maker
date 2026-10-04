export type Id = string;

export type PageSize = 'A4' | 'Letter' | 'A3' | 'A5' | 'Legal';
export type Orientation = 'portrait' | 'landscape';

export interface PageSetup {
    size: PageSize;
    orientation: Orientation;
    /** Points on every side. */
    margin: number;
    /** Column guides, 1 to 6. */
    columns: number;
    /** Points between columns. */
    gutter: number;
    /** Grid spacing in points, 0 means no grid. */
    grid: number;
}

export interface Point {
    x: number;
    y: number;
}

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** A rectangle rotated by `rotation` degrees about its centre. */
export interface Box extends Rect {
    rotation: number;
}

interface ItemBase extends Box {
    id: Id;
    locked?: boolean;
}

export interface ImageFilters {
    /** 0 is off; 0 to 1 widens the range of near-white that turns transparent. */
    whiteToAlpha: number;
    invert: boolean;
    grayscale: boolean;
    /** 1 is unchanged. */
    contrast: number;
}

export interface ImageItem extends ItemBase {
    kind: 'image';
    assetId: Id;
    /** Source pixels. */
    crop: Rect;
    filters: ImageFilters;
}

export type FontKey = 'sans' | 'narrow' | 'serif' | 'mono';
export type TextAlign = 'left' | 'center' | 'right';

export interface TextItem extends ItemBase {
    kind: 'text';
    text: string;
    fontSize: number;
    font: FontKey;
    color: string;
    background: string | null;
    padding: number;
    align: TextAlign;
}

export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'arrow';

export interface ShapeItem extends ItemBase {
    kind: 'shape';
    shape: ShapeKind;
    stroke: string;
    strokeWidth: number;
    fill: string | null;
    /** Lines and arrows run from the corner picked by the flips to the opposite one. */
    flipX: boolean;
    flipY: boolean;
}

export type StrokeTool = 'pen' | 'highlighter';

export interface StrokeItem extends ItemBase {
    kind: 'stroke';
    tool: StrokeTool;
    color: string;
    size: number;
    /** Flat [x, y, pressure, ...] relative to the item origin. */
    points: number[];
}

export type Item = ImageItem | TextItem | ShapeItem | StrokeItem;

export interface Page {
    id: Id;
    /** Array order is z order: the last item is drawn on top. */
    items: Item[];
}

export interface AssetMeta {
    /** SHA-256 of the bytes, lowercase hex. */
    id: Id;
    mime: string;
    width: number;
    height: number;
}

export interface CheatDocument {
    version: 1;
    id: Id;
    title: string;
    createdAt: number;
    updatedAt: number;
    setup: PageSetup;
    pages: Page[];
    assets: Record<Id, AssetMeta>;
}
