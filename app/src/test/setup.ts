import '@testing-library/jest-dom/vitest';

// jsdom has no 2D canvas. Components must cope with a null context, so the
// stub returns null rather than pretending to draw.
if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}
