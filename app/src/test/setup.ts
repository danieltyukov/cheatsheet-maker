import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only cleans up on its own when Vitest globals are enabled.
afterEach(() => {
    if (typeof document !== 'undefined') cleanup();
});

// jsdom has no 2D canvas. Components must cope with a null context, so the
// stub returns null rather than pretending to draw.
if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}
