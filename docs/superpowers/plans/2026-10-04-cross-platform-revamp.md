# Cheatsheet Maker Cross-Platform Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the GTK3/C app with a TypeScript editor that ships as a PWA and as Tauri builds for Windows, macOS, Linux and Android, with text/math/shapes, PDF slide import, smart layout and ink-saver features, plus the open-source repository setup and project website.

**Architecture:** npm workspaces `app/` (React 19, Vite 8, Tauri 2 in `app/src-tauri`) and `site/` (static Vite landing page). `app/src/model` is pure TypeScript (document types, commands, history, packing, snapping, file format), `app/src/render` draws pages to Canvas2D and exports PDF/PNG, `app/src/storage` is an IndexedDB library, `app/src/platform` hides web vs Tauri file dialogs, `app/src/ui` is React. One renderer (`drawPage`) feeds the editor, thumbnails and exports.

**Tech Stack:** TypeScript 7, React 19, Vite 8, Vitest 5, Playwright 1.63, Tauri 2.12, pdf-lib 1.17, pdfjs-dist 6, @mathjax/src 4 with @mathjax/mathjax-newcm-font, perfect-freehand 1.2, fflate 0.8, idb 8, vite-plugin-pwa 1.2, @fontsource-variable fonts.

**Spec:** `docs/superpowers/specs/2026-10-04-cross-platform-revamp-design.md`

## Global Constraints

- Display name "Cheatsheet Maker"; npm/repo slug `cheatsheet-maker`; Tauri identifier `io.github.danieltyukov.CheatsheetMaker`; version `1.0.0` in every manifest.
- No emojis anywhere. No em dashes or en dashes in code, comments, UI strings, docs or commits (use commas, colons, parentheses).
- No runtime network requests to third parties; fonts self-hosted through `@fontsource-variable/*`.
- No account, server or analytics.
- Conventional commits (`feat(model): ...`, `fix(ui): ...`, `docs: ...`, `ci: ...`, `chore: ...`). No AI attribution, no session links, no `Co-Authored-By` trailers. Never `--no-verify`.
- Work stays on the local `revamp` branch. Do not push, do not change GitHub settings.
- File format version is `1`; unknown versions are rejected, never guessed.
- Page sizes in points: A4 595.2756 x 841.8898, Letter 612 x 792, A3 841.8898 x 1190.5512, A5 419.5276 x 595.2756, Legal 612 x 1008.
- Imported raster images are downscaled to at most 4096 px on the long side.
- History is capped at 200 snapshots.
- Autosave fires 500 ms after the last edit.
- Print check thresholds: images under 150 DPI, text under 5 pt.
- Default export DPI for rasterised text and math is 300; PDF import rasterises at 200 DPI by default (150, 200, 300 offered).
- Phone layout applies below 720 px viewport width.
- Indentation 4 spaces in TS/TSX/Rust/CSS, 2 in JSON/YAML/Markdown (`.editorconfig`).

## Review Focus

1. A pasted screenshot that is huge (8000 x 6000) or tiny (16 x 16): the first must be downscaled to 4096 on the long side without freezing the UI, the second must still be selectable and resizable (minimum on-screen handle size, minimum item size 4 pt). Tests live in Task 7 (`downscaleSize`) and Task 2 (`resizeBox` minimum).
2. A rotated item: hit testing, resize anchors, crop and PDF export must all respect rotation; a 90 degree rotated image in the PDF must land in the same place as on screen. Tests in Task 2 (`hitItem`, `resizeBox` with rotation) and Task 12 (matrix for rotated item).
3. Corrupt or foreign input files (a `.cheatsheet` with version 2, a zip without `document.json`, a JSON that is not the legacy format, a PDF that is password protected): rejected with a readable message, nothing in the library changes. Tests in Task 7 (format), Task 19 (corrupt `.cheatsheet` through `importFiles`) and Task 26 (password-protected PDF).
4. Storage failing mid-session (quota exceeded or IndexedDB unavailable, as in some private windows): the editor keeps working in memory and the status reads "Not saved" with the reason. Tests in Task 13 (autosaver error path and `MemoryLibrary`).
5. Undo after a multi-step gesture (drag, crop, resize, auto-pack) restores exactly the state before the gesture in one step, and a cancelled gesture (Escape mid-drag) leaves no history entry. Tests in Task 4 and Task 17 (`cancel mid-drag`).

---

## File Map

```
package.json                    workspaces, root scripts
tsconfig.base.json              shared compiler options
vitest.config.ts                root test runner config
Cargo.toml                      Rust workspace (member app/src-tauri)
.editorconfig  .gitignore  LICENSE  README.md  CHANGELOG.md  CONTRIBUTING.md
SECURITY.md  CODE_OF_CONDUCT.md  PRIVACY.md  CLAUDE.md
docs/ARCHITECTURE.md  docs/FILE-FORMAT.md  docs/img/*
scripts/render-icons.mjs  scripts/check-version.sh  scripts/release-notes.sh
.github/ISSUE_TEMPLATE/{bug.yml,feature.yml,config.yml}
.github/{PULL_REQUEST_TEMPLATE.md,CODEOWNERS,dependabot.yml}
.github/workflows/{ci.yml,pages.yml,release.yml}

app/package.json  app/tsconfig.json  app/vite.config.ts  app/index.html
app/playwright.config.ts  app/icon-source.svg  app/public/{favicon.svg,icons/*}
app/src/main.tsx                entry, font imports, PWA registration
app/src/tokens.css              colour, type and spacing tokens (shared with site)
app/src/base.css                reset and element defaults
app/src/test/setup.ts           jest-dom, canvas stub
app/src/test/fixtures/*         legacy autosave, sample png bytes

app/src/model/types.ts          document types
app/src/model/ids.ts            id generation
app/src/model/pageSizes.ts      page dimensions
app/src/model/factory.ts        createDocument, createPage, item factories
app/src/model/geometry.ts       matrices, bounds, hit testing, handles, resizeBox
app/src/model/commands.ts       pure document edits
app/src/model/history.ts        undo/redo with gestures
app/src/model/pack.ts           MaxRects, arrange, fitScale
app/src/model/layout.ts         applyPack, align, distribute
app/src/model/snap.ts           snap targets and snapping
app/src/model/printCheck.ts     legibility issues
app/src/model/hash.ts           sha256Hex
app/src/model/format.ts         .cheatsheet zip and validation
app/src/model/legacy.ts         GTK autosave.json import
app/src/model/imageSize.ts      readPngSize, downscaleSize

app/src/render/colors.ts        parseColor
app/src/render/fonts.ts         font families and CSS font strings
app/src/render/filters.ts       applyFilters, findTrimRect
app/src/render/markdown.ts      parseMarkdown
app/src/render/textLayout.ts    layoutText
app/src/render/math.ts          texToSvg (MathJax), MathCache
app/src/render/strokes.ts       stroke outlines, shape paths
app/src/render/drawPage.ts      drawPage, drawItem
app/src/render/assetCache.ts    decoded and filtered bitmaps
app/src/render/rasterize.ts     browser canvas helpers for export
app/src/render/exportPdf.ts     exportPdf
app/src/render/exportPng.ts     exportPng

app/src/storage/library.ts      IndexedDB library
app/src/storage/autosave.ts     debounced saver

app/src/platform/index.ts       Platform interface and detection
app/src/platform/web.ts         web adapter
app/src/platform/tauri.ts       Tauri adapter
app/src/platform/classify.ts    classifyFile

app/src/ui/App.tsx              library vs editor routing
app/src/ui/store.ts             EditorStore and hooks
app/src/ui/actions.ts           import, export, save, pack, clipboard actions
app/src/ui/shortcuts.ts         key map
app/src/ui/icons.tsx            inline SVG icon set
app/src/ui/components/*         Button, Menu, Dialog, Slider, ColorField, Toasts
app/src/ui/library/LibraryScreen.tsx
app/src/ui/editor/EditorScreen.tsx  TopBar.tsx  ToolRail.tsx  PagesPanel.tsx
app/src/ui/editor/inspector/*.tsx  PrintCheck.tsx  ShortcutsDialog.tsx
app/src/ui/editor/PdfImportDialog.tsx  TextEditor.tsx
app/src/ui/canvas/CanvasView.tsx  viewport.ts  gestures.ts  overlay.ts

app/src-tauri/{Cargo.toml,build.rs,tauri.conf.json,capabilities/default.json}
app/src-tauri/src/{main.rs,lib.rs}  app/src-tauri/icons/*  app/src-tauri/gen/android/*

app/e2e/*.spec.ts  app/e2e/fixtures/*
site/{package.json,vite.config.ts,index.html,privacy.html,style.css,main.js,public/*}
site/e2e/site.spec.ts  site/playwright.config.ts
```

---
## Phase A: Foundation and model

### Task 1: Workspace scaffold, remove the C app

**Files:**
- Delete: `src/`, `build/`, `Makefile`, `cheatsheet-maker` (binary), `scripts/install-or-update-ubuntu.sh`, `assets/`
- Create: `package.json`, `tsconfig.base.json`, `vitest.config.ts`, `.editorconfig`, `.gitignore`
- Create: `app/package.json`, `app/tsconfig.json`, `app/vite.config.ts`, `app/index.html`, `app/src/main.tsx`, `app/src/ui/App.tsx`, `app/src/test/setup.ts`, `app/src/vite-env.d.ts`
- Test: `app/src/ui/App.test.tsx`

**Interfaces:**
- Produces: `npm test` (Vitest over `app/src/**/*.test.{ts,tsx}`), `npm run typecheck`, `npm run dev`, `npm run build`. Default test environment is `node`; React tests opt into jsdom with a `// @vitest-environment jsdom` first line.

- [ ] **Step 1: Remove the C sources and build outputs**

```bash
git rm -r -q src build Makefile cheatsheet-maker scripts/install-or-update-ubuntu.sh assets
```

- [ ] **Step 2: Write root config files**

`package.json`:
```json
{
  "name": "cheatsheet-maker",
  "private": true,
  "type": "module",
  "workspaces": ["app", "site"],
  "scripts": {
    "dev": "npm run dev -w app",
    "build": "npm run build -w app",
    "test": "vitest run",
    "test:e2e": "npm run e2e -w app",
    "typecheck": "tsc --noEmit -p app",
    "tauri": "npm run tauri -w app --"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^7.0.2",
    "vitest": "^5.0.3"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": false,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "types": ["vite/client", "node"]
  }
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['app/src/**/*.test.{ts,tsx}'],
        environment: 'node',
        setupFiles: ['app/src/test/setup.ts'],
    },
});
```

`.editorconfig`:
```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 4
trim_trailing_whitespace = true

[*.{json,yml,yaml,md}]
indent_size = 2

[*.md]
trim_trailing_whitespace = false
```

`.gitignore`:
```
node_modules/
dist/
target/
app/src-tauri/gen/schemas/
app/test-results/
app/playwright-report/
site/test-results/
.claude/
*.log
.DS_Store
```

- [ ] **Step 3: Write the app package**

`app/package.json`:
```json
{
  "name": "@cheatsheet-maker/app",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit -p . && vite build",
    "preview": "vite preview --port 4173 --strictPort",
    "tauri": "tauri",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@fontsource-variable/archivo-narrow": "^5.3.0",
    "@fontsource-variable/atkinson-hyperlegible-next": "^5.3.0",
    "@fontsource-variable/bricolage-grotesque": "^5.3.0",
    "@fontsource-variable/jetbrains-mono": "^5.3.0",
    "@fontsource-variable/source-serif-4": "^5.3.0",
    "@mathjax/mathjax-newcm-font": "^4.1.3",
    "@mathjax/src": "^4.1.3",
    "@tauri-apps/api": "^2.12.1",
    "@tauri-apps/plugin-dialog": "^2.8.1",
    "@tauri-apps/plugin-fs": "^2.6.0",
    "fflate": "^0.8.3",
    "idb": "^8.0.3",
    "pdf-lib": "^1.17.1",
    "pdfjs-dist": "^6.4.299",
    "perfect-freehand": "^1.2.3",
    "react": "^19.3.0",
    "react-dom": "^19.3.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.63.0",
    "@tauri-apps/cli": "^2.12.1",
    "@testing-library/dom": "^10.4.2",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.7",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.1",
    "fake-indexeddb": "^6.2.5",
    "jsdom": "^30.1.2",
    "vite": "^8.3.2",
    "vite-plugin-pwa": "^2.0.0",
    "workbox-window": "^7.4.1"
  }
}
```

`app/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "include": ["src", "e2e", "vite.config.ts", "playwright.config.ts"]
}
```

`app/vite.config.ts` (PWA is added in Task 24):
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: './',
    plugins: [react()],
    server: { port: 5173, strictPort: true },
    build: { target: 'es2022', sourcemap: true },
});
```

`app/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Cheatsheet Maker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`app/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

`app/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
```

`app/src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';

// jsdom has no 2D canvas. Components must cope with a null context, so the
// stub returns null rather than pretending to draw.
if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}
```

- [ ] **Step 4: Write the failing smoke test**

`app/src/ui/App.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { App } from './App';

test('renders the product name', () => {
    render(<App />);
    expect(screen.getByText('Cheatsheet Maker')).toBeInTheDocument();
});
```

- [ ] **Step 5: Install and run the test to see it fail**

Run: `npm install && npx vitest run app/src/ui/App.test.tsx`
Expected: FAIL, `Cannot find module './App'`.

- [ ] **Step 6: Minimal App**

`app/src/ui/App.tsx`:
```tsx
export function App() {
    return <h1>Cheatsheet Maker</h1>;
}
```

- [ ] **Step 7: Run tests, typecheck and build**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: 1 test passed; typecheck clean; `app/dist/index.html` exists.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: replace the GTK app with a TypeScript workspace scaffold"
```

---

### Task 2: Document types, page sizes, factories and geometry

**Files:**
- Create: `app/src/model/types.ts`, `app/src/model/ids.ts`, `app/src/model/pageSizes.ts`, `app/src/model/factory.ts`, `app/src/model/geometry.ts`
- Test: `app/src/model/pageSizes.test.ts`, `app/src/model/factory.test.ts`, `app/src/model/geometry.test.ts`

**Interfaces:**
- Produces (types): `Id`, `PageSize`, `Orientation`, `PageSetup`, `Rect`, `Point`, `Box`, `ImageFilters`, `ImageItem`, `FontKey`, `TextAlign`, `TextItem`, `ShapeKind`, `ShapeItem`, `StrokeTool`, `StrokeItem`, `Item`, `Page`, `AssetMeta`, `CheatDocument`.
- Produces (functions): `newId(): Id`; `PAGE_SIZES`; `pageDimensions(setup): {w,h}`; `printableArea(setup): Rect`; `columnGuides(setup): number[]`; `DEFAULT_SETUP`; `DEFAULT_FILTERS`; `createPage()`; `createDocument(title?, now?)`; `createImageItem(asset, center: Point, maxW, maxH)`; `createTextItem(at: Point, style: TextStyle, width)`; `createShapeItem(shape, rect, style: ShapeStyle)`; `createStrokeItem(absPoints: number[], tool, color, size)`; geometry: `Matrix`, `multiply`, `invert`, `apply`, `translation`, `rotation`, `scaling`, `itemMatrix(box)`, `toLocal(box, p)`, `boxCorners(box)`, `boxBounds(box)`, `rectContains(outer, inner, eps?)`, `rectsIntersect(a, b)`, `unionRect(rects)`, `distToSegment(p, a, b)`, `hitItem(item, p, tol)`, `Handle`, `handlePositions(box, rotateOffset)`, `handleAt(item, p, tol, rotateOffset)`, `resizeBox(start, handle, pageDelta, keepAspect, minSize?)`, `rotateBox(start, startPointer, pointer, snap)`, `lineEndpoints(shape)`, `boxFromLine(a, b)`.

- [ ] **Step 1: Write the types**

`app/src/model/types.ts`:
```ts
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
```

`app/src/model/ids.ts`:
```ts
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function newId(length = 12): string {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let out = '';
    for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
    return out;
}
```

- [ ] **Step 2: Write failing tests for page sizes and factories**

`app/src/model/pageSizes.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { columnGuides, pageDimensions, printableArea } from './pageSizes';
import { DEFAULT_SETUP } from './factory';

describe('pageDimensions', () => {
    test('A4 portrait is 210 x 297 mm in points', () => {
        const d = pageDimensions({ size: 'A4', orientation: 'portrait' });
        expect(d.w).toBeCloseTo(595.2756, 3);
        expect(d.h).toBeCloseTo(841.8898, 3);
    });
    test('landscape swaps the sides', () => {
        expect(pageDimensions({ size: 'Letter', orientation: 'landscape' })).toEqual({ w: 792, h: 612 });
    });
});

test('printableArea removes the margin on every side', () => {
    const a = printableArea({ ...DEFAULT_SETUP, size: 'Letter', margin: 36 });
    expect(a).toEqual({ x: 36, y: 36, w: 540, h: 720 });
});

test('columnGuides gives both edges of every gutter', () => {
    const setup = { ...DEFAULT_SETUP, size: 'Letter' as const, margin: 36, columns: 2, gutter: 20 };
    // printable width 540, column width (540 - 20) / 2 = 260
    expect(columnGuides(setup)).toEqual([296, 316]);
    expect(columnGuides({ ...setup, columns: 1 })).toEqual([]);
});
```

`app/src/model/factory.test.ts`:
```ts
import { expect, test } from 'vitest';
import { createDocument, createImageItem, createStrokeItem } from './factory';

test('a new document has one empty A4 page', () => {
    const doc = createDocument('Exam', 1000);
    expect(doc.version).toBe(1);
    expect(doc.title).toBe('Exam');
    expect(doc.createdAt).toBe(1000);
    expect(doc.pages).toHaveLength(1);
    expect(doc.pages[0].items).toEqual([]);
    expect(doc.setup.size).toBe('A4');
});

test('an image is placed at 96 DPI and shrunk to fit', () => {
    const asset = { id: 'a', mime: 'image/png', width: 400, height: 200 };
    const small = createImageItem(asset, { x: 300, y: 400 }, 1000, 1000);
    expect(small.w).toBe(300);
    expect(small.h).toBe(150);
    expect(small.x).toBe(150);
    expect(small.y).toBe(325);
    expect(small.crop).toEqual({ x: 0, y: 0, w: 400, h: 200 });
    const big = createImageItem(asset, { x: 0, y: 0 }, 100, 100);
    expect(big.w).toBe(100);
    expect(big.h).toBe(50);
});

test('a stroke stores points relative to its padded bounds', () => {
    const s = createStrokeItem([10, 20, 0.5, 30, 60, 0.5], 'pen', '#000000', 4);
    expect(s.x).toBe(8);
    expect(s.y).toBe(18);
    expect(s.w).toBe(24);
    expect(s.h).toBe(44);
    expect(s.points).toEqual([2, 2, 0.5, 22, 42, 0.5]);
});
```

- [ ] **Step 3: Run to see them fail**

Run: `npx vitest run app/src/model`
Expected: FAIL, modules `./pageSizes` and `./factory` not found.

- [ ] **Step 4: Implement page sizes and factories**

`app/src/model/pageSizes.ts`:
```ts
import type { PageSetup, PageSize, Rect } from './types';

const MM = 72 / 25.4;

export const PAGE_SIZES: Record<PageSize, { w: number; h: number; label: string }> = {
    A4: { w: 210 * MM, h: 297 * MM, label: 'A4' },
    Letter: { w: 612, h: 792, label: 'US Letter' },
    A3: { w: 297 * MM, h: 420 * MM, label: 'A3' },
    A5: { w: 148 * MM, h: 210 * MM, label: 'A5' },
    Legal: { w: 612, h: 1008, label: 'US Legal' },
};

export function pageDimensions(setup: Pick<PageSetup, 'size' | 'orientation'>): { w: number; h: number } {
    const s = PAGE_SIZES[setup.size];
    return setup.orientation === 'landscape' ? { w: s.h, h: s.w } : { w: s.w, h: s.h };
}

export function printableArea(setup: PageSetup): Rect {
    const { w, h } = pageDimensions(setup);
    const m = setup.margin;
    return { x: m, y: m, w: Math.max(0, w - 2 * m), h: Math.max(0, h - 2 * m) };
}

/** x positions of both edges of each gutter between columns. */
export function columnGuides(setup: PageSetup): number[] {
    if (setup.columns <= 1) return [];
    const area = printableArea(setup);
    const colW = (area.w - setup.gutter * (setup.columns - 1)) / setup.columns;
    const out: number[] = [];
    for (let i = 1; i < setup.columns; i++) {
        const left = area.x + i * colW + (i - 1) * setup.gutter;
        out.push(left, left + setup.gutter);
    }
    return out;
}
```

`app/src/model/factory.ts`:
```ts
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

export function createImageItem(asset: AssetMeta, center: Point, maxW: number, maxH: number): ImageItem {
    let w = asset.width * PX_TO_PT;
    let h = asset.height * PX_TO_PT;
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
```

- [ ] **Step 5: Run the page size and factory tests**

Run: `npx vitest run app/src/model`
Expected: PASS.

- [ ] **Step 6: Write failing geometry tests**

`app/src/model/geometry.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import {
    apply, boxBounds, boxFromLine, handleAt, hitItem, invert, itemMatrix, lineEndpoints, multiply,
    resizeBox, rotateBox, toLocal, unionRect,
} from './geometry';
import { createShapeItem, createStrokeItem } from './factory';
import type { Box, ImageItem } from './types';

const box = (x: number, y: number, w: number, h: number, rotation = 0): Box => ({ x, y, w, h, rotation });

function close(p: { x: number; y: number }, x: number, y: number) {
    expect(p.x).toBeCloseTo(x, 6);
    expect(p.y).toBeCloseTo(y, 6);
}

describe('matrices', () => {
    test('invert undoes the item matrix', () => {
        const m = itemMatrix(box(10, 20, 100, 50, 33));
        const p = apply(multiply(invert(m), m), { x: 7, y: 9 });
        close(p, 7, 9);
    });
    test('a 90 degree rotation turns the top-left corner about the centre', () => {
        // centre (60, 45); local (0,0) is (-50,-25) from centre; rotated 90 deg clockwise in y-down is (25,-50)
        close(apply(itemMatrix(box(10, 20, 100, 50, 90)), { x: 0, y: 0 }), 85, -5);
    });
    test('toLocal maps the centre to the middle of the box', () => {
        close(toLocal(box(10, 20, 100, 50, 45), { x: 60, y: 45 }), 50, 25);
    });
});

test('boxBounds of a box rotated 90 degrees swaps width and height', () => {
    const b = boxBounds(box(0, 0, 100, 50, 90));
    expect(b.x).toBeCloseTo(25);
    expect(b.y).toBeCloseTo(-25);
    expect(b.w).toBeCloseTo(50);
    expect(b.h).toBeCloseTo(100);
});

test('unionRect', () => {
    expect(unionRect([])).toBeNull();
    expect(unionRect([{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 5, w: 5, h: 20 }])).toEqual({ x: 0, y: 0, w: 25, h: 25 });
});

describe('hitItem', () => {
    const img = { ...box(0, 0, 100, 20, 90), id: 'i', kind: 'image' } as ImageItem;
    test('respects rotation', () => {
        expect(hitItem(img, { x: 50, y: 10 }, 0)).toBe(true); // centre
        expect(hitItem(img, { x: 5, y: 10 }, 0)).toBe(false); // inside the unrotated box only
        expect(hitItem(img, { x: 50, y: -35 }, 0)).toBe(true); // inside the rotated box only
    });
    test('strokes hit near their path, not in empty bounds', () => {
        const s = createStrokeItem([0, 0, 0.5, 100, 0, 0.5, 100, 100, 0.5], 'pen', '#000', 4);
        expect(hitItem(s, { x: 50, y: 1 }, 2)).toBe(true);
        expect(hitItem(s, { x: 20, y: 80 }, 2)).toBe(false);
    });
    test('lines hit near the segment', () => {
        const l = createShapeItem('line', { x: 0, y: 0, w: 100, h: 100 }, { stroke: '#000', strokeWidth: 2, fill: null });
        expect(hitItem(l, { x: 50, y: 51 }, 2)).toBe(true);
        expect(hitItem(l, { x: 90, y: 10 }, 2)).toBe(false);
    });
});

describe('resizeBox', () => {
    test('dragging the east handle grows the width and keeps the west edge', () => {
        expect(resizeBox(box(10, 10, 100, 50), 'e', { x: 20, y: 999 }, false)).toEqual(box(10, 10, 120, 50));
    });
    test('dragging the north-west handle with aspect lock keeps the ratio', () => {
        const r = resizeBox(box(0, 0, 100, 50), 'nw', { x: -50, y: 0 }, true);
        expect(r.w).toBeCloseTo(150);
        expect(r.h).toBeCloseTo(75);
        expect(r.x + r.w).toBeCloseTo(100);
        expect(r.y + r.h).toBeCloseTo(50);
    });
    test('never shrinks below the minimum size', () => {
        const r = resizeBox(box(0, 0, 100, 50), 'w', { x: 500, y: 0 }, false, 4);
        expect(r.w).toBe(4);
        expect(r.x).toBe(96);
    });
    test('on a rotated box the opposite edge stays fixed in page space', () => {
        const start = box(0, 0, 100, 50, 90);
        // local east edge points down the page after a 90 degree rotation, so drag down
        const r = resizeBox(start, 'e', { x: 0, y: 20 }, false);
        expect(r.w).toBeCloseTo(120);
        const before = apply(itemMatrix(start), { x: 0, y: 25 });
        const after = apply(itemMatrix(r), { x: 0, y: 25 });
        close(after, before.x, before.y);
    });
});

test('rotateBox measures the angle around the centre and snaps to 15 degrees', () => {
    const b = box(0, 0, 100, 100);
    expect(rotateBox(b, { x: 50, y: -10 }, { x: 110, y: 50 }, false)).toBeCloseTo(90);
    expect(rotateBox(b, { x: 50, y: -10 }, { x: 100, y: 10 }, true) % 15).toBeCloseTo(0);
});

test('handleAt finds corners and the rotate handle in page space', () => {
    const item = { ...box(0, 0, 100, 50), id: 'x', kind: 'image' } as ImageItem;
    expect(handleAt(item, { x: 100, y: 50 }, 4, 20)).toBe('se');
    expect(handleAt(item, { x: 50, y: -20 }, 4, 20)).toBe('rotate');
    expect(handleAt(item, { x: 50, y: 25 }, 4, 20)).toBeNull();
});

test('lines expose endpoints and rebuild their box from them', () => {
    const l = createShapeItem('arrow', { x: 0, y: 0, w: 10, h: 10 }, { stroke: '#000', strokeWidth: 1, fill: null }, true, false);
    const [a, b] = lineEndpoints(l);
    expect(a).toEqual({ x: 10, y: 0 });
    expect(b).toEqual({ x: 0, y: 10 });
    expect(boxFromLine({ x: 30, y: 5 }, { x: 10, y: 25 })).toEqual({ x: 10, y: 5, w: 20, h: 20, rotation: 0, flipX: true, flipY: false });
});
```

- [ ] **Step 7: Run to see geometry fail**

Run: `npx vitest run app/src/model/geometry.test.ts`
Expected: FAIL, module `./geometry` not found.

- [ ] **Step 8: Implement geometry**

`app/src/model/geometry.ts`:
```ts
import type { Box, Item, Point, Rect, ShapeItem } from './types';

/** [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f (canvas convention). */
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** m then n is multiply(m, n) applied as m(n(p)). */
export function multiply(m: Matrix, n: Matrix): Matrix {
    return [
        m[0] * n[0] + m[2] * n[1],
        m[1] * n[0] + m[3] * n[1],
        m[0] * n[2] + m[2] * n[3],
        m[1] * n[2] + m[3] * n[3],
        m[0] * n[4] + m[2] * n[5] + m[4],
        m[1] * n[4] + m[3] * n[5] + m[5],
    ];
}

export function invert(m: Matrix): Matrix {
    const det = m[0] * m[3] - m[1] * m[2];
    if (det === 0) return [...IDENTITY];
    const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
    return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

export function apply(m: Matrix, p: Point): Point {
    return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

export const translation = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
export const scaling = (sx: number, sy: number): Matrix => [sx, 0, 0, sy, 0, 0];
export function rotation(deg: number): Matrix {
    const r = (deg * Math.PI) / 180;
    const c = Math.cos(r), s = Math.sin(r);
    return [c, s, -s, c, 0, 0];
}

/** Local (0..w, 0..h, y down) to page coordinates. */
export function itemMatrix(b: Box): Matrix {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    return multiply(multiply(translation(cx, cy), rotation(b.rotation)), translation(-b.w / 2, -b.h / 2));
}

export function toLocal(b: Box, p: Point): Point {
    return apply(invert(itemMatrix(b)), p);
}

export function boxCorners(b: Box): Point[] {
    const m = itemMatrix(b);
    return [apply(m, { x: 0, y: 0 }), apply(m, { x: b.w, y: 0 }), apply(m, { x: b.w, y: b.h }), apply(m, { x: 0, y: b.h })];
}

export function boxBounds(b: Box): Rect {
    if (!b.rotation) return { x: b.x, y: b.y, w: b.w, h: b.h };
    const c = boxCorners(b);
    const xs = c.map((p) => p.x), ys = c.map((p) => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function rectContains(outer: Rect, inner: Rect, eps = 0.5): boolean {
    return inner.x >= outer.x - eps && inner.y >= outer.y - eps
        && inner.x + inner.w <= outer.x + outer.w + eps && inner.y + inner.h <= outer.y + outer.h + eps;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function unionRect(rects: Rect[]): Rect | null {
    if (rects.length === 0) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of rects) {
        x0 = Math.min(x0, r.x);
        y0 = Math.min(y0, r.y);
        x1 = Math.max(x1, r.x + r.w);
        y1 = Math.max(y1, r.y + r.h);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function distToSegment(p: Point, a: Point, b: Point): number {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function lineEndpoints(s: Pick<ShapeItem, 'x' | 'y' | 'w' | 'h' | 'flipX' | 'flipY'>): [Point, Point] {
    const a = { x: s.x + (s.flipX ? s.w : 0), y: s.y + (s.flipY ? s.h : 0) };
    const b = { x: s.x + (s.flipX ? 0 : s.w), y: s.y + (s.flipY ? 0 : s.h) };
    return [a, b];
}

export function boxFromLine(a: Point, b: Point): Box & { flipX: boolean; flipY: boolean } {
    return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        w: Math.abs(b.x - a.x),
        h: Math.abs(b.y - a.y),
        rotation: 0,
        flipX: a.x > b.x,
        flipY: a.y > b.y,
    };
}

export function hitItem(item: Item, p: Point, tol: number): boolean {
    const l = toLocal(item, p);
    if (item.kind === 'stroke') {
        const pts = item.points;
        const reach = item.size / 2 + tol;
        if (pts.length === 3) return Math.hypot(l.x - pts[0], l.y - pts[1]) <= reach;
        for (let i = 0; i + 3 < pts.length; i += 3) {
            if (distToSegment(l, { x: pts[i], y: pts[i + 1] }, { x: pts[i + 3], y: pts[i + 4] }) <= reach) return true;
        }
        return false;
    }
    if (item.kind === 'shape' && (item.shape === 'line' || item.shape === 'arrow')) {
        const [a, b] = lineEndpoints({ ...item, x: 0, y: 0 });
        return distToSegment(l, a, b) <= item.strokeWidth / 2 + tol;
    }
    return l.x >= -tol && l.y >= -tol && l.x <= item.w + tol && l.y <= item.h + tol;
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';
export type ResizeHandle = Exclude<Handle, 'rotate'>;

const LOCAL_HANDLES: Array<[ResizeHandle, number, number]> = [
    ['nw', 0, 0], ['n', 0.5, 0], ['ne', 1, 0], ['e', 1, 0.5],
    ['se', 1, 1], ['s', 0.5, 1], ['sw', 0, 1], ['w', 0, 0.5],
];

export function handlePositions(b: Box, rotateOffset: number): Record<Handle, Point> {
    const m = itemMatrix(b);
    const out = {} as Record<Handle, Point>;
    for (const [h, fx, fy] of LOCAL_HANDLES) out[h] = apply(m, { x: fx * b.w, y: fy * b.h });
    out.rotate = apply(m, { x: b.w / 2, y: -rotateOffset });
    return out;
}

function isLine(item: Item): item is ShapeItem {
    return item.kind === 'shape' && (item.shape === 'line' || item.shape === 'arrow');
}

/** Lines get two endpoint handles named after the corner they sit on; boxes get eight plus rotate. */
export function handleAt(item: Item, p: Point, tol: number, rotateOffset: number): Handle | null {
    if (isLine(item)) {
        const [a, b] = lineEndpoints(item);
        if (Math.hypot(p.x - a.x, p.y - a.y) <= tol) return 'nw';
        if (Math.hypot(p.x - b.x, p.y - b.y) <= tol) return 'se';
        return null;
    }
    const pos = handlePositions(item, rotateOffset);
    const order: Handle[] = ['rotate', 'nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'];
    for (const h of order) {
        if (Math.hypot(p.x - pos[h].x, p.y - pos[h].y) <= tol) return h;
    }
    return null;
}

export function resizeBox(start: Box, handle: ResizeHandle, pageDelta: Point, keepAspect: boolean, minSize = 4): Box {
    const d = apply(rotation(-start.rotation), pageDelta);
    let l = 0, t = 0, r = start.w, b = start.h;
    const west = handle.includes('w'), east = handle.includes('e');
    const north = handle.includes('n'), south = handle.includes('s');
    if (west) l += d.x;
    if (east) r += d.x;
    if (north) t += d.y;
    if (south) b += d.y;
    if (r - l < minSize) {
        if (west) l = r - minSize;
        else r = l + minSize;
    }
    if (b - t < minSize) {
        if (north) t = b - minSize;
        else b = t + minSize;
    }
    if (keepAspect && handle.length === 2 && start.h > 0) {
        const aspect = start.w / start.h;
        let w = r - l, h = b - t;
        if (w / h > aspect) h = w / aspect;
        else w = h * aspect;
        if (west) l = r - w;
        else r = l + w;
        if (north) t = b - h;
        else b = t + h;
    }
    const w = r - l, h = b - t;
    const c = apply(itemMatrix(start), { x: (l + r) / 2, y: (t + b) / 2 });
    return { x: c.x - w / 2, y: c.y - h / 2, w, h, rotation: start.rotation };
}

export function normalizeDeg(d: number): number {
    let a = d % 360;
    if (a > 180) a -= 360;
    if (a <= -180) a += 360;
    return a;
}

export function rotateBox(start: Box, startPointer: Point, pointer: Point, snap: boolean): number {
    const cx = start.x + start.w / 2, cy = start.y + start.h / 2;
    const a0 = Math.atan2(startPointer.y - cy, startPointer.x - cx);
    const a1 = Math.atan2(pointer.y - cy, pointer.x - cx);
    let deg = start.rotation + ((a1 - a0) * 180) / Math.PI;
    if (snap) deg = Math.round(deg / 15) * 15;
    return normalizeDeg(deg);
}
```

- [ ] **Step 9: Run all model tests**

Run: `npx vitest run app/src/model`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add app/src/model
git commit -m "feat(model): document types, page sizes, factories and geometry"
```

---

### Task 3: Document commands

**Files:**
- Create: `app/src/model/commands.ts`
- Test: `app/src/model/commands.test.ts`

**Interfaces:**
- Consumes: types and factories from Task 2.
- Produces: `findItem(doc, id): {pageIndex, index, item} | null`; `ItemPatch`; `addItems(doc, pageIndex, items)`; `updateItems(doc, patches: Record<Id, ItemPatch>)`; `setItemBox(item, box): Item`; `setBoxes(doc, boxes: Record<Id, Box>)`; `translateItems(doc, ids, dx, dy)`; `removeItems(doc, ids)`; `Reorder`; `reorderItems(doc, ids, how)`; `cloneItems(items, offset): Item[]`; `duplicateItems(doc, ids, offset?): {doc, ids}`; `moveItemsToPage(doc, ids, target, dx, dy)`; `addPage(doc, at?)`; `duplicatePage(doc, index)`; `removePage(doc, index)`; `movePage(doc, from, to)`; `setSetup(doc, patch)`; `addAsset(doc, meta)`; `setTitle(doc, title)`; `referencedAssetIds(doc): Set<Id>`; `pruneAssets(doc)`. Every command returns the same object when nothing changed.

- [ ] **Step 1: Write failing tests**

`app/src/model/commands.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import {
    addAsset, addItems, addPage, duplicateItems, duplicatePage, findItem, movePage, moveItemsToPage,
    pruneAssets, referencedAssetIds, removeItems, removePage, reorderItems, setBoxes, setSetup,
    translateItems, updateItems,
} from './commands';
import { createDocument, createImageItem, createShapeItem, createStrokeItem } from './factory';
import type { CheatDocument, Item } from './types';

const asset = { id: 'h1', mime: 'image/png', width: 100, height: 100 };

function docWith(...items: Item[]): CheatDocument {
    return addItems(createDocument('t', 0), 0, items);
}

const rect = (x: number) => createShapeItem('rect', { x, y: 0, w: 10, h: 10 }, { stroke: '#000', strokeWidth: 1, fill: null });

describe('items', () => {
    test('add, find and remove', () => {
        const a = rect(0);
        const doc = docWith(a);
        expect(findItem(doc, a.id)).toEqual({ pageIndex: 0, index: 0, item: a });
        expect(removeItems(doc, [a.id]).pages[0].items).toEqual([]);
    });
    test('commands do not mutate their input and return the same object on no-op', () => {
        const a = rect(0);
        const doc = docWith(a);
        const moved = translateItems(doc, [a.id], 5, 6);
        expect(doc.pages[0].items[0].x).toBe(0);
        expect(moved.pages[0].items[0]).toMatchObject({ x: 5, y: 6 });
        expect(removeItems(doc, ['missing'])).toBe(doc);
        expect(translateItems(doc, [a.id], 0, 0)).toBe(doc);
    });
    test('updateItems patches fields but never id or kind', () => {
        const a = rect(0);
        const doc = updateItems(docWith(a), { [a.id]: { stroke: '#ff0000', id: 'evil', kind: 'image' } as never });
        expect(doc.pages[0].items[0]).toMatchObject({ id: a.id, kind: 'shape', stroke: '#ff0000' });
    });
    test('setBoxes rescales stroke points', () => {
        const s = createStrokeItem([0, 0, 0.5, 10, 10, 0.5], 'pen', '#000', 2);
        const doc = setBoxes(docWith(s), { [s.id]: { x: s.x, y: s.y, w: s.w * 2, h: s.h * 2, rotation: 0 } });
        const out = doc.pages[0].items[0];
        expect(out.kind === 'stroke' && out.points).toEqual([2, 2, 0.5, 22, 22, 0.5]);
    });
    test('reorder forward, backward, front and back', () => {
        const [a, b, c] = [rect(0), rect(1), rect(2)];
        const doc = docWith(a, b, c);
        const ids = (d: CheatDocument) => d.pages[0].items.map((i) => i.id);
        expect(ids(reorderItems(doc, [a.id], 'forward'))).toEqual([b.id, a.id, c.id]);
        expect(ids(reorderItems(doc, [c.id], 'backward'))).toEqual([a.id, c.id, b.id]);
        expect(ids(reorderItems(doc, [a.id], 'front'))).toEqual([b.id, c.id, a.id]);
        expect(ids(reorderItems(doc, [b.id, c.id], 'back'))).toEqual([b.id, c.id, a.id]);
        expect(reorderItems(doc, [c.id], 'front')).toBe(doc);
    });
    test('duplicate gives new ids, an offset and puts copies on top', () => {
        const a = rect(0);
        const { doc, ids } = duplicateItems(docWith(a), [a.id]);
        expect(ids).toHaveLength(1);
        expect(ids[0]).not.toBe(a.id);
        expect(doc.pages[0].items[1]).toMatchObject({ id: ids[0], x: 12, y: 12 });
    });
    test('moveItemsToPage moves and offsets', () => {
        const a = rect(0);
        const doc = moveItemsToPage(addPage(docWith(a)), [a.id], 1, 0, -100);
        expect(doc.pages[0].items).toEqual([]);
        expect(doc.pages[1].items[0]).toMatchObject({ id: a.id, y: -100 });
    });
});

describe('pages', () => {
    test('remove keeps at least one page', () => {
        const doc = createDocument('t', 0);
        expect(removePage(doc, 0)).toBe(doc);
        expect(removePage(addPage(doc), 0).pages).toHaveLength(1);
    });
    test('duplicatePage copies items with fresh ids after the original', () => {
        const a = rect(0);
        const doc = duplicatePage(docWith(a), 0);
        expect(doc.pages).toHaveLength(2);
        expect(doc.pages[1].id).not.toBe(doc.pages[0].id);
        expect(doc.pages[1].items[0].id).not.toBe(a.id);
    });
    test('movePage reorders', () => {
        const doc = addPage(addPage(createDocument('t', 0)));
        const ids = doc.pages.map((p) => p.id);
        expect(movePage(doc, 0, 2).pages.map((p) => p.id)).toEqual([ids[1], ids[2], ids[0]]);
    });
    test('setSetup merges', () => {
        expect(setSetup(createDocument('t', 0), { orientation: 'landscape' }).setup.orientation).toBe('landscape');
    });
});

test('assets are referenced by image items and pruned when unused', () => {
    const img = createImageItem(asset, { x: 0, y: 0 }, 100, 100);
    const doc = addAsset(addAsset(docWith(img), asset), { ...asset, id: 'h2' });
    expect([...referencedAssetIds(doc)]).toEqual(['h1']);
    expect(Object.keys(pruneAssets(doc).assets)).toEqual(['h1']);
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run app/src/model/commands.test.ts`
Expected: FAIL, module `./commands` not found.

- [ ] **Step 3: Implement commands**

`app/src/model/commands.ts`:
```ts
import { createPage } from './factory';
import { newId } from './ids';
import type { AssetMeta, Box, CheatDocument, Id, ImageItem, Item, Page, PageSetup, ShapeItem, StrokeItem, TextItem } from './types';

type Fields<T> = Omit<T, 'id' | 'kind'>;
export type ItemPatch = Partial<Fields<ImageItem> & Fields<TextItem> & Fields<ShapeItem> & Fields<StrokeItem>>;

export function findItem(doc: CheatDocument, id: Id): { pageIndex: number; index: number; item: Item } | null {
    for (let p = 0; p < doc.pages.length; p++) {
        const index = doc.pages[p].items.findIndex((i) => i.id === id);
        if (index >= 0) return { pageIndex: p, index, item: doc.pages[p].items[index] };
    }
    return null;
}

/** Apply `fn` to every page's item list; pages whose list comes back identical are kept as is. */
function mapItems(doc: CheatDocument, fn: (items: Item[], pageIndex: number) => Item[]): CheatDocument {
    let changed = false;
    const pages = doc.pages.map((page, i) => {
        const items = fn(page.items, i);
        if (items === page.items) return page;
        changed = true;
        return { ...page, items };
    });
    return changed ? { ...doc, pages } : doc;
}

export function addItems(doc: CheatDocument, pageIndex: number, items: Item[]): CheatDocument {
    if (items.length === 0) return doc;
    return mapItems(doc, (list, i) => (i === pageIndex ? [...list, ...items] : list));
}

export function updateItems(doc: CheatDocument, patches: Record<Id, ItemPatch>): CheatDocument {
    return mapItems(doc, (list) => {
        let changed = false;
        const next = list.map((item) => {
            const patch = patches[item.id];
            if (!patch) return item;
            const { id: _id, kind: _kind, ...rest } = patch as ItemPatch & { id?: unknown; kind?: unknown };
            const keys = Object.keys(rest) as Array<keyof typeof rest>;
            if (keys.every((k) => (item as unknown as Record<string, unknown>)[k] === rest[k])) return item;
            changed = true;
            return { ...item, ...rest } as Item;
        });
        return changed ? next : list;
    });
}

export function setItemBox(item: Item, box: Box): Item {
    if (item.x === box.x && item.y === box.y && item.w === box.w && item.h === box.h && item.rotation === box.rotation) return item;
    if (item.kind === 'stroke') {
        const sx = item.w > 0 ? box.w / item.w : 1;
        const sy = item.h > 0 ? box.h / item.h : 1;
        const points = item.points.map((v, i) => (i % 3 === 0 ? v * sx : i % 3 === 1 ? v * sy : v));
        return { ...item, ...box, points };
    }
    return { ...item, ...box };
}

export function setBoxes(doc: CheatDocument, boxes: Record<Id, Box>): CheatDocument {
    return mapItems(doc, (list) => {
        let changed = false;
        const next = list.map((item) => {
            const b = boxes[item.id];
            if (!b) return item;
            const out = setItemBox(item, b);
            if (out !== item) changed = true;
            return out;
        });
        return changed ? next : list;
    });
}

export function translateItems(doc: CheatDocument, ids: Id[], dx: number, dy: number): CheatDocument {
    if (dx === 0 && dy === 0) return doc;
    const set = new Set(ids);
    return mapItems(doc, (list) =>
        list.some((i) => set.has(i.id)) ? list.map((i) => (set.has(i.id) ? { ...i, x: i.x + dx, y: i.y + dy } : i)) : list,
    );
}

export function removeItems(doc: CheatDocument, ids: Id[]): CheatDocument {
    const set = new Set(ids);
    return mapItems(doc, (list) => (list.some((i) => set.has(i.id)) ? list.filter((i) => !set.has(i.id)) : list));
}

export type Reorder = 'forward' | 'backward' | 'front' | 'back';

function sameOrder(a: Item[], b: Item[]): boolean {
    return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function reorderItems(doc: CheatDocument, ids: Id[], how: Reorder): CheatDocument {
    const set = new Set(ids);
    return mapItems(doc, (list) => {
        if (!list.some((i) => set.has(i.id))) return list;
        let next: Item[];
        if (how === 'front') next = [...list.filter((i) => !set.has(i.id)), ...list.filter((i) => set.has(i.id))];
        else if (how === 'back') next = [...list.filter((i) => set.has(i.id)), ...list.filter((i) => !set.has(i.id))];
        else {
            next = [...list];
            const step = how === 'forward' ? 1 : -1;
            const order = how === 'forward' ? [...next.keys()].reverse() : [...next.keys()];
            for (const i of order) {
                const j = i + step;
                if (!set.has(next[i].id) || j < 0 || j >= next.length || set.has(next[j].id)) continue;
                [next[i], next[j]] = [next[j], next[i]];
            }
        }
        return sameOrder(next, list) ? list : next;
    });
}

export function cloneItems(items: Item[], offset: number): Item[] {
    return items.map((i) => ({ ...i, id: newId(), x: i.x + offset, y: i.y + offset }));
}

export function duplicateItems(doc: CheatDocument, ids: Id[], offset = 12): { doc: CheatDocument; ids: Id[] } {
    const set = new Set(ids);
    const newIds: Id[] = [];
    const next = mapItems(doc, (list) => {
        const picked = list.filter((i) => set.has(i.id));
        if (picked.length === 0) return list;
        const copies = cloneItems(picked, offset);
        newIds.push(...copies.map((c) => c.id));
        return [...list, ...copies];
    });
    return { doc: next, ids: newIds };
}

export function moveItemsToPage(doc: CheatDocument, ids: Id[], target: number, dx: number, dy: number): CheatDocument {
    const set = new Set(ids);
    const moving: Item[] = [];
    for (const p of doc.pages) for (const i of p.items) if (set.has(i.id)) moving.push({ ...i, x: i.x + dx, y: i.y + dy });
    if (moving.length === 0 || target < 0 || target >= doc.pages.length) return doc;
    const removed = removeItems(doc, ids);
    return addItems(removed, target, moving);
}

export function addPage(doc: CheatDocument, at = doc.pages.length): CheatDocument {
    const pages = [...doc.pages];
    pages.splice(at, 0, createPage());
    return { ...doc, pages };
}

export function duplicatePage(doc: CheatDocument, index: number): CheatDocument {
    const src = doc.pages[index];
    if (!src) return doc;
    const copy: Page = { id: newId(), items: cloneItems(src.items, 0) };
    const pages = [...doc.pages];
    pages.splice(index + 1, 0, copy);
    return { ...doc, pages };
}

export function removePage(doc: CheatDocument, index: number): CheatDocument {
    if (doc.pages.length <= 1 || !doc.pages[index]) return doc;
    return { ...doc, pages: doc.pages.filter((_, i) => i !== index) };
}

export function movePage(doc: CheatDocument, from: number, to: number): CheatDocument {
    if (from === to || !doc.pages[from] || to < 0 || to >= doc.pages.length) return doc;
    const pages = [...doc.pages];
    const [p] = pages.splice(from, 1);
    pages.splice(to, 0, p);
    return { ...doc, pages };
}

export function setSetup(doc: CheatDocument, patch: Partial<PageSetup>): CheatDocument {
    const setup = { ...doc.setup, ...patch };
    const keys = Object.keys(patch) as Array<keyof PageSetup>;
    return keys.every((k) => doc.setup[k] === setup[k]) ? doc : { ...doc, setup };
}

export function addAsset(doc: CheatDocument, meta: AssetMeta): CheatDocument {
    if (doc.assets[meta.id]) return doc;
    return { ...doc, assets: { ...doc.assets, [meta.id]: meta } };
}

export function setTitle(doc: CheatDocument, title: string): CheatDocument {
    return doc.title === title ? doc : { ...doc, title };
}

export function referencedAssetIds(doc: CheatDocument): Set<Id> {
    const out = new Set<Id>();
    for (const p of doc.pages) for (const i of p.items) if (i.kind === 'image') out.add(i.assetId);
    return out;
}

export function pruneAssets(doc: CheatDocument): CheatDocument {
    const used = referencedAssetIds(doc);
    const ids = Object.keys(doc.assets);
    if (ids.every((id) => used.has(id))) return doc;
    const assets: Record<Id, AssetMeta> = {};
    for (const id of ids) if (used.has(id)) assets[id] = doc.assets[id];
    return { ...doc, assets };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run app/src/model`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/model
git commit -m "feat(model): pure document commands"
```

---

### Task 4: Undo and redo with gestures

**Files:**
- Create: `app/src/model/history.ts`
- Test: `app/src/model/history.test.ts`

**Interfaces:**
- Consumes: `CheatDocument`.
- Produces: `History { past, present, future, gestureBase }`, `HISTORY_LIMIT = 200`, `createHistory(doc)`, `commit(h, next)`, `amend(h, next)` (replace the present without a history entry, for derived data such as text box heights), `beginGesture(h)`, `updateGesture(h, next)`, `endGesture(h)`, `cancelGesture(h)`, `undo(h)`, `redo(h)`, `canUndo(h)`, `canRedo(h)`.

- [ ] **Step 1: Write failing tests**

`app/src/model/history.test.ts`:
```ts
import { expect, test } from 'vitest';
import {
    HISTORY_LIMIT, amend, beginGesture, cancelGesture, canRedo, canUndo, commit, createHistory, endGesture,
    redo, undo, updateGesture,
} from './history';
import { createDocument } from './factory';
import { setTitle } from './commands';

const base = createDocument('a', 0);

test('commit, undo and redo', () => {
    let h = createHistory(base);
    const b = setTitle(base, 'b');
    h = commit(h, b);
    expect(canUndo(h)).toBe(true);
    h = undo(h);
    expect(h.present).toBe(base);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.present).toBe(b);
});

test('committing the same document is a no-op', () => {
    const h = createHistory(base);
    expect(commit(h, base)).toBe(h);
});

test('a new commit clears the redo stack', () => {
    let h = commit(createHistory(base), setTitle(base, 'b'));
    h = undo(h);
    h = commit(h, setTitle(base, 'c'));
    expect(canRedo(h)).toBe(false);
});

test('a gesture with many updates is one undo step', () => {
    let h = beginGesture(createHistory(base));
    for (const t of ['x', 'xy', 'xyz']) h = updateGesture(h, setTitle(h.present, t));
    h = endGesture(h);
    expect(h.past).toHaveLength(1);
    expect(undo(h).present).toBe(base);
});

test('a cancelled gesture leaves no trace', () => {
    let h = beginGesture(createHistory(base));
    h = updateGesture(h, setTitle(base, 'moved'));
    h = cancelGesture(h);
    expect(h.present).toBe(base);
    expect(canUndo(h)).toBe(false);
});

test('a gesture that changed nothing records nothing', () => {
    const h = endGesture(beginGesture(createHistory(base)));
    expect(canUndo(h)).toBe(false);
});

test('undo during a gesture ends it first', () => {
    let h = commit(createHistory(base), setTitle(base, 'b'));
    h = beginGesture(h);
    h = updateGesture(h, setTitle(h.present, 'c'));
    h = undo(h);
    expect(h.present.title).toBe('b');
    expect(h.gestureBase).toBeNull();
});

test('amend replaces the present without an undo step', () => {
    const h = amend(createHistory(base), setTitle(base, 'derived'));
    expect(h.present.title).toBe('derived');
    expect(canUndo(h)).toBe(false);
});

test('history is capped', () => {
    let h = createHistory(base);
    for (let i = 0; i < HISTORY_LIMIT + 50; i++) h = commit(h, setTitle(h.present, String(i)));
    expect(h.past).toHaveLength(HISTORY_LIMIT);
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run app/src/model/history.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement history**

`app/src/model/history.ts`:
```ts
import type { CheatDocument } from './types';

export const HISTORY_LIMIT = 200;

export interface History {
    past: CheatDocument[];
    present: CheatDocument;
    future: CheatDocument[];
    /** Document at the start of the current drag, crop or resize; null when no gesture is running. */
    gestureBase: CheatDocument | null;
}

export function createHistory(doc: CheatDocument): History {
    return { past: [], present: doc, future: [], gestureBase: null };
}

function pushPast(past: CheatDocument[], doc: CheatDocument): CheatDocument[] {
    const next = [...past, doc];
    return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

export function commit(h: History, next: CheatDocument): History {
    if (h.gestureBase) return updateGesture(h, next);
    if (next === h.present) return h;
    return { past: pushPast(h.past, h.present), present: next, future: [], gestureBase: null };
}

/** Replace the present without recording a step (derived data such as measured text heights). */
export function amend(h: History, next: CheatDocument): History {
    return next === h.present ? h : { ...h, present: next };
}

export function beginGesture(h: History): History {
    return h.gestureBase ? h : { ...h, gestureBase: h.present };
}

export function updateGesture(h: History, next: CheatDocument): History {
    return next === h.present ? h : { ...h, present: next };
}

export function endGesture(h: History): History {
    const base = h.gestureBase;
    if (!base) return h;
    if (base === h.present) return { ...h, gestureBase: null };
    return { past: pushPast(h.past, base), present: h.present, future: [], gestureBase: null };
}

export function cancelGesture(h: History): History {
    return h.gestureBase ? { ...h, present: h.gestureBase, gestureBase: null } : h;
}

export const canUndo = (h: History) => h.past.length > 0 || (h.gestureBase !== null && h.gestureBase !== h.present);
export const canRedo = (h: History) => h.future.length > 0;

export function undo(h: History): History {
    const ended = endGesture(h);
    if (ended.past.length === 0) return ended;
    const prev = ended.past[ended.past.length - 1];
    return { past: ended.past.slice(0, -1), present: prev, future: [ended.present, ...ended.future], gestureBase: null };
}

export function redo(h: History): History {
    const ended = endGesture(h);
    if (ended.future.length === 0) return ended;
    const [next, ...rest] = ended.future;
    return { past: pushPast(ended.past, ended.present), present: next, future: rest, gestureBase: null };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run app/src/model`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/model
git commit -m "feat(model): undo and redo with gesture coalescing"
```

---
### Task 5: MaxRects packing and auto-pack

**Files:**
- Create: `app/src/model/pack.ts`, `app/src/model/layout.ts`
- Test: `app/src/model/pack.test.ts`, `app/src/model/layout.test.ts`

**Interfaces:**
- Consumes: `rectsIntersect`, `rectContains`, `boxBounds` (Task 2), `setItemBox` (Task 3), `printableArea` (Task 2), `newId`.
- Produces: `PackBox {id, w, h}`, `Placement {id, x, y, w, h, bin}`, `Heuristic = 'topLeft' | 'bestShortSide'`, `maxRectsPack(boxes, binW, binH, gap, heuristic)`, `arrange(boxes, binW, binH, gap): Placement[]`, `fitScale(boxes, binW, binH, gap): {scale, placements} | null`; `PackMode = 'arrange' | 'fit'`, `isPackable(item)`, `packPage(doc, pageIndex, ids | null, mode, gap): CheatDocument`.

- [ ] **Step 1: Write failing packer tests**

`app/src/model/pack.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { arrange, fitScale, maxRectsPack, type Placement } from './pack';

function assertValid(placed: Placement[], binW: number, binH: number, gap: number) {
    for (const p of placed) {
        expect(p.x).toBeGreaterThanOrEqual(-1e-6);
        expect(p.y).toBeGreaterThanOrEqual(-1e-6);
        expect(p.x + p.w).toBeLessThanOrEqual(binW + 1e-6);
        expect(p.y + p.h).toBeLessThanOrEqual(binH + 1e-6);
    }
    for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
            const a = placed[i], b = placed[j];
            if (a.bin !== b.bin) continue;
            const apart = a.x + a.w + gap <= b.x + 1e-6 || b.x + b.w + gap <= a.x + 1e-6
                || a.y + a.h + gap <= b.y + 1e-6 || b.y + b.h + gap <= a.y + 1e-6;
            expect(apart, `${a.id} and ${b.id} overlap`).toBe(true);
        }
    }
}

// Deterministic pseudo-random sizes so failures reproduce.
function boxes(n: number, seed = 7) {
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: n }, (_, i) => ({ id: `b${i}`, w: 20 + rnd() * 120, h: 15 + rnd() * 90 }));
}

describe('maxRectsPack', () => {
    test.each(['topLeft', 'bestShortSide'] as const)('%s places without overlap and keeps the gap', (h) => {
        const { placed, rest } = maxRectsPack(boxes(30), 500, 700, 4, h);
        expect(placed.length + rest.length).toBe(30);
        assertValid(placed, 500, 700, 4);
    });
    test('the first box goes to the top-left corner', () => {
        const { placed } = maxRectsPack([{ id: 'a', w: 10, h: 10 }], 100, 100, 0, 'topLeft');
        expect(placed[0]).toMatchObject({ x: 0, y: 0 });
    });
});

describe('arrange', () => {
    test('spills onto further bins', () => {
        const out = arrange([{ id: 'a', w: 60, h: 60 }, { id: 'b', w: 60, h: 60 }, { id: 'c', w: 60, h: 60 }], 100, 100, 0);
        expect(out.map((p) => p.bin).sort()).toEqual([0, 1, 2]);
    });
    test('shrinks a box that is larger than the bin', () => {
        const [p] = arrange([{ id: 'a', w: 200, h: 50 }], 100, 100, 0);
        expect(p.w).toBeCloseTo(100);
        expect(p.h).toBeCloseTo(25);
    });
    test('places everything validly', () => {
        const out = arrange(boxes(60), 400, 400, 3);
        expect(out).toHaveLength(60);
        assertValid(out, 400, 400, 3);
    });
});

describe('fitScale', () => {
    test('two squares in a square bin scale to half the side', () => {
        const r = fitScale([{ id: 'a', w: 10, h: 10 }, { id: 'b', w: 10, h: 10 }], 100, 100, 0)!;
        expect(r.scale).toBeCloseTo(5, 2);
        assertValid(r.placements, 100, 100, 0);
    });
    test('shrinks when the boxes do not fit', () => {
        const r = fitScale(boxes(40), 300, 300, 2)!;
        expect(r.scale).toBeLessThan(1);
        expect(r.placements).toHaveLength(40);
        assertValid(r.placements, 300, 300, 2);
    });
    test('returns null for an empty list', () => {
        expect(fitScale([], 100, 100, 0)).toBeNull();
    });
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run app/src/model/pack.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the packer**

`app/src/model/pack.ts`:
```ts
import { rectsIntersect } from './geometry';
import type { Id, Rect } from './types';

export interface PackBox {
    id: Id;
    w: number;
    h: number;
}

export interface Placement {
    id: Id;
    x: number;
    y: number;
    w: number;
    h: number;
    bin: number;
}

export type Heuristic = 'topLeft' | 'bestShortSide';

const EPS = 1e-6;

function contains(o: Rect, r: Rect): boolean {
    return r.x >= o.x - EPS && r.y >= o.y - EPS && r.x + r.w <= o.x + o.w + EPS && r.y + r.h <= o.y + o.h + EPS;
}

function splitFree(free: Rect[], used: Rect): Rect[] {
    const out: Rect[] = [];
    for (const f of free) {
        if (!rectsIntersect(f, used)) {
            out.push(f);
            continue;
        }
        if (used.x > f.x) out.push({ x: f.x, y: f.y, w: used.x - f.x, h: f.h });
        if (used.x + used.w < f.x + f.w) out.push({ x: used.x + used.w, y: f.y, w: f.x + f.w - used.x - used.w, h: f.h });
        if (used.y > f.y) out.push({ x: f.x, y: f.y, w: f.w, h: used.y - f.y });
        if (used.y + used.h < f.y + f.h) out.push({ x: f.x, y: used.y + used.h, w: f.w, h: f.y + f.h - used.y - used.h });
    }
    // Drop free rectangles contained in another; of two equal ones keep the first.
    return out.filter((r, i) => !out.some((o, j) => j !== i && contains(o, r) && (!contains(r, o) || j < i)));
}

function score(f: Rect, bw: number, bh: number, h: Heuristic): [number, number, number] {
    if (h === 'topLeft') return [f.y, f.x, 0];
    const dw = f.w - bw, dh = f.h - bh;
    return [Math.min(dw, dh), Math.max(dw, dh), f.y];
}

function better(a: [number, number, number], b: [number, number, number]): boolean {
    for (let i = 0; i < 3; i++) {
        if (a[i] < b[i] - EPS) return true;
        if (a[i] > b[i] + EPS) return false;
    }
    return false;
}

/**
 * Pack into one bin. Each box reserves `gap` on its right and bottom, and the
 * bin is enlarged by `gap`, so boxes end up `gap` apart and flush with the edges.
 */
export function maxRectsPack(boxes: PackBox[], binW: number, binH: number, gap: number, heuristic: Heuristic) {
    let free: Rect[] = [{ x: 0, y: 0, w: binW + gap, h: binH + gap }];
    const placed: Placement[] = [];
    const rest: PackBox[] = [];
    const order = [...boxes].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);
    for (const box of order) {
        const bw = box.w + gap, bh = box.h + gap;
        let best: Rect | null = null;
        let bestScore: [number, number, number] = [Infinity, Infinity, Infinity];
        for (const f of free) {
            if (bw > f.w + EPS || bh > f.h + EPS) continue;
            const s = score(f, bw, bh, heuristic);
            if (!best || better(s, bestScore)) {
                best = f;
                bestScore = s;
            }
        }
        if (!best) {
            rest.push(box);
            continue;
        }
        free = splitFree(free, { x: best.x, y: best.y, w: bw, h: bh });
        placed.push({ id: box.id, x: best.x, y: best.y, w: box.w, h: box.h, bin: 0 });
    }
    return { placed, rest };
}

/** Keep sizes (shrinking only boxes larger than a bin) and fill bins in order. */
export function arrange(boxes: PackBox[], binW: number, binH: number, gap: number): Placement[] {
    let remaining = boxes.map((b) => {
        const s = Math.min(1, binW / b.w, binH / b.h);
        return s < 1 ? { ...b, w: b.w * s, h: b.h * s } : b;
    });
    const out: Placement[] = [];
    for (let bin = 0; remaining.length > 0; bin++) {
        const { placed, rest } = maxRectsPack(remaining, binW, binH, gap, 'topLeft');
        if (placed.length === 0) break;
        out.push(...placed.map((p) => ({ ...p, bin })));
        remaining = rest;
    }
    return out;
}

/** Largest common scale at which every box fits in one bin. */
export function fitScale(boxes: PackBox[], binW: number, binH: number, gap: number): { scale: number; placements: Placement[] } | null {
    if (boxes.length === 0) return null;
    const area = boxes.reduce((a, b) => a + b.w * b.h, 0);
    let hi = Math.min(...boxes.map((b) => Math.min(binW / b.w, binH / b.h)), area > 0 ? Math.sqrt((binW * binH) / area) : Infinity);
    if (!Number.isFinite(hi) || hi <= 0) return null;
    const attempt = (s: number): Placement[] | null => {
        const scaled = boxes.map((b) => ({ ...b, w: b.w * s, h: b.h * s }));
        for (const h of ['topLeft', 'bestShortSide'] as const) {
            const r = maxRectsPack(scaled, binW, binH, gap, h);
            if (r.rest.length === 0) return r.placed;
        }
        return null;
    };
    const top = attempt(hi);
    if (top) return { scale: hi, placements: top };
    let lo = 0;
    let best: Placement[] | null = null;
    for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        const p = attempt(mid);
        if (p) {
            lo = mid;
            best = p;
        } else hi = mid;
    }
    return best ? { scale: lo, placements: best } : null;
}
```

- [ ] **Step 4: Run packer tests**

Run: `npx vitest run app/src/model/pack.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing auto-pack tests**

`app/src/model/layout.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { packPage } from './layout';
import { addItems } from './commands';
import { createDocument, createImageItem, createShapeItem, createStrokeItem, createTextItem } from './factory';
import { boxBounds, rectContains, rectsIntersect } from './geometry';
import { printableArea } from './pageSizes';
import type { CheatDocument, Item } from './types';

const asset = (w: number, h: number) => ({ id: `a${w}x${h}`, mime: 'image/png', width: w, height: h });
const area = printableArea(createDocument('t', 0).setup);

function noOverlap(items: Item[]) {
    for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++)
            expect(rectsIntersect(boxBounds(items[i]), boxBounds(items[j]))).toBe(false);
}

describe('packPage fit', () => {
    test('scales everything up to fill the printable area', () => {
        const a = createImageItem(asset(100, 100), { x: 100, y: 100 }, 1e6, 1e6);
        const b = createImageItem(asset(200, 100), { x: 300, y: 300 }, 1e6, 1e6);
        const doc = packPage(addItems(createDocument('t', 0), 0, [a, b]), 0, null, 'fit', 4);
        const items = doc.pages[0].items;
        for (const i of items) expect(rectContains(area, boxBounds(i), 0.01)).toBe(true);
        noOverlap(items);
        expect(items[0].w).toBeGreaterThan(a.w * 2);
        expect(items[0].w / items[0].h).toBeCloseTo(1);
    });
    test('an annotation inside an item moves and scales with it', () => {
        const a = createImageItem(asset(100, 100), { x: 300, y: 300 }, 1e6, 1e6);
        const s = createStrokeItem([a.x + 10, a.y + 10, 0.5, a.x + 30, a.y + 30, 0.5], 'pen', '#000', 2);
        const doc = packPage(addItems(createDocument('t', 0), 0, [a, s]), 0, null, 'fit', 4);
        const [img, stroke] = doc.pages[0].items;
        expect(rectContains(boxBounds(img), boxBounds(stroke), 0.01)).toBe(true);
        expect(stroke.w).toBeGreaterThan(s.w * 2);
    });
    test('text scales its font size', () => {
        const t = createTextItem({ x: 0, y: 0 }, { font: 'sans', fontSize: 10, color: '#000', background: null, align: 'left' }, 100, 'x');
        const doc = packPage(addItems(createDocument('t', 0), 0, [t]), 0, null, 'fit', 4);
        const out = doc.pages[0].items[0];
        expect(out.kind === 'text' && out.fontSize).toBeGreaterThan(20);
    });
});

describe('packPage arrange', () => {
    test('keeps sizes and spills onto a new page after the current one', () => {
        const items = [0, 1, 2].map(() => createImageItem(asset(533, 533), { x: 200, y: 200 }, 1e6, 1e6)); // 400 pt squares
        const base = addItems(createDocument('t', 0), 0, items);
        const doc = packPage(base, 0, null, 'arrange', 4);
        expect(doc.pages).toHaveLength(2);
        expect(doc.pages[0].items).toHaveLength(2);
        expect(doc.pages[1].items).toHaveLength(1);
        expect(doc.pages[0].items[0].w).toBeCloseTo(items[0].w);
        noOverlap(doc.pages[0].items);
    });
    test('locked items, lines and unselected items stay where they are', () => {
        const a = createImageItem(asset(100, 100), { x: 300, y: 300 }, 1e6, 1e6);
        const locked = { ...createImageItem(asset(100, 100), { x: 400, y: 600 }, 1e6, 1e6), locked: true };
        const line = createShapeItem('line', { x: 5, y: 5, w: 50, h: 0 }, { stroke: '#000', strokeWidth: 1, fill: null });
        const other = createImageItem(asset(50, 50), { x: 100, y: 700 }, 1e6, 1e6);
        const doc = packPage(addItems(createDocument('t', 0), 0, [a, locked, line, other]), 0, [a.id], 'arrange', 4);
        const [na, nl, nline, nother] = doc.pages[0].items;
        expect(na.x).toBeCloseTo(area.x);
        expect(nl).toBe(locked);
        expect(nline).toBe(line);
        expect(nother).toBe(other);
    });
    test('a page with nothing to pack is returned unchanged', () => {
        const doc = createDocument('t', 0);
        expect(packPage(doc, 0, null, 'fit', 4)).toBe(doc);
    });
});
```

- [ ] **Step 6: Run to see failures**

Run: `npx vitest run app/src/model/layout.test.ts`
Expected: FAIL, module `./layout` not found.

- [ ] **Step 7: Implement auto-pack**

`app/src/model/layout.ts`:
```ts
import { setItemBox } from './commands';
import { boxBounds, rectContains } from './geometry';
import { newId } from './ids';
import { arrange, fitScale, type Placement } from './pack';
import { printableArea } from './pageSizes';
import type { CheatDocument, Id, Item, Page, Rect } from './types';

export type PackMode = 'arrange' | 'fit';

export function isPackable(i: Item): boolean {
    if (i.locked) return false;
    return i.kind === 'image' || i.kind === 'text' || (i.kind === 'shape' && (i.shape === 'rect' || i.shape === 'ellipse'));
}

/** Map `item` so that the rectangle `from` lands on placement `to` inside `area`. */
function moveInto(item: Item, from: Rect, to: Placement, area: Rect): Item {
    const s = from.w > 0 ? to.w / from.w : from.h > 0 ? to.h / from.h : 1;
    const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
    const ncx = area.x + to.x + (cx - from.x) * s;
    const ncy = area.y + to.y + (cy - from.y) * s;
    const w = item.w * s, h = item.h * s;
    let out = setItemBox(item, { x: ncx - w / 2, y: ncy - h / 2, w, h, rotation: item.rotation });
    if (s !== 1) {
        if (out.kind === 'text') out = { ...out, fontSize: out.fontSize * s, padding: out.padding * s };
        else if (out.kind === 'stroke') out = { ...out, size: out.size * s };
    }
    return out;
}

export function packPage(doc: CheatDocument, pageIndex: number, ids: Id[] | null, mode: PackMode, gap: number): CheatDocument {
    const page = doc.pages[pageIndex];
    if (!page) return doc;
    const pick = ids ? new Set(ids) : null;
    const packed = page.items.filter((i) => isPackable(i) && (!pick || pick.has(i.id)));
    if (packed.length === 0) return doc;
    const bounds = new Map(packed.map((i) => [i.id, boxBounds(i)]));

    // Strokes, lines and arrows drawn inside one packed item travel with it.
    const owner = new Map<Id, Id>();
    for (const a of page.items) {
        if (isPackable(a) || a.locked || a.kind === 'image' || a.kind === 'text') continue;
        if (a.kind === 'shape' && (a.shape === 'rect' || a.shape === 'ellipse')) continue;
        const ab = boxBounds(a);
        let best: Rect | null = null;
        for (const p of packed) {
            const pb = bounds.get(p.id)!;
            if (rectContains(pb, ab, 1) && (!best || pb.w * pb.h < best.w * best.h)) {
                best = pb;
                owner.set(a.id, p.id);
            }
        }
    }

    const area = printableArea(doc.setup);
    const boxes = packed.map((i) => ({ id: i.id, w: bounds.get(i.id)!.w, h: bounds.get(i.id)!.h }));
    const fitted = mode === 'fit' ? fitScale(boxes, area.w, area.h, gap) : null;
    const placements = fitted ? fitted.placements : arrange(boxes, area.w, area.h, gap);
    const at = new Map(placements.map((p) => [p.id, p]));

    const moved = new Map<Id, { item: Item; bin: number }>();
    for (const i of page.items) {
        const ownerId = at.has(i.id) ? i.id : owner.get(i.id);
        const p = ownerId ? at.get(ownerId) : undefined;
        if (!ownerId || !p) continue;
        moved.set(i.id, { item: moveInto(i, bounds.get(ownerId)!, p, area), bin: p.bin });
    }

    const binCount = Math.max(...placements.map((p) => p.bin)) + 1;
    const onBin = (b: number) => page.items.flatMap((i) => {
        const m = moved.get(i.id);
        if (!m) return b === 0 ? [i] : [];
        return m.bin === b ? [m.item] : [];
    });
    const newPages: Page[] = [{ ...page, items: onBin(0) }];
    for (let b = 1; b < binCount; b++) newPages.push({ id: newId(), items: onBin(b) });
    const pages = [...doc.pages];
    pages.splice(pageIndex, 1, ...newPages);
    return { ...doc, pages };
}
```

- [ ] **Step 8: Run tests**

Run: `npx vitest run app/src/model`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/src/model
git commit -m "feat(model): MaxRects auto-pack with arrange and fit-to-page modes"
```

---

### Task 6: Snapping, align, distribute and print check

**Files:**
- Create: `app/src/model/snap.ts`, `app/src/model/printCheck.ts`
- Modify: `app/src/model/layout.ts` (add align and distribute)
- Test: `app/src/model/snap.test.ts`, `app/src/model/printCheck.test.ts`, `app/src/model/align.test.ts`

**Interfaces:**
- Consumes: `pageDimensions`, `printableArea`, `columnGuides`, `boxBounds`, `unionRect`, `translateItems`, `findItem`.
- Produces: `SnapTargets {xs, ys}`, `snapTargets(setup, others: Rect[])`, `SnapResult {dx, dy, guideX, guideY}`, `snapRect(rect, targets, threshold, grid)`, `snapValue(v, targets: number[], threshold, grid)`: `{value, guide}`; `AlignMode`, `alignItems(doc, ids, mode)`, `distributeItems(doc, ids, axis)`; `PrintIssue`, `MIN_DPI = 150`, `MIN_TEXT_PT = 5`, `effectiveDpi(item)`, `printCheck(doc): PrintIssue[]`.

- [ ] **Step 1: Write failing tests**

`app/src/model/snap.test.ts`:
```ts
import { expect, test } from 'vitest';
import { snapRect, snapTargets, snapValue } from './snap';
import { DEFAULT_SETUP } from './factory';

const setup = { ...DEFAULT_SETUP, size: 'Letter' as const, margin: 36, columns: 2, gutter: 20 };

test('targets include page edges, centre, margins, columns and other items', () => {
    const t = snapTargets(setup, [{ x: 100, y: 200, w: 50, h: 10 }]);
    for (const x of [0, 306, 612, 36, 576, 296, 316, 100, 125, 150]) expect(t.xs).toContain(x);
    for (const y of [0, 396, 792, 36, 756, 200, 205, 210]) expect(t.ys).toContain(y);
});

test('snapRect pulls the nearest edge or centre within the threshold', () => {
    const t = snapTargets(setup, []);
    const r = snapRect({ x: 39, y: 100.5, w: 100, h: 50 }, t, 5, 0);
    expect(r.dx).toBeCloseTo(-3);
    expect(r.guideX).toBe(36);
    expect(r.dy).toBe(0);
    expect(r.guideY).toBeNull();
    const centred = snapRect({ x: 254, y: 0, w: 100, h: 50 }, t, 5, 0);
    expect(centred.dx).toBeCloseTo(2);
    expect(centred.guideX).toBe(306);
});

test('the grid applies when no guide is close', () => {
    const r = snapRect({ x: 103, y: 110, w: 10, h: 10 }, { xs: [], ys: [] }, 2, 12);
    expect(r.dx).toBeCloseTo(5);
    expect(r.dy).toBeCloseTo(-2);
});

test('snapValue for a single edge', () => {
    expect(snapValue(98, [100], 3, 0)).toEqual({ value: 100, guide: 100 });
    expect(snapValue(90, [100], 3, 0)).toEqual({ value: 90, guide: null });
});
```

`app/src/model/align.test.ts`:
```ts
import { expect, test } from 'vitest';
import { alignItems, distributeItems } from './layout';
import { addItems } from './commands';
import { createDocument, createShapeItem } from './factory';

const sq = (x: number, y: number, w = 10) => createShapeItem('rect', { x, y, w, h: w }, { stroke: '#000', strokeWidth: 1, fill: null });

test('align left lines items up with the leftmost one', () => {
    const [a, b] = [sq(10, 0), sq(50, 40)];
    const doc = alignItems(addItems(createDocument('t', 0), 0, [a, b]), [a.id, b.id], 'left');
    expect(doc.pages[0].items.map((i) => i.x)).toEqual([10, 10]);
});

test('a single item aligns to the printable area', () => {
    const a = sq(100, 100);
    const doc = alignItems(addItems(createDocument('t', 0), 0, [a]), [a.id], 'right');
    expect(doc.pages[0].items[0].x + 10).toBeCloseTo(595.2756 - 18);
});

test('distribute spaces three items evenly', () => {
    const [a, b, c] = [sq(0, 0), sq(15, 0), sq(90, 0)];
    const doc = distributeItems(addItems(createDocument('t', 0), 0, [a, b, c]), [a.id, b.id, c.id], 'h');
    expect(doc.pages[0].items.map((i) => i.x)).toEqual([0, 45, 90]);
});
```

`app/src/model/printCheck.test.ts`:
```ts
import { expect, test } from 'vitest';
import { effectiveDpi, printCheck } from './printCheck';
import { addItems } from './commands';
import { createDocument, createImageItem, createTextItem } from './factory';

test('effective DPI is source pixels per inch on paper', () => {
    const img = { ...createImageItem({ id: 'a', mime: 'image/png', width: 300, height: 300 }, { x: 0, y: 0 }, 1e6, 1e6), w: 72, h: 144 };
    expect(effectiveDpi(img)).toBe(150);
});

test('flags blurry images and tiny text, nothing else', () => {
    const blurry = { ...createImageItem({ id: 'a', mime: 'image/png', width: 100, height: 100 }, { x: 0, y: 0 }, 1e6, 1e6), w: 144, h: 144 };
    const sharp = createImageItem({ id: 'b', mime: 'image/png', width: 1000, height: 1000 }, { x: 0, y: 0 }, 100, 100);
    const style = { font: 'sans' as const, color: '#000', background: null, align: 'left' as const };
    const tiny = createTextItem({ x: 0, y: 0 }, { ...style, fontSize: 4 }, 50, 'x');
    const fine = createTextItem({ x: 0, y: 0 }, { ...style, fontSize: 8 }, 50, 'x');
    const issues = printCheck(addItems(createDocument('t', 0), 0, [blurry, sharp, tiny, fine]));
    expect(issues.map((i) => [i.itemId, i.kind])).toEqual([[blurry.id, 'low-dpi'], [tiny.id, 'small-text']]);
    expect(issues[0].message).toContain('50 DPI');
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run app/src/model`
Expected: FAIL in the three new files.

- [ ] **Step 3: Implement snapping**

`app/src/model/snap.ts`:
```ts
import { columnGuides, pageDimensions } from './pageSizes';
import type { PageSetup, Rect } from './types';

export interface SnapTargets {
    xs: number[];
    ys: number[];
}

export function snapTargets(setup: PageSetup, others: Rect[]): SnapTargets {
    const { w, h } = pageDimensions(setup);
    const m = setup.margin;
    const xs = [0, w / 2, w, m, w - m, ...columnGuides(setup)];
    const ys = [0, h / 2, h, m, h - m];
    for (const r of others) {
        xs.push(r.x, r.x + r.w / 2, r.x + r.w);
        ys.push(r.y, r.y + r.h / 2, r.y + r.h);
    }
    return { xs, ys };
}

function nearest(candidates: number[], targets: number[], threshold: number): { delta: number; guide: number } | null {
    let best: { delta: number; guide: number } | null = null;
    for (const c of candidates) {
        for (const t of targets) {
            const d = t - c;
            if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, guide: t };
        }
    }
    return best;
}

const toGrid = (v: number, grid: number) => Math.round(v / grid) * grid - v;

export interface SnapResult {
    dx: number;
    dy: number;
    guideX: number | null;
    guideY: number | null;
}

export function snapRect(r: Rect, t: SnapTargets, threshold: number, grid: number): SnapResult {
    const sx = nearest([r.x, r.x + r.w / 2, r.x + r.w], t.xs, threshold);
    const sy = nearest([r.y, r.y + r.h / 2, r.y + r.h], t.ys, threshold);
    return {
        dx: sx ? sx.delta : grid > 0 ? toGrid(r.x, grid) : 0,
        dy: sy ? sy.delta : grid > 0 ? toGrid(r.y, grid) : 0,
        guideX: sx ? sx.guide : null,
        guideY: sy ? sy.guide : null,
    };
}

export function snapValue(v: number, targets: number[], threshold: number, grid: number): { value: number; guide: number | null } {
    const s = nearest([v], targets, threshold);
    if (s) return { value: v + s.delta, guide: s.guide };
    return { value: grid > 0 ? v + toGrid(v, grid) : v, guide: null };
}
```

- [ ] **Step 4: Implement align and distribute (append to `app/src/model/layout.ts`)**

```ts
import { findItem, translateItems } from './commands';
import { unionRect } from './geometry';

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

export function alignItems(doc: CheatDocument, ids: Id[], mode: AlignMode): CheatDocument {
    const found = ids.map((id) => findItem(doc, id)).filter((f): f is NonNullable<typeof f> => f !== null && !f.item.locked);
    if (found.length === 0) return doc;
    const target = found.length === 1 ? printableArea(doc.setup) : unionRect(found.map((f) => boxBounds(f.item)))!;
    let out = doc;
    for (const f of found) {
        const b = boxBounds(f.item);
        let dx = 0, dy = 0;
        if (mode === 'left') dx = target.x - b.x;
        if (mode === 'hcenter') dx = target.x + target.w / 2 - (b.x + b.w / 2);
        if (mode === 'right') dx = target.x + target.w - (b.x + b.w);
        if (mode === 'top') dy = target.y - b.y;
        if (mode === 'vcenter') dy = target.y + target.h / 2 - (b.y + b.h / 2);
        if (mode === 'bottom') dy = target.y + target.h - (b.y + b.h);
        out = translateItems(out, [f.item.id], dx, dy);
    }
    return out;
}

export function distributeItems(doc: CheatDocument, ids: Id[], axis: 'h' | 'v'): CheatDocument {
    const found = ids.map((id) => findItem(doc, id)).filter((f): f is NonNullable<typeof f> => f !== null && !f.item.locked);
    if (found.length < 3) return doc;
    const withBounds = found.map((f) => ({ id: f.item.id, b: boxBounds(f.item) }));
    const start = (r: Rect) => (axis === 'h' ? r.x : r.y);
    const size = (r: Rect) => (axis === 'h' ? r.w : r.h);
    withBounds.sort((a, b) => start(a.b) - start(b.b));
    const first = withBounds[0].b, last = withBounds[withBounds.length - 1].b;
    const span = start(last) + size(last) - start(first);
    const total = withBounds.reduce((a, x) => a + size(x.b), 0);
    const gap = (span - total) / (withBounds.length - 1);
    let cursor = start(first);
    let out = doc;
    for (const { id, b } of withBounds) {
        const d = cursor - start(b);
        out = axis === 'h' ? translateItems(out, [id], d, 0) : translateItems(out, [id], 0, d);
        cursor += size(b) + gap;
    }
    return out;
}
```

Merge the two new imports into the existing import lines at the top of `layout.ts` (`findItem, setItemBox, translateItems` from `./commands`; `boxBounds, rectContains, unionRect` from `./geometry`).

- [ ] **Step 5: Implement print check**

`app/src/model/printCheck.ts`:
```ts
import type { CheatDocument, Id, ImageItem } from './types';

export const MIN_DPI = 150;
export const MIN_TEXT_PT = 5;

export interface PrintIssue {
    itemId: Id;
    pageIndex: number;
    kind: 'low-dpi' | 'small-text';
    value: number;
    message: string;
}

export function effectiveDpi(item: Pick<ImageItem, 'crop' | 'w' | 'h'>): number {
    const dx = item.w > 0 ? item.crop.w / (item.w / 72) : Infinity;
    const dy = item.h > 0 ? item.crop.h / (item.h / 72) : Infinity;
    return Math.min(dx, dy);
}

export function printCheck(doc: CheatDocument): PrintIssue[] {
    const out: PrintIssue[] = [];
    doc.pages.forEach((page, pageIndex) => {
        for (const item of page.items) {
            if (item.kind === 'image') {
                const dpi = effectiveDpi(item);
                if (dpi < MIN_DPI) {
                    out.push({
                        itemId: item.id, pageIndex, kind: 'low-dpi', value: dpi,
                        message: `Prints at ${Math.round(dpi)} DPI and may look blurry. Make it smaller or use a sharper source.`,
                    });
                }
            } else if (item.kind === 'text' && item.fontSize < MIN_TEXT_PT) {
                out.push({
                    itemId: item.id, pageIndex, kind: 'small-text', value: item.fontSize,
                    message: `Text is ${item.fontSize.toFixed(1)} pt; under ${MIN_TEXT_PT} pt is hard to read on paper.`,
                });
            }
        }
    });
    return out;
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run app/src/model`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/model
git commit -m "feat(model): snapping, align, distribute and print check"
```

---

### Task 7: Hashing, image sizes, the .cheatsheet format and legacy import

**Files:**
- Create: `app/src/model/hash.ts`, `app/src/model/imageSize.ts`, `app/src/model/format.ts`, `app/src/model/legacy.ts`, `app/src/test/fixtures/legacy-autosave.json`
- Test: `app/src/model/hash.test.ts`, `app/src/model/imageSize.test.ts`, `app/src/model/format.test.ts`, `app/src/model/legacy.test.ts`

**Interfaces:**
- Consumes: types, factories, `addItems`, `addAsset`, `referencedAssetIds`.
- Produces: `sha256Hex(bytes): Promise<string>`, `sha256Sync(bytes): Uint8Array`; `readPngSize(bytes)`, `sniffImageMime(bytes)`, `MAX_IMAGE_SIDE = 4096`, `downscaleSize(w, h, max?)`; `FormatError`, `FILE_EXTENSION = '.cheatsheet'`, `extForMime(mime)`, `validateDocument(json)`, `AssetBytes = Map<Id, {bytes, mime}>`, `packCheatsheet(doc, assets: AssetBytes): Uint8Array`, `unpackCheatsheet(bytes): {doc, assets}`; `importLegacyAutosave(text, title?): Promise<{doc, assets}>`.

- [ ] **Step 1: Write the legacy fixture**

`app/src/test/fixtures/legacy-autosave.json` (the exact shape `src/serialize.c` wrote, with a 1 x 1 PNG):
```json
{
  "current_page" : 0,
  "pages" : [
    {
      "items" : [
        {
          "image_data" : "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
          "x" : 10.0,
          "y" : 20.0,
          "width" : 100.0,
          "height" : 50.0,
          "crop_x" : 0,
          "crop_y" : 0,
          "crop_w" : 1,
          "crop_h" : 1
        }
      ],
      "strokes" : [
        {
          "r" : 1.0,
          "g" : 0.0,
          "b" : 0.0,
          "a" : 0.5,
          "width" : 3.0,
          "points" : [ { "x" : 0.0, "y" : 0.0 }, { "x" : 10.0, "y" : 10.0 } ]
        }
      ]
    },
    { "items" : [], "strokes" : [] }
  ]
}
```

- [ ] **Step 2: Write failing tests**

`app/src/model/hash.test.ts`:
```ts
import { expect, test } from 'vitest';
import { sha256Hex, sha256Sync } from './hash';

const abc = new TextEncoder().encode('abc');
const ABC_HASH = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

test('sha256Hex matches the standard test vector', async () => {
    expect(await sha256Hex(abc)).toBe(ABC_HASH);
});

test('the fallback agrees with WebCrypto, including multi-block input', async () => {
    const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    expect(hex(sha256Sync(abc))).toBe(ABC_HASH);
    const long = new Uint8Array(1000).map((_, i) => i % 251);
    expect(hex(sha256Sync(long))).toBe(await sha256Hex(long));
});
```

`app/src/model/imageSize.test.ts`:
```ts
import { expect, test } from 'vitest';
import { downscaleSize, readPngSize, sniffImageMime } from './imageSize';

const PNG_1x1 = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

test('reads PNG dimensions and rejects other bytes', () => {
    expect(readPngSize(PNG_1x1)).toEqual({ width: 1, height: 1 });
    expect(readPngSize(new Uint8Array([1, 2, 3]))).toBeNull();
});

test('sniffs common image types', () => {
    expect(sniffImageMime(PNG_1x1)).toBe('image/png');
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImageMime(new TextEncoder().encode('RIFF\0\0\0\0WEBP'))).toBe('image/webp');
    expect(sniffImageMime(new Uint8Array([0]))).toBeNull();
});

test('downscales only past the limit and keeps the aspect ratio', () => {
    expect(downscaleSize(800, 600)).toEqual({ width: 800, height: 600, scale: 1 });
    expect(downscaleSize(8000, 6000)).toEqual({ width: 4096, height: 3072, scale: 0.512 });
    expect(downscaleSize(10, 20000).height).toBe(4096);
});
```

`app/src/model/format.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { FormatError, packCheatsheet, unpackCheatsheet, validateDocument } from './format';
import { addAsset, addItems } from './commands';
import { createDocument, createImageItem, createShapeItem, createStrokeItem, createTextItem } from './factory';

const asset = { id: 'f'.repeat(64), mime: 'image/png', width: 4, height: 4 };
const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);

function sample() {
    const doc = createDocument('Round trip', 5);
    const items = [
        createImageItem(asset, { x: 50, y: 50 }, 100, 100),
        createTextItem({ x: 0, y: 0 }, { font: 'mono', fontSize: 9, color: '#112233', background: '#ffff00', align: 'center' }, 80, '**hi** $x^2$'),
        createShapeItem('arrow', { x: 1, y: 2, w: 3, h: 4 }, { stroke: '#000', strokeWidth: 2, fill: null }, true, false),
        createStrokeItem([0, 0, 0.5, 5, 5, 0.7], 'highlighter', '#ffd43b80', 12),
    ];
    return addAsset(addItems(doc, 0, items), asset);
}

describe('.cheatsheet', () => {
    test('round trips a document and its assets', () => {
        const doc = sample();
        const out = unpackCheatsheet(packCheatsheet(doc, new Map([[asset.id, { bytes, mime: 'image/png' }]])));
        expect(out.doc).toEqual(doc);
        expect(out.assets.get(asset.id)).toEqual({ bytes, mime: 'image/png' });
    });
    test('refuses to pack when an asset is missing', () => {
        expect(() => packCheatsheet(sample(), new Map())).toThrow(FormatError);
    });
    test('rejects a newer format version with a clear message', () => {
        const zip = zipSync({ 'document.json': strToU8(JSON.stringify({ ...sample(), version: 2 })) });
        expect(() => unpackCheatsheet(zip)).toThrow(/newer version/);
    });
    test('rejects a zip without a document and bytes that are not a zip', () => {
        expect(() => unpackCheatsheet(zipSync({ 'x.txt': strToU8('x') }))).toThrow(FormatError);
        expect(() => unpackCheatsheet(new Uint8Array([1, 2, 3, 4]))).toThrow(FormatError);
    });
});

describe('validateDocument', () => {
    test('rejects unknown item kinds and bad numbers', () => {
        const doc = sample();
        const bad = { ...doc, pages: [{ id: 'p', items: [{ ...doc.pages[0].items[0], kind: 'video' }] }] };
        expect(() => validateDocument(bad)).toThrow(FormatError);
        const nan = { ...doc, pages: [{ id: 'p', items: [{ ...doc.pages[0].items[0], x: 'left' }] }] };
        expect(() => validateDocument(nan)).toThrow(FormatError);
    });
    test('rejects non-objects', () => {
        expect(() => validateDocument(null)).toThrow(/Not a Cheatsheet Maker document/);
    });
});
```

`app/src/model/legacy.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { importLegacyAutosave } from './legacy';
import { FormatError } from './format';

const fixture = readFileSync(new URL('../test/fixtures/legacy-autosave.json', import.meta.url), 'utf8');

test('maps the GTK autosave onto version 1', async () => {
    const { doc, assets } = await importLegacyAutosave(fixture, 'Old sheet');
    expect(doc.title).toBe('Old sheet');
    expect(doc.setup.size).toBe('A4');
    expect(doc.pages).toHaveLength(2);
    const [img, stroke] = doc.pages[0].items;
    expect(img).toMatchObject({ kind: 'image', x: 10, y: 20, w: 100, h: 50, crop: { x: 0, y: 0, w: 1, h: 1 } });
    expect(stroke).toMatchObject({ kind: 'stroke', tool: 'pen', color: '#ff000080', size: 3 });
    expect(img.kind === 'image' && doc.assets[img.assetId]).toMatchObject({ mime: 'image/png', width: 1, height: 1 });
    expect(assets.size).toBe(1);
});

test('rejects JSON that is not an autosave', async () => {
    await expect(importLegacyAutosave('{"hello": 1}')).rejects.toThrow(FormatError);
    await expect(importLegacyAutosave('not json')).rejects.toThrow(FormatError);
});
```

- [ ] **Step 3: Run to see failures**

Run: `npx vitest run app/src/model`
Expected: FAIL in the four new test files.

- [ ] **Step 4: Implement hashing**

`app/src/model/hash.ts`:
```ts
const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Plain SHA-256 for contexts without WebCrypto (non-secure origins). */
export function sha256Sync(data: Uint8Array): Uint8Array {
    const bitLen = data.length * 8;
    const padded = new Uint8Array(((data.length + 9 + 63) >> 6) << 6);
    padded.set(data);
    padded[data.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor(bitLen / 2 ** 32));
    view.setUint32(padded.length - 4, bitLen >>> 0);
    const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const w = new Uint32Array(64);
    const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < padded.length; off += 64) {
        for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
        for (let i = 16; i < 64; i++) {
            const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
        }
        let [a, b, c, d, e, f, g, hh] = h;
        for (let i = 0; i < 64; i++) {
            const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
            const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
            hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
    }
    const out = new Uint8Array(32);
    const ov = new DataView(out.buffer);
    h.forEach((v, i) => ov.setUint32(i * 4, v));
    return out;
}

function toHex(b: Uint8Array): string {
    let s = '';
    for (const x of b) s += x.toString(16).padStart(2, '0');
    return s;
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
    const subtle = globalThis.crypto?.subtle;
    if (subtle) return toHex(new Uint8Array(await subtle.digest('SHA-256', data)));
    return toHex(sha256Sync(data));
}
```

- [ ] **Step 5: Implement image sizes**

`app/src/model/imageSize.ts`:
```ts
export const MAX_IMAGE_SIDE = 4096;

export function readPngSize(b: Uint8Array): { width: number; height: number } | null {
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    if (b.length < 24 || sig.some((v, i) => b[i] !== v)) return null;
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { width: v.getUint32(16), height: v.getUint32(20) };
}

export function sniffImageMime(b: Uint8Array): string | null {
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp';
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
    return null;
}

export function downscaleSize(width: number, height: number, max = MAX_IMAGE_SIDE) {
    const scale = Math.min(1, max / Math.max(width, height));
    return { width: Math.round(width * scale), height: Math.round(height * scale), scale };
}
```

- [ ] **Step 6: Implement the file format**

`app/src/model/format.ts`:
```ts
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { referencedAssetIds } from './commands';
import type { AssetMeta, CheatDocument, Id, Item, Page, PageSetup } from './types';

export class FormatError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FormatError';
    }
}

export const FILE_EXTENSION = '.cheatsheet';
export type AssetBytes = Map<Id, { bytes: Uint8Array; mime: string }>;

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const MIME: Record<string, string> = Object.fromEntries(Object.entries(EXT).map(([m, e]) => [e, m]));

export function extForMime(mime: string): string {
    return EXT[mime] ?? 'bin';
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function num(o: Obj, k: string, where: string): number {
    const v = o[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new FormatError(`${where}: "${k}" is not a number.`);
    return v;
}
function str(o: Obj, k: string, where: string): string {
    const v = o[k];
    if (typeof v !== 'string') throw new FormatError(`${where}: "${k}" is not text.`);
    return v;
}
function bool(o: Obj, k: string, where: string): boolean {
    const v = o[k];
    if (typeof v !== 'boolean') throw new FormatError(`${where}: "${k}" is not true or false.`);
    return v;
}
function oneOf<T extends string>(o: Obj, k: string, allowed: readonly T[], where: string): T {
    const v = o[k];
    if (typeof v !== 'string' || !allowed.includes(v as T)) throw new FormatError(`${where}: "${k}" has an unknown value.`);
    return v as T;
}
const nullableStr = (o: Obj, k: string, where: string) => (o[k] === null ? null : str(o, k, where));

function rect(v: unknown, where: string) {
    if (!isObj(v)) throw new FormatError(`${where}: missing rectangle.`);
    return { x: num(v, 'x', where), y: num(v, 'y', where), w: num(v, 'w', where), h: num(v, 'h', where) };
}

function item(v: unknown, where: string): Item {
    if (!isObj(v)) throw new FormatError(`${where} is not an object.`);
    const base = {
        id: str(v, 'id', where),
        x: num(v, 'x', where), y: num(v, 'y', where), w: num(v, 'w', where), h: num(v, 'h', where),
        rotation: num(v, 'rotation', where),
        ...(v.locked === true ? { locked: true } : {}),
    };
    switch (v.kind) {
        case 'image': {
            const f = v.filters;
            if (!isObj(f)) throw new FormatError(`${where}: missing filters.`);
            return {
                ...base, kind: 'image', assetId: str(v, 'assetId', where), crop: rect(v.crop, where),
                filters: {
                    whiteToAlpha: num(f, 'whiteToAlpha', where), invert: bool(f, 'invert', where),
                    grayscale: bool(f, 'grayscale', where), contrast: num(f, 'contrast', where),
                },
            };
        }
        case 'text':
            return {
                ...base, kind: 'text', text: str(v, 'text', where), fontSize: num(v, 'fontSize', where),
                font: oneOf(v, 'font', ['sans', 'narrow', 'serif', 'mono'] as const, where), color: str(v, 'color', where),
                background: nullableStr(v, 'background', where), padding: num(v, 'padding', where),
                align: oneOf(v, 'align', ['left', 'center', 'right'] as const, where),
            };
        case 'shape':
            return {
                ...base, kind: 'shape', shape: oneOf(v, 'shape', ['rect', 'ellipse', 'line', 'arrow'] as const, where),
                stroke: str(v, 'stroke', where), strokeWidth: num(v, 'strokeWidth', where),
                fill: nullableStr(v, 'fill', where), flipX: bool(v, 'flipX', where), flipY: bool(v, 'flipY', where),
            };
        case 'stroke': {
            const pts = v.points;
            if (!Array.isArray(pts) || pts.length % 3 !== 0 || !pts.every((n) => typeof n === 'number' && Number.isFinite(n))) {
                throw new FormatError(`${where}: points are not valid.`);
            }
            return {
                ...base, kind: 'stroke', tool: oneOf(v, 'tool', ['pen', 'highlighter'] as const, where),
                color: str(v, 'color', where), size: num(v, 'size', where), points: pts as number[],
            };
        }
        default:
            throw new FormatError(`${where} has an unknown kind.`);
    }
}

export function validateDocument(json: unknown): CheatDocument {
    if (!isObj(json) || !Array.isArray(json.pages)) throw new FormatError('Not a Cheatsheet Maker document.');
    if (json.version !== 1) {
        if (typeof json.version === 'number' && json.version > 1) {
            throw new FormatError(`This file was made by a newer version of Cheatsheet Maker (format ${json.version}). Update the app to open it.`);
        }
        throw new FormatError('Not a Cheatsheet Maker document.');
    }
    const s = json.setup;
    if (!isObj(s)) throw new FormatError('The page setup is missing.');
    const setup: PageSetup = {
        size: oneOf(s, 'size', ['A4', 'Letter', 'A3', 'A5', 'Legal'] as const, 'Page setup'),
        orientation: oneOf(s, 'orientation', ['portrait', 'landscape'] as const, 'Page setup'),
        margin: num(s, 'margin', 'Page setup'), columns: num(s, 'columns', 'Page setup'),
        gutter: num(s, 'gutter', 'Page setup'), grid: num(s, 'grid', 'Page setup'),
    };
    if (json.pages.length === 0) throw new FormatError('The document has no pages.');
    const pages: Page[] = json.pages.map((p, pi) => {
        if (!isObj(p) || !Array.isArray(p.items)) throw new FormatError(`Page ${pi + 1} is not valid.`);
        return { id: str(p, 'id', `Page ${pi + 1}`), items: p.items.map((it, ii) => item(it, `Item ${ii + 1} on page ${pi + 1}`)) };
    });
    const assets: Record<Id, AssetMeta> = {};
    if (!isObj(json.assets)) throw new FormatError('The asset list is missing.');
    for (const [id, a] of Object.entries(json.assets)) {
        if (!isObj(a)) throw new FormatError(`Asset ${id} is not valid.`);
        assets[id] = { id: str(a, 'id', 'Asset'), mime: str(a, 'mime', 'Asset'), width: num(a, 'width', 'Asset'), height: num(a, 'height', 'Asset') };
    }
    return {
        version: 1, id: str(json, 'id', 'Document'), title: str(json, 'title', 'Document'),
        createdAt: num(json, 'createdAt', 'Document'), updatedAt: num(json, 'updatedAt', 'Document'),
        setup, pages, assets,
    };
}

export function packCheatsheet(doc: CheatDocument, assets: AssetBytes): Uint8Array {
    const files: Zippable = { 'document.json': [strToU8(JSON.stringify(doc)), { level: 6 }] };
    for (const id of referencedAssetIds(doc)) {
        const a = assets.get(id);
        if (!a) throw new FormatError('An image in this document could not be found, so the file was not written.');
        files[`assets/${id}.${extForMime(a.mime)}`] = [a.bytes, { level: 0 }];
    }
    return zipSync(files);
}

export function unpackCheatsheet(bytes: Uint8Array): { doc: CheatDocument; assets: AssetBytes } {
    let files: Record<string, Uint8Array>;
    try {
        files = unzipSync(bytes);
    } catch {
        throw new FormatError('This is not a Cheatsheet Maker file.');
    }
    const raw = files['document.json'];
    if (!raw) throw new FormatError('This is not a Cheatsheet Maker file: document.json is missing.');
    let json: unknown;
    try {
        json = JSON.parse(strFromU8(raw));
    } catch {
        throw new FormatError('The document inside this file is damaged.');
    }
    const doc = validateDocument(json);
    const assets: AssetBytes = new Map();
    for (const [name, data] of Object.entries(files)) {
        const m = /^assets\/([0-9a-z]+)\.([a-z]+)$/.exec(name);
        if (m) assets.set(m[1], { bytes: data, mime: MIME[m[2]] ?? 'application/octet-stream' });
    }
    for (const id of referencedAssetIds(doc)) {
        if (!assets.has(id)) throw new FormatError('An image referenced by this document is missing from the file.');
    }
    return { doc, assets };
}
```

- [ ] **Step 7: Implement legacy import**

`app/src/model/legacy.ts`:
```ts
import { addAsset, addItems } from './commands';
import { createDocument, createPage, createStrokeItem, DEFAULT_FILTERS } from './factory';
import { FormatError, type AssetBytes } from './format';
import { sha256Hex } from './hash';
import { newId } from './ids';
import { readPngSize } from './imageSize';
import type { CheatDocument, Item } from './types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const n = (o: Obj, k: string) => (typeof o[k] === 'number' ? (o[k] as number) : 0);

function hex2(v: number): string {
    return Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
}

export async function importLegacyAutosave(text: string, title = 'Imported cheatsheet'): Promise<{ doc: CheatDocument; assets: AssetBytes }> {
    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch {
        throw new FormatError('This file is not valid JSON.');
    }
    const notLegacy = new FormatError('This JSON file is not a Cheatsheet Maker autosave.');
    if (!isObj(json) || !Array.isArray(json.pages)) throw notLegacy;
    let doc = createDocument(title);
    doc = { ...doc, pages: json.pages.map(() => createPage()) };
    if (doc.pages.length === 0) doc = { ...doc, pages: [createPage()] };
    const assets: AssetBytes = new Map();

    for (const [pi, page] of json.pages.entries()) {
        if (!isObj(page)) throw notLegacy;
        const items: Item[] = [];
        for (const it of Array.isArray(page.items) ? page.items : []) {
            if (!isObj(it) || typeof it.image_data !== 'string') throw notLegacy;
            const bytes = Uint8Array.from(atob(it.image_data), (c) => c.charCodeAt(0));
            const id = await sha256Hex(bytes);
            const size = readPngSize(bytes) ?? { width: n(it, 'crop_w'), height: n(it, 'crop_h') };
            assets.set(id, { bytes, mime: 'image/png' });
            doc = addAsset(doc, { id, mime: 'image/png', ...size });
            items.push({
                id: newId(), kind: 'image', x: n(it, 'x'), y: n(it, 'y'), w: n(it, 'width'), h: n(it, 'height'), rotation: 0,
                assetId: id, crop: { x: n(it, 'crop_x'), y: n(it, 'crop_y'), w: n(it, 'crop_w'), h: n(it, 'crop_h') },
                filters: { ...DEFAULT_FILTERS },
            });
        }
        // The GTK app drew every stroke above every image, so strokes go last.
        for (const s of Array.isArray(page.strokes) ? page.strokes : []) {
            if (!isObj(s) || !Array.isArray(s.points)) throw notLegacy;
            const pts = s.points.filter(isObj).flatMap((p) => [n(p, 'x'), n(p, 'y'), 0.5]);
            if (pts.length === 0) continue;
            const a = n(s, 'a');
            const color = `#${hex2(n(s, 'r'))}${hex2(n(s, 'g'))}${hex2(n(s, 'b'))}${a < 1 ? hex2(a) : ''}`;
            items.push(createStrokeItem(pts, 'pen', color, n(s, 'width') || 2));
        }
        doc = addItems(doc, pi, items);
    }
    return { doc, assets };
}
```

- [ ] **Step 8: Run tests and typecheck**

Run: `npx vitest run app/src/model && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 9: Commit**

```bash
git add app/src/model app/src/test/fixtures
git commit -m "feat(model): .cheatsheet file format, hashing and GTK autosave import"
```

---
## Phase B: Rendering and export

### Task 8: Colours, fonts, image filters and auto-trim

**Files:**
- Create: `app/src/render/colors.ts`, `app/src/render/fonts.ts`, `app/src/render/filters.ts`
- Test: `app/src/render/colors.test.ts`, `app/src/render/filters.test.ts`

**Interfaces:**
- Consumes: `ImageFilters`, `FontKey`, `Rect`.
- Produces: `RGBA {r,g,b,a}` (`a` 0..1), `parseColor(css): RGBA`, `toHex(rgba): string`; `FONT_FAMILIES: Record<FontKey, string>`, `FONT_LABELS`, `FontSpec {family, size, bold, italic}`, `cssFont(spec): string`, `ensureFontsLoaded(): Promise<void>`; `RGBAImage {data, width, height}`, `isIdentity(f)`, `filtersKey(f)`, `applyFilters(img, f): RGBAImage`, `findTrimRect(img, tolerance?, padding?): Rect | null`.

- [ ] **Step 1: Write failing tests**

`app/src/render/colors.test.ts`:
```ts
import { expect, test } from 'vitest';
import { parseColor, toHex } from './colors';

test('parses hex forms', () => {
    expect(parseColor('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseColor('#112233')).toEqual({ r: 17, g: 34, b: 51, a: 1 });
    expect(parseColor('#11223380').a).toBeCloseTo(0.502, 2);
    expect(parseColor('nonsense')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
});

test('toHex drops alpha when opaque', () => {
    expect(toHex({ r: 255, g: 212, b: 59, a: 1 })).toBe('#ffd43b');
    expect(toHex({ r: 255, g: 212, b: 59, a: 0.5 })).toBe('#ffd43b80');
});
```

`app/src/render/filters.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { applyFilters, filtersKey, findTrimRect, isIdentity, type RGBAImage } from './filters';
import { DEFAULT_FILTERS } from '../model/factory';

function image(width: number, height: number, fill: [number, number, number, number]): RGBAImage {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) data.set(fill, i);
    return { data, width, height };
}
function setPx(img: RGBAImage, x: number, y: number, px: [number, number, number, number]) {
    img.data.set(px, (y * img.width + x) * 4);
}
const px = (img: RGBAImage, x: number, y: number) => [...img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];

describe('applyFilters', () => {
    test('identity filters are detected and keyed', () => {
        expect(isIdentity(DEFAULT_FILTERS)).toBe(true);
        expect(isIdentity({ ...DEFAULT_FILTERS, invert: true })).toBe(false);
        expect(filtersKey(DEFAULT_FILTERS)).not.toBe(filtersKey({ ...DEFAULT_FILTERS, contrast: 1.2 }));
    });
    test('invert and grayscale', () => {
        const img = image(1, 1, [255, 0, 0, 255]);
        expect(px(applyFilters(img, { ...DEFAULT_FILTERS, invert: true }), 0, 0)).toEqual([0, 255, 255, 255]);
        expect(px(applyFilters(img, { ...DEFAULT_FILTERS, grayscale: true }), 0, 0)).toEqual([54, 54, 54, 255]);
        expect(px(img, 0, 0)).toEqual([255, 0, 0, 255]); // input untouched
    });
    test('contrast pushes values away from mid grey', () => {
        const out = applyFilters(image(1, 1, [100, 128, 200, 255]), { ...DEFAULT_FILTERS, contrast: 2 });
        expect(px(out, 0, 0)).toEqual([72, 128, 255, 255]);
    });
    test('white to transparent keeps ink and drops paper', () => {
        const img = image(3, 1, [255, 255, 255, 255]);
        setPx(img, 1, 0, [0, 0, 0, 255]);
        setPx(img, 2, 0, [250, 250, 250, 255]);
        const out = applyFilters(img, { ...DEFAULT_FILTERS, whiteToAlpha: 0.1 });
        expect(px(out, 0, 0)[3]).toBe(0);
        expect(px(out, 1, 0)).toEqual([0, 0, 0, 255]);
        expect(px(out, 2, 0)[3]).toBe(0);
    });
    test('with a zero-width range, grey composites back to itself over white', () => {
        const out = applyFilters(image(1, 1, [128, 128, 128, 255]), { ...DEFAULT_FILTERS, whiteToAlpha: 1e-9 });
        const [r, , , a] = px(out, 0, 0);
        expect((r * a) / 255 + 255 * (1 - a / 255)).toBeCloseTo(128, 0);
    });
});

describe('findTrimRect', () => {
    test('finds the content inside a uniform border', () => {
        const img = image(10, 8, [255, 255, 255, 255]);
        setPx(img, 3, 2, [0, 0, 0, 255]);
        setPx(img, 6, 5, [0, 0, 0, 255]);
        expect(findTrimRect(img, 24, 0)).toEqual({ x: 3, y: 2, w: 4, h: 4 });
        expect(findTrimRect(img, 24, 1)).toEqual({ x: 2, y: 1, w: 6, h: 6 });
    });
    test('works on transparent backgrounds and ignores faint noise', () => {
        const img = image(5, 5, [0, 0, 0, 0]);
        setPx(img, 2, 2, [10, 10, 10, 255]);
        expect(findTrimRect(img, 24, 0)).toEqual({ x: 2, y: 2, w: 1, h: 1 });
        const noisy = image(5, 5, [255, 255, 255, 255]);
        setPx(noisy, 1, 1, [250, 250, 250, 255]);
        expect(findTrimRect(noisy, 24, 0)).toBeNull();
    });
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run app/src/render`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement colours and fonts**

`app/src/render/colors.ts`:
```ts
export interface RGBA {
    r: number;
    g: number;
    b: number;
    /** 0 to 1. */
    a: number;
}

export function parseColor(css: string): RGBA {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(css.trim());
    if (!m) return { r: 0, g: 0, b: 0, a: 1 };
    let h = m[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const v = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: v(0), g: v(2), b: v(4), a: h.length === 8 ? v(6) / 255 : 1 };
}

export function toHex(c: RGBA): string {
    const two = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
    return `#${two(c.r)}${two(c.g)}${two(c.b)}${c.a < 1 ? two(c.a * 255) : ''}`;
}
```

`app/src/render/fonts.ts`:
```ts
import type { FontKey } from '../model/types';

export const FONT_FAMILIES: Record<FontKey, string> = {
    sans: "'Atkinson Hyperlegible Next Variable', system-ui, sans-serif",
    narrow: "'Archivo Narrow Variable', 'Arial Narrow', sans-serif",
    serif: "'Source Serif 4 Variable', Georgia, serif",
    mono: "'JetBrains Mono Variable', ui-monospace, monospace",
};

export const FONT_LABELS: Record<FontKey, string> = { sans: 'Sans', narrow: 'Narrow', serif: 'Serif', mono: 'Mono' };

export interface FontSpec {
    family: FontKey;
    size: number;
    bold: boolean;
    italic: boolean;
}

export function cssFont(f: FontSpec): string {
    return `${f.italic ? 'italic ' : ''}${f.bold ? 700 : 400} ${f.size}px ${FONT_FAMILIES[f.family]}`;
}

/** Wait for every document font in regular, bold and italic so canvas measurements are final. */
export async function ensureFontsLoaded(): Promise<void> {
    if (typeof document === 'undefined' || !document.fonts) return;
    const loads: Promise<unknown>[] = [];
    for (const family of Object.keys(FONT_FAMILIES) as FontKey[]) {
        for (const bold of [false, true]) {
            for (const italic of [false, true]) loads.push(document.fonts.load(cssFont({ family, size: 16, bold, italic })));
        }
    }
    await Promise.allSettled(loads);
}
```

- [ ] **Step 4: Implement filters**

`app/src/render/filters.ts`:
```ts
import type { ImageFilters, Rect } from '../model/types';

export interface RGBAImage {
    data: Uint8ClampedArray;
    width: number;
    height: number;
}

export function isIdentity(f: ImageFilters): boolean {
    return f.whiteToAlpha <= 0 && !f.invert && !f.grayscale && f.contrast === 1;
}

export function filtersKey(f: ImageFilters): string {
    return `${f.whiteToAlpha.toFixed(3)}|${f.invert ? 1 : 0}|${f.grayscale ? 1 : 0}|${f.contrast.toFixed(3)}`;
}

/**
 * Order matters: invert first, so a dark slide becomes dark ink on white, and
 * white-to-transparent last, so that white can then disappear.
 */
export function applyFilters(src: RGBAImage, f: ImageFilters): RGBAImage {
    const d = new Uint8ClampedArray(src.data);
    const t = Math.min(0.95, Math.max(0, f.whiteToAlpha));
    for (let i = 0; i < d.length; i += 4) {
        let r = d[i], g = d[i + 1], b = d[i + 2];
        if (f.invert) {
            r = 255 - r;
            g = 255 - g;
            b = 255 - b;
        }
        if (f.grayscale) r = g = b = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (f.contrast !== 1) {
            r = (r - 128) * f.contrast + 128;
            g = (g - 128) * f.contrast + 128;
            b = (b - 128) * f.contrast + 128;
        }
        let a = d[i + 3];
        if (t > 0) {
            r = Math.max(0, Math.min(255, r));
            g = Math.max(0, Math.min(255, g));
            b = Math.max(0, Math.min(255, b));
            const dist = Math.max(255 - r, 255 - g, 255 - b) / 255;
            const keep = dist <= t ? 0 : (dist - t) / (1 - t);
            if (keep > 0) {
                // Un-premultiply against white so the pixel still looks the same on paper.
                r = 255 - (255 - r) / keep;
                g = 255 - (255 - g) / keep;
                b = 255 - (255 - b) / keep;
            }
            a = a * keep;
        }
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
        d[i + 3] = a;
    }
    return { data: d, width: src.width, height: src.height };
}

/** Bounding box of pixels that differ from the border colour, grown by `padding` and clamped. */
export function findTrimRect(img: RGBAImage, tolerance = 24, padding = 2): Rect | null {
    const { data, width, height } = img;
    const at = (x: number, y: number) => (y * width + x) * 4;
    const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
    const same = (i: number, j: number) => {
        if (data[i + 3] < 8 && data[j + 3] < 8) return true;
        return Math.max(Math.abs(data[i] - data[j]), Math.abs(data[i + 1] - data[j + 1]),
            Math.abs(data[i + 2] - data[j + 2]), Math.abs(data[i + 3] - data[j + 3])) <= tolerance;
    };
    // The border colour is the corner that agrees with the most other corners.
    let ref = corners[0], bestVotes = -1;
    for (const c of corners) {
        const votes = corners.filter((o) => same(c, o)).length;
        if (votes > bestVotes) {
            bestVotes = votes;
            ref = c;
        }
    }
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (same(at(x, y), ref)) continue;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
        }
    }
    if (x1 < 0) return null;
    x0 = Math.max(0, x0 - padding);
    y0 = Math.max(0, y0 - padding);
    x1 = Math.min(width - 1, x1 + padding);
    y1 = Math.min(height - 1, y1 + padding);
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run app/src/render`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/render
git commit -m "feat(render): colours, document fonts, image filters and auto-trim"
```

---

### Task 9: Markdown-lite parsing and text layout

**Files:**
- Create: `app/src/render/markdown.ts`, `app/src/render/textLayout.ts`
- Test: `app/src/render/markdown.test.ts`, `app/src/render/textLayout.test.ts`

**Interfaces:**
- Consumes: `FontSpec` (Task 8), `FontKey`, `TextAlign`.
- Produces: `Span = {kind:'text', text, bold, italic, code} | {kind:'math', tex}`; `Block = {kind:'paragraph', spans} | {kind:'heading', level: 1|2, spans} | {kind:'list', marker, depth, spans} | {kind:'math', tex} | {kind:'blank'}`; `parseInline(src): Span[]`; `parseMarkdown(src): Block[]`. `Measurer = (text, font: FontSpec) => number`; `MathMetrics {width, ascent, depth}` in points; `MathSource = (tex, display, fontSize) => MathMetrics | null`; `Run = {kind:'text', x, baseline, text, font} | {kind:'math', x, top, w, h, tex, display}`; `TextLayout {runs, height}`; `LayoutOptions {width, fontSize, font, align, measure, math, lineHeight?}`; `layoutText(blocks, options): TextLayout`.

- [ ] **Step 1: Write failing tests**

`app/src/render/markdown.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { parseInline, parseMarkdown } from './markdown';

const t = (text: string, o: Partial<{ bold: boolean; italic: boolean; code: boolean }> = {}) =>
    ({ kind: 'text', text, bold: false, italic: false, code: false, ...o });

describe('parseInline', () => {
    test('bold, italic and code', () => {
        expect(parseInline('a **b** *c* `d*e`')).toEqual([
            t('a '), t('b', { bold: true }), t(' '), t('c', { italic: true }), t(' '), t('d*e', { code: true }),
        ]);
    });
    test('inline math and escapes', () => {
        expect(parseInline('area $\\pi r^2$ and \\$5')).toEqual([t('area '), { kind: 'math', tex: '\\pi r^2' }, t(' and $5')]);
    });
    test('prices are not math', () => {
        expect(parseInline('costs $5 and $10')).toEqual([t('costs $5 and $10')]);
        expect(parseInline('a $ b $ c')).toEqual([t('a $ b $ c')]);
    });
});

describe('parseMarkdown', () => {
    test('headings, lists, paragraphs and blank lines', () => {
        const blocks = parseMarkdown('# Title\n## Sub\n- one\n  - two\n3. three\n\nplain');
        expect(blocks.map((b) => b.kind)).toEqual(['heading', 'heading', 'list', 'list', 'list', 'blank', 'paragraph']);
        expect(blocks[0]).toMatchObject({ level: 1 });
        expect(blocks[3]).toMatchObject({ marker: '•', depth: 1 });
        expect(blocks[4]).toMatchObject({ marker: '3.', depth: 0 });
    });
    test('display math on one line or across lines', () => {
        expect(parseMarkdown('$$E = mc^2$$')).toEqual([{ kind: 'math', tex: 'E = mc^2' }]);
        expect(parseMarkdown('$$\n\\int_0^1 x\\,dx\n$$\nafter')).toEqual([
            { kind: 'math', tex: '\\int_0^1 x\\,dx' },
            { kind: 'paragraph', spans: [t('after')] },
        ]);
    });
    test('bold at the start of a line is not a bullet', () => {
        expect(parseMarkdown('**Key** point')[0].kind).toBe('paragraph');
    });
});
```

`app/src/render/textLayout.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { layoutText, type LayoutOptions, type Run } from './textLayout';
import { parseMarkdown } from './markdown';

// Every character is half the font size wide; bold is a little wider.
const measure: LayoutOptions['measure'] = (text, f) => text.length * f.size * (f.bold ? 0.55 : 0.5);
const math: LayoutOptions['math'] = (tex, _display, size) => ({ width: tex.length * size * 0.5, ascent: size * 0.8, depth: size * 0.2 });
const opts = (o: Partial<LayoutOptions> = {}): LayoutOptions => ({ width: 100, fontSize: 10, font: 'sans', align: 'left', measure, math, ...o });
const texts = (runs: Run[]) => runs.filter((r): r is Extract<Run, { kind: 'text' }> => r.kind === 'text');

describe('layoutText', () => {
    test('wraps words at the width and stacks lines', () => {
        // "aaaa bbbb cccc" at 5 pt per character: 20 + 5 + 20 = 45 per pair, three words need 70
        const out = layoutText(parseMarkdown('aaaa bbbb cccc dddd'), opts({ width: 50 }));
        const lines = [...new Set(texts(out.runs).map((r) => r.baseline))];
        expect(lines).toHaveLength(2);
        expect(out.height).toBeCloseTo(25, 5);
    });
    test('centre alignment offsets the line', () => {
        const out = layoutText(parseMarkdown('ab'), opts({ align: 'center' }));
        expect(texts(out.runs)[0].x).toBeCloseTo(45);
    });
    test('list items are indented with a marker', () => {
        const out = layoutText(parseMarkdown('- item'), opts());
        const [marker, body] = texts(out.runs);
        expect(marker.text).toBe('•');
        expect(body.x).toBeCloseTo(12);
        expect(marker.x).toBeLessThan(body.x);
    });
    test('a word longer than the width is broken', () => {
        const out = layoutText(parseMarkdown('x'.repeat(30)), opts({ width: 50 }));
        expect(texts(out.runs).every((r) => measure(r.text, r.font) <= 50 + 1e-9)).toBe(true);
        expect(texts(out.runs).map((r) => r.text).join('')).toBe('x'.repeat(30));
    });
    test('display math is centred and scaled down to fit', () => {
        const out = layoutText(parseMarkdown('$$' + 'y'.repeat(40) + '$$'), opts());
        const m = out.runs.find((r) => r.kind === 'math')!;
        expect(m.kind === 'math' && m.w).toBeCloseTo(100);
        expect(m.x).toBeCloseTo(0);
    });
    test('missing math metrics reserve a placeholder', () => {
        const out = layoutText(parseMarkdown('a $x$'), opts({ math: () => null }));
        expect(out.runs.some((r) => r.kind === 'math')).toBe(true);
    });
    test('headings are bigger and bold', () => {
        const out = layoutText(parseMarkdown('# H'), opts());
        expect(texts(out.runs)[0].font).toMatchObject({ bold: true, size: 14 });
    });
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run app/src/render`
Expected: FAIL in the two new files.

- [ ] **Step 3: Implement the parser**

`app/src/render/markdown.ts`:
```ts
export type Span =
    | { kind: 'text'; text: string; bold: boolean; italic: boolean; code: boolean }
    | { kind: 'math'; tex: string };

export type Block =
    | { kind: 'paragraph'; spans: Span[] }
    | { kind: 'heading'; level: 1 | 2; spans: Span[] }
    | { kind: 'list'; marker: string; depth: number; spans: Span[] }
    | { kind: 'math'; tex: string }
    | { kind: 'blank' };

/** Pandoc's rule: `$` opens before a non-space and closes after a non-space, not followed by a digit. */
function closingDollar(src: string, from: number): number {
    if (from >= src.length || /\s/.test(src[from])) return -1;
    for (let i = from; i < src.length; i++) {
        if (src[i] === '\\') {
            i++;
            continue;
        }
        if (src[i] === '$' && !/\s/.test(src[i - 1]) && !/[0-9]/.test(src[i + 1] ?? '')) return i;
    }
    return -1;
}

export function parseInline(src: string): Span[] {
    const out: Span[] = [];
    let bold = false, italic = false, buf = '';
    const flush = () => {
        if (buf) out.push({ kind: 'text', text: buf, bold, italic, code: false });
        buf = '';
    };
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (c === '\\' && i + 1 < src.length && '\\*`$'.includes(src[i + 1])) {
            buf += src[++i];
            continue;
        }
        if (c === '`') {
            const end = src.indexOf('`', i + 1);
            if (end > i) {
                flush();
                out.push({ kind: 'text', text: src.slice(i + 1, end), bold, italic, code: true });
                i = end;
                continue;
            }
        }
        if (c === '$') {
            const end = closingDollar(src, i + 1);
            if (end > i + 1) {
                flush();
                out.push({ kind: 'math', tex: src.slice(i + 1, end) });
                i = end;
                continue;
            }
        }
        if (c === '*') {
            flush();
            if (src[i + 1] === '*') {
                bold = !bold;
                i++;
            } else italic = !italic;
            continue;
        }
        buf += c;
    }
    flush();
    return out;
}

export function parseMarkdown(src: string): Block[] {
    const lines = src.replace(/\r\n?/g, '\n').split('\n');
    const out: Block[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const t = line.trim();
        if (t.startsWith('$$')) {
            const rest = t.slice(2);
            const close = rest.indexOf('$$');
            if (close >= 0) {
                out.push({ kind: 'math', tex: rest.slice(0, close).trim() });
                continue;
            }
            let j = i + 1;
            while (j < lines.length && !lines[j].includes('$$')) j++;
            if (j < lines.length) {
                const body = [rest, ...lines.slice(i + 1, j), lines[j].slice(0, lines[j].indexOf('$$'))];
                out.push({ kind: 'math', tex: body.join('\n').trim() });
                i = j;
                continue;
            }
        }
        if (t === '') {
            out.push({ kind: 'blank' });
            continue;
        }
        const indent = (s: string) => Math.floor(s.replace(/\t/g, '  ').length / 2);
        const h = /^(#{1,2})\s+(.*)$/.exec(t);
        if (h) {
            out.push({ kind: 'heading', level: h[1].length as 1 | 2, spans: parseInline(h[2]) });
            continue;
        }
        const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line);
        if (bullet) {
            out.push({ kind: 'list', marker: '•', depth: indent(bullet[1]), spans: parseInline(bullet[2]) });
            continue;
        }
        const numbered = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(line);
        if (numbered) {
            out.push({ kind: 'list', marker: `${numbered[2]}.`, depth: indent(numbered[1]), spans: parseInline(numbered[3]) });
            continue;
        }
        out.push({ kind: 'paragraph', spans: parseInline(line) });
    }
    return out;
}
```

- [ ] **Step 4: Implement layout**

`app/src/render/textLayout.ts`:
```ts
import type { FontKey, TextAlign } from '../model/types';
import type { FontSpec } from './fonts';
import type { Block, Span } from './markdown';

export type Measurer = (text: string, font: FontSpec) => number;

/** Points: `ascent` above the baseline, `depth` below it. */
export interface MathMetrics {
    width: number;
    ascent: number;
    depth: number;
}

/** Returns null while the formula is still being typeset. */
export type MathSource = (tex: string, display: boolean, fontSize: number) => MathMetrics | null;

export type Run =
    | { kind: 'text'; x: number; baseline: number; text: string; font: FontSpec }
    | { kind: 'math'; x: number; top: number; w: number; h: number; tex: string; display: boolean };

export interface TextLayout {
    runs: Run[];
    height: number;
}

export interface LayoutOptions {
    width: number;
    fontSize: number;
    font: FontKey;
    align: TextAlign;
    measure: Measurer;
    math: MathSource;
    lineHeight?: number;
}

type Token =
    | { kind: 'text'; text: string; font: FontSpec; w: number; space: boolean }
    | { kind: 'math'; tex: string; w: number; ascent: number; depth: number };

function placeholder(size: number): MathMetrics {
    return { width: size * 2, ascent: size * 0.75, depth: size * 0.25 };
}

function tokenize(spans: Span[], base: FontSpec, o: LayoutOptions): Token[] {
    const out: Token[] = [];
    for (const s of spans) {
        if (s.kind === 'math') {
            const m = o.math(s.tex, false, base.size) ?? placeholder(base.size);
            out.push({ kind: 'math', tex: s.tex, w: m.width, ascent: m.ascent, depth: m.depth });
            continue;
        }
        const font: FontSpec = s.code
            ? { family: 'mono', size: base.size * 0.92, bold: base.bold || s.bold, italic: s.italic }
            : { family: base.family, size: base.size, bold: base.bold || s.bold, italic: base.italic || s.italic };
        for (const part of s.text.split(/(\s+)/)) {
            if (!part) continue;
            const space = /^\s+$/.test(part);
            const text = space ? ' ' : part;
            out.push({ kind: 'text', text, font, w: o.measure(text, font), space });
        }
    }
    return out;
}

/** Split a word that is wider than the line into pieces that fit. */
function hardBreak(t: Extract<Token, { kind: 'text' }>, avail: number, o: LayoutOptions): Token[] {
    const pieces: Token[] = [];
    let cur = '';
    for (const ch of t.text) {
        if (cur && o.measure(cur + ch, t.font) > avail) {
            pieces.push({ ...t, text: cur, w: o.measure(cur, t.font) });
            cur = '';
        }
        cur += ch;
    }
    if (cur) pieces.push({ ...t, text: cur, w: o.measure(cur, t.font) });
    return pieces;
}

function sameFont(a: FontSpec, b: FontSpec) {
    return a.family === b.family && a.size === b.size && a.bold === b.bold && a.italic === b.italic;
}

/** Lay out tokens from `y`, inside [x0, x0 + avail]; returns the new y. */
function flow(tokens: Token[], x0: number, avail: number, y: number, base: FontSpec, o: LayoutOptions, runs: Run[], firstBaseline?: (b: number) => void): number {
    const lh = o.lineHeight ?? 1.25;
    const lines: Token[][] = [[]];
    let x = 0;
    const queue = [...tokens];
    while (queue.length) {
        const t = queue.shift()!;
        const line = lines[lines.length - 1];
        if (t.kind === 'text' && t.space && line.length === 0) continue;
        if (x + t.w > avail + 1e-9 && line.length > 0 && !(t.kind === 'text' && t.space)) {
            lines.push([]);
            x = 0;
            queue.unshift(t);
            continue;
        }
        if (t.kind === 'text' && !t.space && t.w > avail + 1e-9) {
            queue.unshift(...hardBreak(t, avail, o));
            continue;
        }
        line.push(t);
        x += t.w;
    }
    lines.forEach((line, li) => {
        const lineStart = runs.length;
        while (line.length && line[line.length - 1].kind === 'text' && (line[line.length - 1] as { space: boolean }).space) line.pop();
        let ascent = base.size * 0.8, depth = base.size * 0.2;
        for (const t of line) {
            if (t.kind === 'math') {
                ascent = Math.max(ascent, t.ascent);
                depth = Math.max(depth, t.depth);
            } else {
                ascent = Math.max(ascent, t.font.size * 0.8);
                depth = Math.max(depth, t.font.size * 0.2);
            }
        }
        const box = Math.max(base.size * lh, ascent + depth + base.size * 0.1);
        const baseline = y + (box - (ascent + depth)) / 2 + ascent;
        if (li === 0) firstBaseline?.(baseline);
        const width = line.reduce((a, t) => a + t.w, 0);
        let x = x0 + (o.align === 'center' ? (avail - width) / 2 : o.align === 'right' ? avail - width : 0);
        for (const t of line) {
            if (t.kind === 'math') {
                runs.push({ kind: 'math', x, top: baseline - t.ascent, w: t.w, h: t.ascent + t.depth, tex: t.tex, display: false });
            } else {
                const prev = runs[runs.length - 1];
                if (runs.length > lineStart && prev.kind === 'text' && sameFont(prev.font, t.font)) prev.text += t.text;
                else runs.push({ kind: 'text', x, baseline, text: t.text, font: t.font });
            }
            x += t.w;
        }
        y += box;
    });
    return y;
}

export function layoutText(blocks: Block[], o: LayoutOptions): TextLayout {
    const runs: Run[] = [];
    let y = 0;
    const base: FontSpec = { family: o.font, size: o.fontSize, bold: false, italic: false };
    for (const b of blocks) {
        if (b.kind === 'blank') {
            y += o.fontSize * 0.5;
        } else if (b.kind === 'heading') {
            const font = { ...base, size: o.fontSize * (b.level === 1 ? 1.4 : 1.18), bold: true };
            y = flow(tokenize(b.spans, font, o), 0, o.width, y, font, o, runs) + font.size * 0.15;
        } else if (b.kind === 'list') {
            const indent = (b.depth + 1) * o.fontSize * 1.2;
            // Pushed first so it reads before the item; flow() fills in its position.
            const marker = { kind: 'text' as const, x: 0, baseline: 0, text: b.marker, font: base };
            runs.push(marker);
            const left = { ...o, align: 'left' as const };
            y = flow(tokenize(b.spans, base, left), indent, Math.max(o.fontSize, o.width - indent), y, base, left, runs, (bl) => {
                marker.x = indent - o.measure(b.marker, base) - o.fontSize * 0.35;
                marker.baseline = bl;
            });
        } else if (b.kind === 'math') {
            const m = o.math(b.tex, true, o.fontSize) ?? placeholder(o.fontSize * 1.2);
            const scale = Math.min(1, o.width / m.width);
            const w = m.width * scale, h = (m.ascent + m.depth) * scale;
            const x = o.align === 'left' ? 0 : o.align === 'right' ? o.width - w : (o.width - w) / 2;
            y += o.fontSize * 0.2;
            runs.push({ kind: 'math', x, top: y, w, h, tex: b.tex, display: true });
            y += h + o.fontSize * 0.2;
        } else {
            y = flow(tokenize(b.spans, base, o), 0, o.width, y, base, o, runs);
        }
    }
    return { runs, height: y };
}
```

Note on the display-math test: the formula is 40 characters at 5 pt each (200 pt) in a 100 pt box, so it scales to exactly 100 pt wide and sits at x = 0 even when centred.

- [ ] **Step 5: Run tests**

Run: `npx vitest run app/src/render`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/render
git commit -m "feat(render): Markdown-lite parser and text layout with inline and display math"
```

---

### Task 10: MathJax typesetting

**Files:**
- Create: `app/src/render/math.ts`
- Test: `app/src/render/math.test.ts`

**Interfaces:**
- Consumes: `MathMetrics`, `MathSource` (Task 9).
- Produces: `MathSvg {svg, width, ascent, depth}` (em units); `texToSvg(tex, display): Promise<MathSvg>`; `class MathCache { constructor(onReady: () => void); metrics: MathSource; image(tex, display, color): CanvasImageSource | null; whenIdle(): Promise<void> }`.

MathJax 4 facts this task depends on (verified 2026-10-04):
- Import from `@mathjax/src/js/...` and the font from `@mathjax/mathjax-newcm-font/js/svg.js`.
- `new SVG({ fontCache: 'none', linebreaks: { inline: false }, font: new MathJaxNewcmFont() })`. Without `linebreaks.inline: false`, inline math is split into several `<svg>` fragments and the first one's size is wrong.
- Some alphabets (`\mathbb`, `\mathcal`, `\mathfrak`) load on demand through `mathjax.asyncLoad(name)`, where `name` is like `@mathjax/mathjax-newcm-font/js/svg/dynamic/double-struck.js`. Use `doc.convertPromise`, not `convert`.
- Metrics come from the `viewBox` (1000 units per em): width `vbW/1000`, ascent `-minY/1000`, depth `(vbH + minY)/1000`.
- An invalid formula yields an `merror` node, not an exception.

- [ ] **Step 1: Write failing tests (Node, liteAdaptor, no DOM needed)**

`app/src/render/math.test.ts`:
```ts
import { expect, test } from 'vitest';
import { texToSvg } from './math';

test('typesets inline math as one SVG with sensible metrics', async () => {
    const m = await texToSvg('a+b+c+d+e', false);
    expect(m.svg.startsWith('<svg')).toBe(true);
    expect(m.svg.match(/<svg/g)).toHaveLength(1);
    expect(m.width).toBeGreaterThan(5);
    expect(m.ascent).toBeGreaterThan(0.4);
});

test('loads extra alphabets on demand', async () => {
    const m = await texToSvg('\\mathbb{R}^n \\to \\mathcal{L}', false);
    expect(m.width).toBeGreaterThan(3);
});

test('a bad formula renders an error box instead of throwing', async () => {
    const m = await texToSvg('\\frac{', true);
    expect(m.svg).toContain('merror');
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run app/src/render/math.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`app/src/render/math.ts`:
```ts
import type { MathMetrics, MathSource } from './textLayout';

export interface MathSvg {
    svg: string;
    /** em */
    width: number;
    ascent: number;
    depth: number;
}

// Every on-demand MathJax font file, keyed by base name. The relative path
// reaches the workspace-root node_modules where npm hoists the package.
const dynamicFonts = import.meta.glob('../../../node_modules/@mathjax/mathjax-newcm-font/mjs/svg/dynamic/*.js');
const fontLoaders = new Map(Object.entries(dynamicFonts).map(([path, load]) => [path.split('/').pop()!, load]));

type Engine = { convert(tex: string, display: boolean): Promise<string> };
let engine: Promise<Engine> | null = null;

async function createEngine(): Promise<Engine> {
    const [{ mathjax }, { TeX }, { SVG }, { liteAdaptor }, { RegisterHTMLHandler }, { MathJaxNewcmFont }] = await Promise.all([
        import('@mathjax/src/js/mathjax.js'),
        import('@mathjax/src/js/input/tex.js'),
        import('@mathjax/src/js/output/svg.js'),
        import('@mathjax/src/js/adaptors/liteAdaptor.js'),
        import('@mathjax/src/js/handlers/html.js'),
        import('@mathjax/mathjax-newcm-font/js/svg.js'),
        import('@mathjax/src/js/input/tex/base/BaseConfiguration.js'),
        import('@mathjax/src/js/input/tex/ams/AmsConfiguration.js'),
        import('@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js'),
        import('@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js'),
        import('@mathjax/src/js/input/tex/cancel/CancelConfiguration.js'),
        import('@mathjax/src/js/input/tex/color/ColorConfiguration.js'),
    ]);
    mathjax.asyncLoad = (name: string) => {
        const load = fontLoaders.get(name.split('/').pop()!);
        if (!load) return Promise.reject(new Error(`MathJax asked for ${name}, which is not bundled`));
        return load();
    };
    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    const doc = mathjax.document('', {
        InputJax: new TeX({ packages: ['base', 'ams', 'newcommand', 'boldsymbol', 'cancel', 'color'] }),
        OutputJax: new SVG({ fontCache: 'none', linebreaks: { inline: false }, font: new MathJaxNewcmFont() }),
    });
    return {
        async convert(tex, display) {
            const node = await doc.convertPromise(tex, { display });
            return adaptor.innerHTML(node);
        },
    };
}

export async function texToSvg(tex: string, display: boolean): Promise<MathSvg> {
    engine ??= createEngine();
    const svg = await (await engine).convert(tex, display);
    const vb = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(svg);
    const [minY, w, h] = vb ? [Number(vb[2]), Number(vb[3]), Number(vb[4])] : [-750, 1000, 1000];
    return { svg, width: w / 1000, ascent: -minY / 1000, depth: (h + minY) / 1000 };
}

/** Typesets on demand, caches results and tells the editor when something new is ready. */
export class MathCache {
    private svgs = new Map<string, MathSvg | 'pending' | 'failed'>();
    private images = new Map<string, HTMLImageElement | 'pending'>();
    private inflight = new Set<Promise<unknown>>();

    constructor(private onReady: () => void) {}

    private track<T>(p: Promise<T>) {
        this.inflight.add(p);
        p.finally(() => this.inflight.delete(p));
    }

    private svgFor(tex: string, display: boolean): MathSvg | null {
        const key = `${display ? 'D' : 'I'}:${tex}`;
        const hit = this.svgs.get(key);
        if (hit && hit !== 'pending' && hit !== 'failed') return hit;
        if (!hit) {
            this.svgs.set(key, 'pending');
            this.track(texToSvg(tex, display).then(
                (m) => { this.svgs.set(key, m); this.onReady(); },
                () => { this.svgs.set(key, 'failed'); },
            ));
        }
        return null;
    }

    metrics: MathSource = (tex, display, fontSize): MathMetrics | null => {
        const m = this.svgFor(tex, display);
        return m && { width: m.width * fontSize, ascent: m.ascent * fontSize, depth: m.depth * fontSize };
    };

    image(tex: string, display: boolean, color: string): CanvasImageSource | null {
        const m = this.svgFor(tex, display);
        if (!m || typeof Image === 'undefined') return null;
        const key = `${display ? 'D' : 'I'}:${color}:${tex}`;
        const hit = this.images.get(key);
        if (hit && hit !== 'pending') return hit;
        if (!hit) {
            this.images.set(key, 'pending');
            // Large intrinsic size so the browser never upscales a small raster.
            const svg = m.svg
                .replace(/currentColor/g, color)
                .replace(/width="[^"]*"/, `width="${(m.width * 64).toFixed(1)}px"`)
                .replace(/height="[^"]*"/, `height="${((m.ascent + m.depth) * 64).toFixed(1)}px"`);
            const img = new Image();
            const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
            img.src = url;
            this.track(img.decode().then(
                () => { this.images.set(key, img); this.onReady(); },
                () => { this.images.delete(key); },
            ).finally(() => URL.revokeObjectURL(url)));
        }
        return null;
    }

    /** Resolves when nothing is being typeset or decoded (used before export). */
    async whenIdle(): Promise<void> {
        while (this.inflight.size) await Promise.allSettled([...this.inflight]);
    }
}
```

If `npm run typecheck` reports missing declaration files for `@mathjax/src/js/...` imports, add `app/src/render/mathjax.d.ts` with `declare module '@mathjax/src/js/*';` and `declare module '@mathjax/mathjax-newcm-font/js/*';`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run app/src/render/math.test.ts`
Expected: PASS (first run takes a second while MathJax initialises).

- [ ] **Step 5: Commit**

```bash
git add app/src/render
git commit -m "feat(render): MathJax 4 typesetting with on-demand fonts and a render cache"
```

---

### Task 11: Stroke outlines, shape paths and the page renderer

**Files:**
- Create: `app/src/render/strokes.ts`, `app/src/render/drawPage.ts`
- Test: `app/src/render/strokes.test.ts`, `app/src/render/drawPage.test.ts`, `app/src/test/recordingContext.ts`

**Interfaces:**
- Consumes: `itemMatrix`, `lineEndpoints`, `pageDimensions`, `printableArea`, `columnGuides`, `cssFont`, `TextLayout`, `parseColor`.
- Produces: `strokeOutline(item: StrokeItem): number[][]` (cached per item object), `outlineToPath(outline): string`, `ShapeGeometry {stroke: string, fill: string | null, head: string | null}`, `shapeGeometry(item: ShapeItem): ShapeGeometry`; `RenderAssets {image(item): CanvasImageSource | null; textLayout(item): TextLayout; math(tex, display, color): CanvasImageSource | null}`, `DrawOptions {guides?, hidden?: ReadonlySet<Id>, background?: string | null}`, `drawPage(ctx, page, setup, assets, options?)`, `drawItem(ctx, item, assets)`, `GUIDE_COLOR`.

- [ ] **Step 1: Write the recording context helper**

`app/src/test/recordingContext.ts`:
```ts
/** A stand-in for CanvasRenderingContext2D that records calls and property writes. */
export function recordingContext() {
    const calls: Array<[string, ...unknown[]]> = [];
    const target: Record<string, unknown> = {};
    const ctx = new Proxy(target, {
        get(_t, prop: string) {
            if (prop === 'calls') return calls;
            if (prop in target) return target[prop];
            return (...args: unknown[]) => {
                calls.push([prop, ...args]);
            };
        },
        set(_t, prop: string, value) {
            target[prop] = value;
            calls.push([`set:${prop}`, value]);
            return true;
        },
    });
    return ctx as unknown as CanvasRenderingContext2D & { calls: typeof calls };
}

/** Node has no Path2D; tests only need to know which path was drawn. */
export class FakePath2D {
    constructor(public d = '') {}
}
```

- [ ] **Step 2: Write failing tests**

`app/src/render/strokes.test.ts`:
```ts
import { expect, test } from 'vitest';
import { outlineToPath, shapeGeometry, strokeOutline } from './strokes';
import { createShapeItem, createStrokeItem } from '../model/factory';

test('stroke outlines are closed polygons and cached per item', () => {
    const s = createStrokeItem([0, 0, 0.5, 50, 0, 0.5, 100, 20, 0.5], 'pen', '#000', 6);
    const o = strokeOutline(s);
    expect(o.length).toBeGreaterThan(4);
    expect(strokeOutline(s)).toBe(o);
    const d = outlineToPath(o);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
});

test('shape geometry in local coordinates', () => {
    const style = { stroke: '#000', strokeWidth: 2, fill: null };
    expect(shapeGeometry(createShapeItem('rect', { x: 5, y: 5, w: 10, h: 20 }, style)).stroke).toBe('M0 0H10V20H0Z');
    const arrow = shapeGeometry(createShapeItem('arrow', { x: 0, y: 0, w: 100, h: 0 }, style));
    expect(arrow.head).not.toBeNull();
    expect(arrow.stroke).toMatch(/^M0 0L9\d(\.\d+)? 0$/); // shortened so it does not poke through the head
    expect(shapeGeometry(createShapeItem('ellipse', { x: 0, y: 0, w: 10, h: 10 }, { ...style, fill: '#fff' })).fill).toContain('C');
});
```

`app/src/render/drawPage.test.ts`:
```ts
import { beforeAll, expect, test } from 'vitest';
import { drawPage } from './drawPage';
import { FakePath2D, recordingContext } from '../test/recordingContext';
import { createImageItem, createShapeItem, createStrokeItem, createTextItem, createPage, DEFAULT_SETUP } from '../model/factory';
import type { RenderAssets } from './drawPage';

beforeAll(() => {
    (globalThis as { Path2D?: unknown }).Path2D = FakePath2D;
});

const bitmap = { width: 4, height: 4 } as unknown as CanvasImageSource;
const assets: RenderAssets = {
    image: () => bitmap,
    textLayout: () => ({ runs: [{ kind: 'text', x: 1, baseline: 9, text: 'hi', font: { family: 'sans', size: 10, bold: false, italic: false } }], height: 12 }),
    math: () => null,
};

test('draws the page, then items in z order, honouring crop and padding', () => {
    const img = { ...createImageItem({ id: 'a', mime: 'image/png', width: 4, height: 4 }, { x: 50, y: 50 }, 100, 100), crop: { x: 1, y: 1, w: 2, h: 2 } };
    const text = createTextItem({ x: 0, y: 0 }, { font: 'sans', fontSize: 10, color: '#000', background: '#ff0', align: 'left' }, 50, 'hi');
    const ctx = recordingContext();
    drawPage(ctx, { ...createPage(), items: [img, text] }, DEFAULT_SETUP, assets);
    const names = ctx.calls.map((c) => c[0]);
    expect(names[0]).toBe('set:fillStyle');
    expect(names[1]).toBe('fillRect');
    const draw = ctx.calls.find((c) => c[0] === 'drawImage')!;
    expect(draw.slice(1)).toEqual([bitmap, 1, 1, 2, 2, 0, 0, img.w, img.h]);
    const fillText = ctx.calls.find((c) => c[0] === 'fillText')!;
    expect(fillText.slice(1)).toEqual(['hi', 1 + text.padding, 9 + text.padding]);
    expect(names.indexOf('drawImage')).toBeLessThan(names.indexOf('fillText'));
});

test('hidden items are skipped and guides only drawn on request', () => {
    const s = createShapeItem('rect', { x: 0, y: 0, w: 5, h: 5 }, { stroke: '#000', strokeWidth: 1, fill: null });
    const ctx = recordingContext();
    drawPage(ctx, { ...createPage(), items: [s] }, DEFAULT_SETUP, assets, { hidden: new Set([s.id]) });
    expect(ctx.calls.some((c) => c[0] === 'stroke')).toBe(false);
    const guided = recordingContext();
    drawPage(guided, createPage(), DEFAULT_SETUP, assets, { guides: true });
    expect(guided.calls.some((c) => c[0] === 'setLineDash')).toBe(true);
});

test('highlighter strokes multiply', () => {
    const h = createStrokeItem([0, 0, 0.5, 40, 0, 0.5], 'highlighter', '#ffd43b80', 12);
    const ctx = recordingContext();
    drawPage(ctx, { ...createPage(), items: [h] }, DEFAULT_SETUP, assets);
    expect(ctx.calls).toContainEqual(['set:globalCompositeOperation', 'multiply']);
});
```

- [ ] **Step 3: Run to see failures**

Run: `npx vitest run app/src/render`
Expected: FAIL in the new files.

- [ ] **Step 4: Implement strokes and shapes**

`app/src/render/strokes.ts`:
```ts
import { getStroke } from 'perfect-freehand';
import type { ShapeItem, StrokeItem } from '../model/types';

const outlines = new WeakMap<StrokeItem, number[][]>();

export function strokeOutline(item: StrokeItem): number[][] {
    const hit = outlines.get(item);
    if (hit) return hit;
    const pts: number[][] = [];
    let realPressure = false;
    for (let i = 0; i < item.points.length; i += 3) {
        pts.push([item.points[i], item.points[i + 1], item.points[i + 2]]);
        if (item.points[i + 2] !== 0.5) realPressure = true;
    }
    const outline = item.tool === 'highlighter'
        ? getStroke(pts, { size: item.size, thinning: 0, smoothing: 0.5, streamline: 0.4, simulatePressure: false, last: true, start: { cap: false }, end: { cap: false } })
        : getStroke(pts, { size: item.size, thinning: 0.55, smoothing: 0.5, streamline: 0.5, simulatePressure: !realPressure, last: true });
    outlines.set(item, outline);
    return outline;
}

const f = (n: number) => String(Math.round(n * 100) / 100);

export function outlineToPath(outline: number[][]): string {
    if (outline.length === 0) return '';
    return `M${outline.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;
}

export interface ShapeGeometry {
    stroke: string;
    fill: string | null;
    head: string | null;
}

export function shapeGeometry(s: ShapeItem): ShapeGeometry {
    const { w, h } = s;
    if (s.shape === 'rect') {
        const d = `M0 0H${f(w)}V${f(h)}H0Z`;
        return { stroke: d, fill: s.fill ? d : null, head: null };
    }
    if (s.shape === 'ellipse') {
        const k = 0.5522847498, rx = w / 2, ry = h / 2;
        const d = `M${f(w)} ${f(ry)}C${f(w)} ${f(ry + ry * k)} ${f(rx + rx * k)} ${f(h)} ${f(rx)} ${f(h)}`
            + `C${f(rx - rx * k)} ${f(h)} 0 ${f(ry + ry * k)} 0 ${f(ry)}`
            + `C0 ${f(ry - ry * k)} ${f(rx - rx * k)} 0 ${f(rx)} 0`
            + `C${f(rx + rx * k)} 0 ${f(w)} ${f(ry - ry * k)} ${f(w)} ${f(ry)}Z`;
        return { stroke: d, fill: s.fill ? d : null, head: null };
    }
    const ax = s.flipX ? w : 0, ay = s.flipY ? h : 0, bx = s.flipX ? 0 : w, by = s.flipY ? 0 : h;
    if (s.shape === 'line') return { stroke: `M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}`, fill: null, head: null };
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    const headLen = Math.min(len * 0.6, Math.max(6, s.strokeWidth * 4));
    const headW = headLen * 0.8;
    const baseX = bx - ux * headLen, baseY = by - uy * headLen;
    const nx = -uy, ny = ux;
    const head = `M${f(bx)} ${f(by)}L${f(baseX + nx * headW / 2)} ${f(baseY + ny * headW / 2)}L${f(baseX - nx * headW / 2)} ${f(baseY - ny * headW / 2)}Z`;
    return { stroke: `M${f(ax)} ${f(ay)}L${f(baseX + ux * 0.5)} ${f(baseY + uy * 0.5)}`, fill: null, head };
}
```

- [ ] **Step 5: Implement the renderer**

`app/src/render/drawPage.ts`:
```ts
import { itemMatrix } from '../model/geometry';
import { columnGuides, pageDimensions, printableArea } from '../model/pageSizes';
import type { Id, ImageItem, Item, Page, PageSetup, TextItem } from '../model/types';
import { cssFont } from './fonts';
import { outlineToPath, shapeGeometry, strokeOutline } from './strokes';
import type { TextLayout } from './textLayout';

export interface RenderAssets {
    /** Full-size, filtered source for the image's asset, or null while it loads. */
    image(item: ImageItem): CanvasImageSource | null;
    textLayout(item: TextItem): TextLayout;
    math(tex: string, display: boolean, color: string): CanvasImageSource | null;
}

export interface DrawOptions {
    guides?: boolean;
    hidden?: ReadonlySet<Id>;
    /** Page colour; null draws no background (transparent PNG export). */
    background?: string | null;
}

export const GUIDE_COLOR = 'rgba(47, 111, 219, 0.45)';
const PLACEHOLDER = '#e7e3d9';

function drawGuides(ctx: CanvasRenderingContext2D, setup: PageSetup) {
    const { w, h } = pageDimensions(setup);
    const a = printableArea(setup);
    ctx.save();
    ctx.strokeStyle = GUIDE_COLOR;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(a.x, a.y, a.w, a.h);
    for (const x of columnGuides(setup)) {
        ctx.beginPath();
        ctx.moveTo(x, a.y);
        ctx.lineTo(x, a.y + a.h);
        ctx.stroke();
    }
    if (setup.grid > 0) {
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(47, 111, 219, 0.12)';
        ctx.beginPath();
        for (let x = setup.grid; x < w; x += setup.grid) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
        }
        for (let y = setup.grid; y < h; y += setup.grid) {
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();
    }
    ctx.restore();
}

export function drawItem(ctx: CanvasRenderingContext2D, item: Item, assets: RenderAssets): void {
    ctx.save();
    const m = itemMatrix(item);
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    switch (item.kind) {
        case 'image': {
            const src = assets.image(item);
            if (src) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(src, item.crop.x, item.crop.y, item.crop.w, item.crop.h, 0, 0, item.w, item.h);
            } else {
                ctx.fillStyle = PLACEHOLDER;
                ctx.fillRect(0, 0, item.w, item.h);
            }
            break;
        }
        case 'text': {
            if (item.background) {
                ctx.fillStyle = item.background;
                ctx.fillRect(0, 0, item.w, item.h);
            }
            const layout = assets.textLayout(item);
            ctx.fillStyle = item.color;
            ctx.textBaseline = 'alphabetic';
            for (const run of layout.runs) {
                if (run.kind === 'text') {
                    ctx.font = cssFont(run.font);
                    ctx.fillText(run.text, item.padding + run.x, item.padding + run.baseline);
                } else {
                    const img = assets.math(run.tex, run.display, item.color);
                    if (img) ctx.drawImage(img, item.padding + run.x, item.padding + run.top, run.w, run.h);
                }
            }
            break;
        }
        case 'shape': {
            const g = shapeGeometry(item);
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            if (g.fill && item.fill) {
                ctx.fillStyle = item.fill;
                ctx.fill(new Path2D(g.fill));
            }
            if (item.strokeWidth > 0) {
                ctx.strokeStyle = item.stroke;
                ctx.lineWidth = item.strokeWidth;
                ctx.stroke(new Path2D(g.stroke));
            }
            if (g.head) {
                ctx.fillStyle = item.stroke;
                ctx.fill(new Path2D(g.head));
            }
            break;
        }
        case 'stroke': {
            if (item.tool === 'highlighter') ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = item.color;
            ctx.fill(new Path2D(outlineToPath(strokeOutline(item))));
            break;
        }
    }
    ctx.restore();
}

/** Draws in page points; the caller sets the transform from points to device pixels. */
export function drawPage(ctx: CanvasRenderingContext2D, page: Page, setup: PageSetup, assets: RenderAssets, opts: DrawOptions = {}): void {
    const { w, h } = pageDimensions(setup);
    if (opts.background !== null) {
        ctx.fillStyle = opts.background ?? '#ffffff';
        ctx.fillRect(0, 0, w, h);
    }
    if (opts.guides) drawGuides(ctx, setup);
    for (const item of page.items) {
        if (!opts.hidden?.has(item.id)) drawItem(ctx, item, assets);
    }
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run app/src/render`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/render app/src/test
git commit -m "feat(render): one Canvas2D page renderer for images, text, shapes and strokes"
```

---

### Task 12: PDF and PNG export

**Files:**
- Create: `app/src/render/exportPdf.ts`, `app/src/render/rasterize.ts`, `app/src/render/exportPng.ts`
- Test: `app/src/render/exportPdf.test.ts`

**Interfaces:**
- Consumes: `itemMatrix`, `multiply`, `translation`, `scaling`, `apply`, `Matrix`, `pageDimensions`, `shapeGeometry`, `strokeOutline`, `outlineToPath`, `parseColor`, `drawItem`, `drawPage`, `RenderAssets`.
- Produces: `pdfMatrix(box, pageH, mode: 'path' | 'image'): Matrix`; `PdfDeps {imageBytes(item): Promise<{key, bytes, format: 'png' | 'jpg'}>; textPng(item, dpi): Promise<Uint8Array>}`; `PdfOptions {dpi, pages?}`; `exportPdf(doc, deps, options): Promise<Uint8Array>`. Browser-only: `AnyCanvas`, `createCanvas(w, h)`, `canvasToBlob(canvas, type?, quality?)`, `canvasToBytes(canvas, type?, quality?)`, `browserPdfDeps(assets: RenderAssets, mimeOf: (assetId) => string): PdfDeps`, `renderPageBlob(doc, pageIndex, dpi, assets, transparent?)`, `safeFileName(title)`, `exportPngs(doc, pages, dpi, assets): Promise<{name, blob}[]>`.

- [ ] **Step 1: Write failing tests**

`app/src/render/exportPdf.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { exportPdf, pdfMatrix, type PdfDeps } from './exportPdf';
import { addItems, addPage } from '../model/commands';
import { createDocument, createImageItem, createShapeItem, createStrokeItem, createTextItem } from '../model/factory';
import { apply, itemMatrix } from '../model/geometry';

const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
const deps: PdfDeps = {
    imageBytes: async (item) => ({ key: `${item.assetId}|${item.crop.x}`, bytes: PNG, format: 'png' }),
    textPng: async () => PNG,
};

describe('pdfMatrix', () => {
    test('an unrotated image lands where it is on screen, with y flipped', () => {
        const H = 800;
        const box = { x: 10, y: 20, w: 100, h: 50, rotation: 0 };
        const m = pdfMatrix(box, H, 'image');
        expect(apply(m, { x: 0, y: 0 })).toEqual({ x: 10, y: H - 70 });
        expect(apply(m, { x: 0, y: 50 })).toEqual({ x: 10, y: H - 20 });
    });
    test('a rotated image puts its top-left pixel where the canvas does', () => {
        const H = 800;
        const box = { x: 10, y: 20, w: 100, h: 50, rotation: 90 };
        const onScreen = apply(itemMatrix(box), { x: 0, y: 0 });
        const inPdf = apply(pdfMatrix(box, H, 'image'), { x: 0, y: 50 });
        expect(inPdf.x).toBeCloseTo(onScreen.x);
        expect(inPdf.y).toBeCloseTo(H - onScreen.y);
    });
    test('paths keep local y-down coordinates', () => {
        const H = 800;
        const box = { x: 10, y: 20, w: 100, h: 50, rotation: 30 };
        const local = { x: 7, y: 9 };
        const page = apply(itemMatrix(box), local);
        // drawSvgPath applies scale(1, -1) itself, so compose with it here
        const p = apply(pdfMatrix(box, H, 'path'), { x: local.x, y: -local.y });
        expect(p.x).toBeCloseTo(page.x);
        expect(p.y).toBeCloseTo(H - page.y);
    });
});

test('exports every page at the document size with deduplicated images', async () => {
    let doc = createDocument('Export', 0);
    const asset = { id: 'a', mime: 'image/png', width: 1, height: 1 };
    const img1 = createImageItem(asset, { x: 100, y: 100 }, 50, 50);
    const img2 = createImageItem(asset, { x: 200, y: 200 }, 50, 50);
    const text = createTextItem({ x: 10, y: 10 }, { font: 'sans', fontSize: 9, color: '#000', background: '#ffff00', align: 'left' }, 80, 'hi');
    const arrow = createShapeItem('arrow', { x: 0, y: 0, w: 40, h: 40 }, { stroke: '#123456', strokeWidth: 2, fill: null });
    const hl = createStrokeItem([0, 0, 0.5, 30, 0, 0.5], 'highlighter', '#ffd43b80', 10);
    doc = addItems(doc, 0, [img1, img2, { ...text, rotation: 45 }, arrow, hl]);
    doc = addPage(doc);
    const bytes = await exportPdf({ ...doc, setup: { ...doc.setup, orientation: 'landscape' } }, deps, { dpi: 300 });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeCloseTo(841.89, 1);
    expect(height).toBeCloseTo(595.28, 1);
    // pdf-lib adds a resource key per draw call, so count distinct image objects instead.
    const xobjects = pdf.getPage(0).node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
    const refs = new Set(xobjects.values().map((v) => String(v)));
    expect(refs.size).toBe(2); // one shared photo, one text raster
});

test('exports only the requested pages', async () => {
    const doc = addPage(addPage(createDocument('t', 0)));
    const pdf = await PDFDocument.load(await exportPdf(doc, deps, { dpi: 150, pages: [2] }));
    expect(pdf.getPageCount()).toBe(1);
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run app/src/render/exportPdf.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the PDF exporter**

`app/src/render/exportPdf.ts`:
```ts
import {
    BlendMode, LineCapStyle, PDFDocument, concatTransformationMatrix, popGraphicsState, pushGraphicsState, rgb,
    type PDFImage, type PDFPage,
} from 'pdf-lib';
import { itemMatrix, multiply, scaling, translation, type Matrix } from '../model/geometry';
import { pageDimensions } from '../model/pageSizes';
import type { Box, CheatDocument, ImageItem, Item, TextItem } from '../model/types';
import { parseColor } from './colors';
import { outlineToPath, shapeGeometry, strokeOutline } from './strokes';

export interface PdfDeps {
    /** Cropped and filtered pixels. Equal keys mean equal bytes, so they are embedded once. */
    imageBytes(item: ImageItem): Promise<{ key: string; bytes: Uint8Array; format: 'png' | 'jpg' }>;
    /** The text and math of a text box on a transparent background, at `dpi`. */
    textPng(item: TextItem, dpi: number): Promise<Uint8Array>;
}

export interface PdfOptions {
    dpi: number;
    pages?: number[];
}

/**
 * Page-to-PDF transform for an item. 'image' maps pdf-lib's y-up unit image
 * onto the item box; 'path' cancels the scale(1, -1) that drawSvgPath adds.
 */
export function pdfMatrix(box: Box, pageH: number, mode: 'path' | 'image'): Matrix {
    const flip: Matrix = [1, 0, 0, -1, 0, pageH];
    const base = multiply(flip, itemMatrix(box));
    return mode === 'path'
        ? multiply(base, scaling(1, -1))
        : multiply(multiply(base, translation(0, box.h)), scaling(1, -1));
}

function colour(css: string) {
    const c = parseColor(css);
    return { color: rgb(c.r / 255, c.g / 255, c.b / 255), opacity: c.a };
}

function withMatrix(page: PDFPage, m: Matrix, draw: () => void) {
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...m));
    draw();
    page.pushOperators(popGraphicsState());
}

async function drawItemPdf(pdf: PDFDocument, page: PDFPage, item: Item, H: number, images: Map<string, PDFImage>, deps: PdfDeps, dpi: number) {
    switch (item.kind) {
        case 'image': {
            const { key, bytes, format } = await deps.imageBytes(item);
            let img = images.get(key);
            if (!img) {
                img = format === 'png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
                images.set(key, img);
            }
            const embedded = img;
            withMatrix(page, pdfMatrix(item, H, 'image'), () => page.drawImage(embedded, { x: 0, y: 0, width: item.w, height: item.h }));
            break;
        }
        case 'text': {
            if (item.background) {
                const bg = colour(item.background);
                withMatrix(page, pdfMatrix(item, H, 'path'), () =>
                    page.drawSvgPath(`M0 0H${item.w}V${item.h}H0Z`, { x: 0, y: 0, color: bg.color, opacity: bg.opacity, borderWidth: 0 }));
            }
            if (item.text.trim()) {
                const img = await pdf.embedPng(await deps.textPng(item, dpi));
                withMatrix(page, pdfMatrix(item, H, 'image'), () => page.drawImage(img, { x: 0, y: 0, width: item.w, height: item.h }));
            }
            break;
        }
        case 'shape': {
            const g = shapeGeometry(item);
            const s = colour(item.stroke);
            withMatrix(page, pdfMatrix(item, H, 'path'), () => {
                if (g.fill && item.fill) {
                    const fc = colour(item.fill);
                    page.drawSvgPath(g.fill, { x: 0, y: 0, color: fc.color, opacity: fc.opacity, borderWidth: 0 });
                }
                if (item.strokeWidth > 0) {
                    page.drawSvgPath(g.stroke, {
                        x: 0, y: 0, borderColor: s.color, borderOpacity: s.opacity, borderWidth: item.strokeWidth,
                        borderLineCap: LineCapStyle.Round,
                    });
                }
                if (g.head) page.drawSvgPath(g.head, { x: 0, y: 0, color: s.color, opacity: s.opacity, borderWidth: 0 });
            });
            break;
        }
        case 'stroke': {
            const c = colour(item.color);
            const d = outlineToPath(strokeOutline(item));
            if (!d) break;
            withMatrix(page, pdfMatrix(item, H, 'path'), () =>
                page.drawSvgPath(d, {
                    x: 0, y: 0, color: c.color, opacity: c.opacity, borderWidth: 0,
                    blendMode: item.tool === 'highlighter' ? BlendMode.Multiply : undefined,
                }));
            break;
        }
    }
}

export async function exportPdf(doc: CheatDocument, deps: PdfDeps, opts: PdfOptions): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    pdf.setTitle(doc.title);
    pdf.setCreator('Cheatsheet Maker');
    pdf.setProducer('Cheatsheet Maker');
    const { w, h } = pageDimensions(doc.setup);
    const images = new Map<string, PDFImage>();
    for (const index of opts.pages ?? doc.pages.map((_, i) => i)) {
        const src = doc.pages[index];
        if (!src) continue;
        const page = pdf.addPage([w, h]);
        for (const item of src.items) await drawItemPdf(pdf, page, item, h, images, deps, opts.dpi);
    }
    return pdf.save();
}
```

- [ ] **Step 4: Run the PDF tests**

Run: `npx vitest run app/src/render/exportPdf.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement browser rasterising and PNG export (covered by Playwright in Task 25)**

`app/src/render/rasterize.ts`:
```ts
import type { ImageItem, TextItem } from '../model/types';
import { drawItem, type RenderAssets } from './drawPage';
import type { PdfDeps } from './exportPdf';
import { filtersKey } from './filters';

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export function createCanvas(w: number, h: number): AnyCanvas {
    const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(W, H);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c;
}

export async function canvasToBlob(canvas: AnyCanvas, type = 'image/png', quality?: number): Promise<Blob> {
    if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
    return new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The browser could not encode the image.'))), type, quality));
}

export async function canvasToBytes(canvas: AnyCanvas, type = 'image/png', quality?: number): Promise<Uint8Array> {
    return new Uint8Array(await (await canvasToBlob(canvas, type, quality)).arrayBuffer());
}

function hasTransparency(ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, w: number, h: number): boolean {
    const d = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
    return false;
}

/** Export dependencies backed by the editor's renderer and caches. */
export function browserPdfDeps(assets: RenderAssets, mimeOf: (assetId: string) => string): PdfDeps {
    return {
        async imageBytes(item: ImageItem) {
            const src = assets.image(item);
            if (!src) throw new Error('An image is still loading. Try exporting again in a moment.');
            const c = createCanvas(item.crop.w, item.crop.h);
            const ctx = c.getContext('2d') as CanvasRenderingContext2D;
            ctx.drawImage(src, item.crop.x, item.crop.y, item.crop.w, item.crop.h, 0, 0, c.width, c.height);
            const photo = mimeOf(item.assetId) === 'image/jpeg' && !hasTransparency(ctx, c.width, c.height);
            const key = `${item.assetId}|${item.crop.x},${item.crop.y},${item.crop.w},${item.crop.h}|${filtersKey(item.filters)}`;
            return photo
                ? { key, bytes: await canvasToBytes(c, 'image/jpeg', 0.9), format: 'jpg' as const }
                : { key, bytes: await canvasToBytes(c), format: 'png' as const };
        },
        async textPng(item: TextItem, dpi: number) {
            const s = dpi / 72;
            const c = createCanvas(item.w * s, item.h * s);
            const ctx = c.getContext('2d') as CanvasRenderingContext2D;
            ctx.scale(c.width / item.w, c.height / item.h);
            drawItem(ctx, { ...item, x: 0, y: 0, rotation: 0, background: null }, assets);
            return canvasToBytes(c);
        },
    };
}
```

`app/src/render/exportPng.ts`:
```ts
import { pageDimensions } from '../model/pageSizes';
import type { CheatDocument } from '../model/types';
import { drawPage, type RenderAssets } from './drawPage';
import { canvasToBlob, createCanvas } from './rasterize';

export async function renderPageBlob(doc: CheatDocument, pageIndex: number, dpi: number, assets: RenderAssets, transparent = false): Promise<Blob> {
    const { w, h } = pageDimensions(doc.setup);
    const s = dpi / 72;
    const c = createCanvas(w * s, h * s);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    ctx.scale(c.width / w, c.height / h);
    drawPage(ctx, doc.pages[pageIndex], doc.setup, assets, { background: transparent ? null : '#ffffff' });
    return canvasToBlob(c);
}

export function safeFileName(title: string): string {
    const base = title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
    return base || 'cheatsheet';
}

export async function exportPngs(doc: CheatDocument, pages: number[], dpi: number, assets: RenderAssets): Promise<Array<{ name: string; blob: Blob }>> {
    const name = safeFileName(doc.title);
    const out: Array<{ name: string; blob: Blob }> = [];
    for (const i of pages) {
        out.push({ name: pages.length === 1 ? `${name}.png` : `${name} page ${i + 1}.png`, blob: await renderPageBlob(doc, i, dpi, assets) });
    }
    return out;
}
```

- [ ] **Step 6: Run all tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/render
git commit -m "feat(render): PDF export with vector strokes and shapes, PNG export"
```

---
## Phase C: Storage and platform

### Task 13: Document library and autosave

**Files:**
- Create: `app/src/storage/library.ts`, `app/src/storage/autosave.ts`
- Test: `app/src/storage/library.test.ts`, `app/src/storage/autosave.test.ts`

**Interfaces:**
- Consumes: `CheatDocument`, `AssetBytes`, `sha256Hex`, `referencedAssetIds`, `pruneAssets`, `newId`.
- Produces: `DocSummary {id, title, updatedAt, pageCount, thumb: Blob | null}`; `interface LibraryApi { list(); get(id); put(doc, thumb?); remove(id); putAsset(bytes, mime): Promise<Id>; getAsset(id): Promise<Blob | null>; getAssetBytes(id): Promise<Uint8Array | null>; gc(): Promise<number>; getMeta<T>(key); setMeta(key, value); importDocument(doc, assets): Promise<CheatDocument> }`; `openIdbLibrary(name?): Promise<LibraryApi>`; `class MemoryLibrary implements LibraryApi`; `openLibrary(): Promise<{library, persistent: boolean, reason?: string}>`; `describeStorageError(e): string`. Autosave: `SaveStatus = {state:'saved', at} | {state:'saving'} | {state:'error', message}`; `Autosaver {schedule(doc), flush(), dispose()}`; `createAutosaver(save, onStatus, delay = 500)`.

Assets are stored as `ArrayBuffer` plus MIME type rather than `Blob`, because older Safari versions cannot store Blobs in IndexedDB.

- [ ] **Step 1: Write failing tests**

`app/src/storage/library.test.ts`:
```ts
import 'fake-indexeddb/auto';
import { describe, expect, test } from 'vitest';
import { MemoryLibrary, openIdbLibrary, type LibraryApi } from './library';
import { addAsset, addItems, removeItems } from '../model/commands';
import { createDocument, createImageItem } from '../model/factory';
import { sha256Hex } from '../model/hash';

const bytes = new Uint8Array([137, 80, 78, 71, 9, 9, 9]);

async function docWithImage(lib: LibraryApi) {
    const id = await lib.putAsset(bytes, 'image/png');
    const meta = { id, mime: 'image/png', width: 1, height: 1 };
    const img = createImageItem(meta, { x: 10, y: 10 }, 100, 100);
    return { doc: addAsset(addItems(createDocument('With image', 1), 0, [img]), meta), img, id };
}

describe.each([
    ['IndexedDB', () => openIdbLibrary(`test-${Math.random()}`)],
    ['memory', async () => new MemoryLibrary()],
])('%s library', (_name, open) => {
    test('stores, lists newest first and deletes documents', async () => {
        const lib = await open();
        const a = { ...createDocument('A', 1), updatedAt: 10 };
        const b = { ...createDocument('B', 1), updatedAt: 20 };
        await lib.put(a);
        await lib.put(b);
        expect((await lib.list()).map((d) => d.title)).toEqual(['B', 'A']);
        expect(await lib.get(a.id)).toEqual(a);
        await lib.remove(a.id);
        expect(await lib.get(a.id)).toBeNull();
    });
    test('assets are content addressed and garbage collected', async () => {
        const lib = await open();
        const { doc, img, id } = await docWithImage(lib);
        expect(id).toBe(await sha256Hex(bytes));
        expect(await lib.putAsset(bytes, 'image/png')).toBe(id);
        await lib.put(doc);
        expect(await lib.gc()).toBe(0);
        expect(await lib.getAssetBytes(id)).toEqual(bytes);
        await lib.put(removeItems(doc, [img.id]));
        expect(await lib.gc()).toBe(1);
        expect(await lib.getAsset(id)).toBeNull();
    });
    test('importing never overwrites an existing document', async () => {
        const lib = await open();
        const doc = createDocument('Mine', 1);
        await lib.put(doc);
        const imported = await lib.importDocument(doc, new Map());
        expect(imported.id).not.toBe(doc.id);
        expect((await lib.list())).toHaveLength(2);
    });
    test('meta values round trip', async () => {
        const lib = await open();
        await lib.setMeta('lastDoc', 'abc');
        expect(await lib.getMeta('lastDoc')).toBe('abc');
        expect(await lib.getMeta('missing')).toBeUndefined();
    });
});
```

`app/src/storage/autosave.test.ts`:
```ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createAutosaver, describeStorageError, type SaveStatus } from './autosave';
import { createDocument } from '../model/factory';
import { setTitle } from '../model/commands';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('debounces to the last document after 500 ms', async () => {
    const saved: string[] = [];
    const statuses: SaveStatus['state'][] = [];
    const a = createAutosaver(async (d) => { saved.push(d.title); }, (s) => statuses.push(s.state));
    const doc = createDocument('one', 0);
    a.schedule(doc);
    a.schedule(setTitle(doc, 'two'));
    await vi.advanceTimersByTimeAsync(499);
    expect(saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(saved).toEqual(['two']);
    expect(statuses).toEqual(['saving', 'saved']);
});

test('reports failures and keeps editing possible', async () => {
    const statuses: SaveStatus[] = [];
    const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    const a = createAutosaver(async () => { throw quota; }, (s) => statuses.push(s));
    a.schedule(createDocument('x', 0));
    await vi.advanceTimersByTimeAsync(500);
    expect(statuses.at(-1)).toEqual({ state: 'error', message: describeStorageError(quota) });
    expect(describeStorageError(quota)).toMatch(/full/i);
});

test('flush saves immediately and saves run one at a time', async () => {
    let running = 0, maxRunning = 0;
    const a = createAutosaver(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 100));
        running--;
    }, () => {});
    const doc = createDocument('x', 0);
    a.schedule(doc);
    const f1 = a.flush();
    a.schedule(setTitle(doc, 'y'));
    const f2 = a.flush();
    await vi.advanceTimersByTimeAsync(300);
    await Promise.all([f1, f2]);
    expect(maxRunning).toBe(1);
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run app/src/storage`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the library**

`app/src/storage/library.ts`:
```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { referencedAssetIds } from '../model/commands';
import type { AssetBytes } from '../model/format';
import { sha256Hex } from '../model/hash';
import { newId } from '../model/ids';
import type { CheatDocument, Id } from '../model/types';
import { describeStorageError } from './autosave';

export interface DocSummary {
    id: Id;
    title: string;
    updatedAt: number;
    pageCount: number;
    thumb: Blob | null;
}

export interface LibraryApi {
    list(): Promise<DocSummary[]>;
    get(id: Id): Promise<CheatDocument | null>;
    /** `thumb` undefined keeps the stored thumbnail. */
    put(doc: CheatDocument, thumb?: Blob | null): Promise<void>;
    remove(id: Id): Promise<void>;
    putAsset(bytes: Uint8Array, mime: string): Promise<Id>;
    getAsset(id: Id): Promise<Blob | null>;
    getAssetBytes(id: Id): Promise<Uint8Array | null>;
    /** Deletes assets no stored document references; returns how many. */
    gc(): Promise<number>;
    getMeta<T>(key: string): Promise<T | undefined>;
    setMeta(key: string, value: unknown): Promise<void>;
    /** Stores the assets and adds the document under a new id. */
    importDocument(doc: CheatDocument, assets: AssetBytes): Promise<CheatDocument>;
}

interface StoredDoc {
    id: Id;
    title: string;
    updatedAt: number;
    pageCount: number;
    doc: CheatDocument;
    thumb: { bytes: ArrayBuffer; mime: string } | null;
}
interface StoredAsset {
    id: Id;
    mime: string;
    bytes: ArrayBuffer;
}

interface Schema extends DBSchema {
    docs: { key: string; value: StoredDoc };
    assets: { key: string; value: StoredAsset };
    meta: { key: string; value: { key: string; value: unknown } };
}

const copyBuffer = (b: Uint8Array): ArrayBuffer => b.slice().buffer as ArrayBuffer;
const toBlob = (t: { bytes: ArrayBuffer; mime: string } | null) => (t ? new Blob([t.bytes], { type: t.mime }) : null);

function summary(s: StoredDoc): DocSummary {
    return { id: s.id, title: s.title, updatedAt: s.updatedAt, pageCount: s.pageCount, thumb: toBlob(s.thumb) };
}

async function stored(doc: CheatDocument, thumb: Blob | null | undefined, previous: StoredDoc | undefined): Promise<StoredDoc> {
    const t = thumb === undefined ? previous?.thumb ?? null : thumb ? { bytes: await thumb.arrayBuffer(), mime: thumb.type } : null;
    return { id: doc.id, title: doc.title, updatedAt: doc.updatedAt, pageCount: doc.pages.length, doc, thumb: t };
}

class IdbLibrary implements LibraryApi {
    constructor(private db: IDBPDatabase<Schema>) {}

    async list() {
        const all = await this.db.getAll('docs');
        return all.sort((a, b) => b.updatedAt - a.updatedAt).map(summary);
    }
    async get(id: Id) {
        return (await this.db.get('docs', id))?.doc ?? null;
    }
    async put(doc: CheatDocument, thumb?: Blob | null) {
        const prev = thumb === undefined ? await this.db.get('docs', doc.id) : undefined;
        await this.db.put('docs', await stored(doc, thumb, prev));
    }
    async remove(id: Id) {
        await this.db.delete('docs', id);
        await this.gc();
    }
    async putAsset(bytes: Uint8Array, mime: string) {
        const id = await sha256Hex(bytes);
        if (!(await this.db.getKey('assets', id))) await this.db.put('assets', { id, mime, bytes: copyBuffer(bytes) });
        return id;
    }
    async getAsset(id: Id) {
        const a = await this.db.get('assets', id);
        return a ? new Blob([a.bytes], { type: a.mime }) : null;
    }
    async getAssetBytes(id: Id) {
        const a = await this.db.get('assets', id);
        return a ? new Uint8Array(a.bytes) : null;
    }
    async gc() {
        const used = new Set<Id>();
        for (const d of await this.db.getAll('docs')) for (const id of referencedAssetIds(d.doc)) used.add(id);
        let removed = 0;
        for (const key of await this.db.getAllKeys('assets')) {
            if (!used.has(key)) {
                await this.db.delete('assets', key);
                removed++;
            }
        }
        return removed;
    }
    async getMeta<T>(key: string) {
        return (await this.db.get('meta', key))?.value as T | undefined;
    }
    async setMeta(key: string, value: unknown) {
        await this.db.put('meta', { key, value });
    }
    async importDocument(doc: CheatDocument, assets: AssetBytes) {
        for (const a of assets.values()) await this.putAsset(a.bytes, a.mime);
        const copy = { ...doc, id: newId(), updatedAt: Date.now() };
        await this.put(copy, null);
        return copy;
    }
}

export async function openIdbLibrary(name = 'cheatsheet-maker'): Promise<LibraryApi> {
    const db = await openDB<Schema>(name, 1, {
        upgrade(db) {
            db.createObjectStore('docs', { keyPath: 'id' });
            db.createObjectStore('assets', { keyPath: 'id' });
            db.createObjectStore('meta', { keyPath: 'key' });
        },
    });
    return new IdbLibrary(db);
}

/** Used when IndexedDB is unavailable: everything works until the tab closes. */
export class MemoryLibrary implements LibraryApi {
    private docs = new Map<Id, StoredDoc>();
    private assets = new Map<Id, StoredAsset>();
    private meta = new Map<string, unknown>();

    async list() {
        return [...this.docs.values()].sort((a, b) => b.updatedAt - a.updatedAt).map(summary);
    }
    async get(id: Id) {
        return this.docs.get(id)?.doc ?? null;
    }
    async put(doc: CheatDocument, thumb?: Blob | null) {
        this.docs.set(doc.id, await stored(doc, thumb, this.docs.get(doc.id)));
    }
    async remove(id: Id) {
        this.docs.delete(id);
        await this.gc();
    }
    async putAsset(bytes: Uint8Array, mime: string) {
        const id = await sha256Hex(bytes);
        if (!this.assets.has(id)) this.assets.set(id, { id, mime, bytes: copyBuffer(bytes) });
        return id;
    }
    async getAsset(id: Id) {
        const a = this.assets.get(id);
        return a ? new Blob([a.bytes], { type: a.mime }) : null;
    }
    async getAssetBytes(id: Id) {
        const a = this.assets.get(id);
        return a ? new Uint8Array(a.bytes) : null;
    }
    async gc() {
        const used = new Set<Id>();
        for (const d of this.docs.values()) for (const id of referencedAssetIds(d.doc)) used.add(id);
        let removed = 0;
        for (const id of [...this.assets.keys()]) {
            if (!used.has(id)) {
                this.assets.delete(id);
                removed++;
            }
        }
        return removed;
    }
    async getMeta<T>(key: string) {
        return this.meta.get(key) as T | undefined;
    }
    async setMeta(key: string, value: unknown) {
        this.meta.set(key, value);
    }
    async importDocument(doc: CheatDocument, assets: AssetBytes) {
        for (const a of assets.values()) await this.putAsset(a.bytes, a.mime);
        const copy = { ...doc, id: newId(), updatedAt: Date.now() };
        await this.put(copy, null);
        return copy;
    }
}

export async function openLibrary(): Promise<{ library: LibraryApi; persistent: boolean; reason?: string }> {
    try {
        const library = await openIdbLibrary();
        navigator.storage?.persist?.().catch(() => undefined);
        return { library, persistent: true };
    } catch (e) {
        return { library: new MemoryLibrary(), persistent: false, reason: describeStorageError(e) };
    }
}
```

- [ ] **Step 4: Implement autosave**

`app/src/storage/autosave.ts`:
```ts
import type { CheatDocument } from '../model/types';

export type SaveStatus = { state: 'saved'; at: number } | { state: 'saving' } | { state: 'error'; message: string };

export function describeStorageError(e: unknown): string {
    const name = (e as { name?: string })?.name;
    if (name === 'QuotaExceededError') return 'Storage is full. Export a backup and delete cheatsheets you no longer need.';
    if (name === 'InvalidStateError' || name === 'UnknownError' || name === 'SecurityError') {
        return 'This browser is not letting the app store anything (a private window does this).';
    }
    return `Could not save: ${(e as Error)?.message ?? String(e)}`;
}

export interface Autosaver {
    schedule(doc: CheatDocument): void;
    flush(): Promise<void>;
    dispose(): void;
}

export function createAutosaver(save: (doc: CheatDocument) => Promise<void>, onStatus: (s: SaveStatus) => void, delay = 500): Autosaver {
    let pending: CheatDocument | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let chain: Promise<void> = Promise.resolve();
    let last: SaveStatus['state'] | null = null;
    const report = (s: SaveStatus) => {
        if (s.state === 'saving' && last === 'saving') return;
        last = s.state;
        onStatus(s);
    };

    const run = () => {
        timer = null;
        chain = chain.then(async () => {
            const doc = pending;
            if (!doc) return;
            pending = null;
            try {
                await save(doc);
                if (!pending && !timer) report({ state: 'saved', at: Date.now() });
            } catch (e) {
                pending ??= doc;
                report({ state: 'error', message: describeStorageError(e) });
            }
        });
        return chain;
    };

    return {
        schedule(doc) {
            pending = doc;
            report({ state: 'saving' });
            if (timer) clearTimeout(timer);
            timer = setTimeout(run, delay);
        },
        flush() {
            if (timer) clearTimeout(timer);
            return run();
        },
        dispose() {
            if (timer) clearTimeout(timer);
            timer = null;
        },
    };
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run app/src/storage`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/storage
git commit -m "feat(storage): IndexedDB library with content-addressed assets and debounced autosave"
```

---

### Task 14: Platform adapters and file classification

**Files:**
- Create: `app/src/platform/index.ts`, `app/src/platform/web.ts`, `app/src/platform/tauri.ts`, `app/src/platform/classify.ts`
- Test: `app/src/platform/classify.test.ts`, `app/src/platform/web.test.ts`

**Interfaces:**
- Produces: `SaveKind = 'pdf' | 'png' | 'zip' | 'cheatsheet'`; `interface Platform { kind: 'web' | 'tauri'; saveFile(name, data: Blob, kind): Promise<'saved' | 'cancelled'>; pickFiles(accept: string, multiple: boolean, capture?: boolean): Promise<File[]>; readLegacyAutosave(): Promise<string | null> }`; `isTauri()`, `getPlatform(): Promise<Platform>`; `webPlatform: Platform`; `FileKind = 'image' | 'pdf' | 'cheatsheet' | 'legacy-json' | 'unknown'`; `classifyFile(name, mime): FileKind`; `ACCEPT = {images, pdf, documents, any}`.

Opening files uses an `<input type="file">` on every platform (Tauri webviews support it on desktop and Android). Saving uses the Tauri dialog in Tauri because webviews do not download.

- [ ] **Step 1: Write failing tests**

`app/src/platform/classify.test.ts`:
```ts
import { expect, test } from 'vitest';
import { classifyFile } from './classify';

test.each([
    ['shot.png', 'image/png', 'image'],
    ['photo.HEIC', '', 'unknown'],
    ['scan.jpg', '', 'image'],
    ['slides.pdf', 'application/pdf', 'pdf'],
    ['Exam.cheatsheet', '', 'cheatsheet'],
    ['Exam.cheatsheet', 'application/zip', 'cheatsheet'],
    ['autosave.json', 'application/json', 'legacy-json'],
    ['notes.txt', 'text/plain', 'unknown'],
])('%s (%s) is %s', (name, mime, kind) => {
    expect(classifyFile(name, mime)).toBe(kind);
});
```

`app/src/platform/web.test.ts`:
```ts
// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { webPlatform } from './web';

test('saving without the File System Access API clicks a download link', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    expect(await webPlatform.saveFile('a.pdf', new Blob(['x']), 'pdf')).toBe('saved');
    expect(click).toHaveBeenCalledOnce();
});

test('the web has no legacy autosave', async () => {
    expect(await webPlatform.readLegacyAutosave()).toBeNull();
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run app/src/platform`
Expected: FAIL.

- [ ] **Step 3: Implement**

`app/src/platform/classify.ts`:
```ts
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
```

`app/src/platform/index.ts`:
```ts
export type SaveKind = 'pdf' | 'png' | 'zip' | 'cheatsheet';

export interface Platform {
    kind: 'web' | 'tauri';
    saveFile(name: string, data: Blob, kind: SaveKind): Promise<'saved' | 'cancelled'>;
    pickFiles(accept: string, multiple: boolean, capture?: boolean): Promise<File[]>;
    readLegacyAutosave(): Promise<string | null>;
}

export function isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

let cached: Promise<Platform> | null = null;

export function getPlatform(): Promise<Platform> {
    cached ??= isTauri() ? import('./tauri').then((m) => m.tauriPlatform) : import('./web').then((m) => m.webPlatform);
    return cached;
}
```

`app/src/platform/web.ts`:
```ts
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
```

`app/src/platform/tauri.ts`:
```ts
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import type { Platform, SaveKind } from './index';
import { pickFiles } from './web';

const FILTERS: Record<SaveKind, { name: string; extensions: string[] }> = {
    pdf: { name: 'PDF document', extensions: ['pdf'] },
    png: { name: 'PNG image', extensions: ['png'] },
    zip: { name: 'ZIP archive', extensions: ['zip'] },
    cheatsheet: { name: 'Cheatsheet Maker file', extensions: ['cheatsheet'] },
};

export const tauriPlatform: Platform = {
    kind: 'tauri',
    async saveFile(name, data, kind) {
        const path = await save({ defaultPath: name, filters: [FILTERS[kind]] });
        if (!path) return 'cancelled';
        await writeFile(path, new Uint8Array(await data.arrayBuffer()));
        return 'saved';
    },
    pickFiles,
    async readLegacyAutosave() {
        try {
            return await invoke<string | null>('legacy_autosave');
        } catch {
            return null;
        }
    },
};
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run app/src/platform && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/platform
git commit -m "feat(platform): web and Tauri file adapters and file classification"
```

---
## Phase D: Editor UI

UI tasks give the full code for state, geometry and gesture logic, which is where bugs hide, and the exact props, behaviour and tests for presentational components. Presentational markup follows the tokens in Task 15 and the spec's layout section. Load the `frontend-design:frontend-design` skill before Task 15 and keep its direction for every later UI task.

### Task 15: Design tokens, icon, primitives and theme

**Files:**
- Create: `app/src/tokens.css`, `app/src/base.css`, `app/src/ui/theme.ts`, `app/src/ui/icons.tsx`, `app/src/ui/components/{Button.tsx, IconButton.tsx, Menu.tsx, Dialog.tsx, Slider.tsx, Segmented.tsx, ColorSwatches.tsx, Toggle.tsx, NumberField.tsx, Toasts.tsx, components.css}`, `app/icon-source.svg`, `app/public/favicon.svg`, `scripts/render-icons.mjs`
- Modify: `app/index.html` (theme script, icons, theme-color), `app/src/main.tsx` (font and CSS imports)
- Test: `app/src/ui/theme.test.ts`, `app/src/ui/components/components.test.tsx`

**Interfaces:**
- Produces: CSS custom properties listed below; `ThemePref = 'system' | 'light' | 'dark'`, `readThemePref()`, `applyTheme(pref)`, `resolvedTheme(): 'light' | 'dark'`; `Icon` component `<Icon name={IconName} size?={number} />` and `IconName` union; `Button {variant?: 'primary' | 'default' | 'quiet', size?: 'sm' | 'md', icon?: IconName}`; `IconButton {label, icon, pressed?, onClick, shortcut?}`; `MenuButton {label, icon?, items: MenuItem[]}` with `MenuItem = {label, onSelect, shortcut?, disabled?, icon?} | 'separator'`; `Dialog {open, title, onClose, children, footer?}`; `Slider {label, min, max, step, value, onChange, format?}`; `Segmented<T> {label, options: {value: T, label, icon?}[], value, onChange}`; `ColorSwatches {label, colors: string[], value, onChange, allowNone?}`; `Toggle {label, checked, onChange}`; `NumberField {label, value, onChange, unit?, step?, min?, max?}`; `Toasts` reads toasts from the store (Task 16) through props `{toasts, onDismiss}`.

- [ ] **Step 1: Write the tokens**

`app/src/tokens.css`:
```css
:root {
    --font-ui: 'Atkinson Hyperlegible Next Variable', system-ui, sans-serif;
    --font-display: 'Bricolage Grotesque Variable', 'Atkinson Hyperlegible Next Variable', sans-serif;
    --font-mono: 'JetBrains Mono Variable', ui-monospace, monospace;

    --ink: #1b1d22;
    --ink-2: #4a4d55;
    --ink-3: #7b7e86;
    --paper: #f6f4ee;
    --surface: #ffffff;
    --surface-2: #efece4;
    --line: #dedad0;
    --canvas-bg: #e6e2d8;
    --accent: #ffd43b;
    --accent-strong: #f0b90b;
    --accent-ink: #1b1d22;
    --focus: #2f6fdb;
    --danger: #c2412d;
    --ok: #2e7d4f;
    --shadow: 0 1px 2px rgb(27 29 34 / 0.06), 0 6px 20px rgb(27 29 34 / 0.08);
    --page-shadow: 0 1px 3px rgb(27 29 34 / 0.18), 0 8px 24px rgb(27 29 34 / 0.12);

    --radius: 10px;
    --radius-sm: 6px;
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 24px;
    --bar-h: 52px;
    color-scheme: light;
}

@media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
        --ink: #ecebe6;
        --ink-2: #b8b6ae;
        --ink-3: #8a8880;
        --paper: #121316;
        --surface: #1b1c20;
        --surface-2: #25262b;
        --line: #33343a;
        --canvas-bg: #0c0d0f;
        --accent-strong: #ffe066;
        --focus: #7aa7ff;
        --danger: #ff8a73;
        --ok: #7ad19b;
        --shadow: 0 1px 2px rgb(0 0 0 / 0.4), 0 6px 20px rgb(0 0 0 / 0.35);
        --page-shadow: 0 1px 3px rgb(0 0 0 / 0.6), 0 8px 24px rgb(0 0 0 / 0.5);
        color-scheme: dark;
    }
}

:root[data-theme='dark'] {
    --ink: #ecebe6;
    --ink-2: #b8b6ae;
    --ink-3: #8a8880;
    --paper: #121316;
    --surface: #1b1c20;
    --surface-2: #25262b;
    --line: #33343a;
    --canvas-bg: #0c0d0f;
    --accent-strong: #ffe066;
    --focus: #7aa7ff;
    --danger: #ff8a73;
    --ok: #7ad19b;
    --shadow: 0 1px 2px rgb(0 0 0 / 0.4), 0 6px 20px rgb(0 0 0 / 0.35);
    --page-shadow: 0 1px 3px rgb(0 0 0 / 0.6), 0 8px 24px rgb(0 0 0 / 0.5);
    color-scheme: dark;
}
```

`app/src/base.css`:
```css
*, *::before, *::after { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body {
    background: var(--paper);
    color: var(--ink);
    font: 15px/1.4 var(--font-ui);
    -webkit-font-smoothing: antialiased;
    overscroll-behavior: none;
}
button, input, select, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```

- [ ] **Step 2: Draw the icon master**

`app/icon-source.svg` (the page is ink-outlined paper with packed tiles; a highlighter stroke crosses the lower tiles; the background is the accent yellow):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="228" fill="#FFD43B"/>
  <g transform="rotate(-6 512 512)">
    <rect x="270" y="168" width="484" height="688" rx="40" fill="#FFFDF6" stroke="#1B1D22" stroke-width="32"/>
    <rect x="334" y="236" width="356" height="148" rx="16" fill="#1B1D22"/>
    <rect x="334" y="408" width="164" height="232" rx="16" fill="#1B1D22"/>
    <rect x="522" y="408" width="168" height="104" rx="16" fill="#1B1D22"/>
    <rect x="522" y="536" width="168" height="104" rx="16" fill="#1B1D22" fill-opacity="0.32"/>
    <rect x="334" y="664" width="356" height="124" rx="16" fill="#1B1D22" fill-opacity="0.32"/>
    <path d="M318 742 L706 708" stroke="#FFD43B" stroke-width="70" stroke-linecap="round"/>
  </g>
</svg>
```

Render it at 64, 128 and 512 px (`rsvg-convert -w 512 app/icon-source.svg -o /tmp/icon.png`) and look at each with the Read tool. At 64 px the tiles must still read as separate blocks; if they merge, widen the gaps before continuing. `app/public/favicon.svg` is a copy of the master.

- [ ] **Step 3: Write the icon render script**

`scripts/render-icons.mjs`:
```js
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
    .replace('<g transform="rotate(-6 512 512)">', '<g transform="translate(512 512) scale(0.8) translate(-512 -512) rotate(-6 512 512)">');
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
```

Run: `node scripts/render-icons.mjs`
Expected: the PNGs listed exist (the `src-tauri` directory is created now and filled in Task 24).

- [ ] **Step 4: Update the HTML shell and entry**

In `app/index.html`, add inside `<head>` before the module script:
```html
    <meta name="theme-color" content="#f6f4ee" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#121316" media="(prefers-color-scheme: dark)" />
    <meta name="description" content="Turn screenshots, lecture slides, notes and formulas into a dense, printable cheatsheet." />
    <link rel="icon" href="./favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" />
    <script>
      try {
        var t = localStorage.getItem('cm-theme');
        if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
      } catch (e) {}
    </script>
```

In `app/src/main.tsx`, import fonts and CSS before `App`:
```ts
import '@fontsource-variable/atkinson-hyperlegible-next';
import '@fontsource-variable/atkinson-hyperlegible-next/wght-italic.css';
import '@fontsource-variable/archivo-narrow';
import '@fontsource-variable/archivo-narrow/wght-italic.css';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/source-serif-4/wght-italic.css';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/jetbrains-mono/wght-italic.css';
import '@fontsource-variable/bricolage-grotesque';
import './tokens.css';
import './base.css';
```
Check each `wght-italic.css` path exists in `node_modules/@fontsource-variable/<name>/`; drop the italic import for a family that ships none (the canvas then synthesises italics).

- [ ] **Step 5: Write failing theme and component tests**

`app/src/ui/theme.test.ts`:
```ts
// @vitest-environment jsdom
import { beforeEach, expect, test } from 'vitest';
import { applyTheme, readThemePref } from './theme';

beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
});

test('explicit themes set the attribute and persist', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(readThemePref()).toBe('dark');
});

test('system removes the attribute', () => {
    applyTheme('light');
    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(readThemePref()).toBe('system');
});
```

`app/src/ui/components/components.test.tsx`:
```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { MenuButton } from './Menu';
import { Slider } from './Slider';
import { Segmented } from './Segmented';
import { ColorSwatches } from './ColorSwatches';

test('a menu opens, runs an item and closes', async () => {
    const onSelect = vi.fn();
    render(<MenuButton label="Export" items={[{ label: 'PDF', onSelect, shortcut: 'Ctrl+E' }, 'separator', { label: 'PNG', onSelect: () => {}, disabled: true }]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByRole('menuitem', { name: /PNG/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('menuitem', { name: /PDF/ }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
});

test('Escape closes a menu', async () => {
    render(<MenuButton label="More" items={[{ label: 'A', onSelect: () => {} }]} />);
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
});

test('a slider reports numbers', () => {
    const onChange = vi.fn();
    render(<Slider label="Contrast" min={0.5} max={2} step={0.1} value={1} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Contrast'), { target: { value: '1.5' } });
    expect(onChange).toHaveBeenCalledWith(1.5);
});

test('segmented control and swatches select values', async () => {
    const onAlign = vi.fn();
    render(<Segmented label="Align" value="left" onChange={onAlign} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }]} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Centre' }));
    expect(onAlign).toHaveBeenCalledWith('center');
    const onColor = vi.fn();
    render(<ColorSwatches label="Colour" colors={['#000000', '#c92a2a']} value="#000000" onChange={onColor} allowNone />);
    await userEvent.click(screen.getByRole('radio', { name: '#c92a2a' }));
    expect(onColor).toHaveBeenCalledWith('#c92a2a');
    await userEvent.click(screen.getByRole('radio', { name: 'None' }));
    expect(onColor).toHaveBeenCalledWith(null);
});
```

- [ ] **Step 6: Run to see failures**

Run: `npx vitest run app/src/ui`
Expected: FAIL, modules not found.

- [ ] **Step 7: Implement theme and primitives**

`app/src/ui/theme.ts`:
```ts
export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'cm-theme';

export function readThemePref(): ThemePref {
    try {
        const v = localStorage.getItem(KEY);
        return v === 'light' || v === 'dark' ? v : 'system';
    } catch {
        return 'system';
    }
}

export function applyTheme(pref: ThemePref): void {
    const root = document.documentElement;
    if (pref === 'system') delete root.dataset.theme;
    else root.dataset.theme = pref;
    try {
        if (pref === 'system') localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, pref);
    } catch {
        // Storage can be blocked; the choice then lasts for this visit only.
    }
}

export function resolvedTheme(): 'light' | 'dark' {
    const t = document.documentElement.dataset.theme;
    if (t === 'light' || t === 'dark') return t;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
```

Primitives, each in its own file under `app/src/ui/components/`, styled in `components.css` with the tokens:

- `Menu.tsx`: `MenuButton` renders `<button aria-haspopup="menu" aria-expanded>`; when open, a `<div role="menu">` positioned under the button (flip upwards if it would leave the viewport) with `<button role="menuitem">` children showing label and a right-aligned shortcut in `--ink-3`; `'separator'` renders `<div role="separator">`. Closes on item click, Escape (focus returns to the trigger), outside pointerdown and window blur. Arrow Up and Down move focus between enabled items; the first enabled item is focused on open.
- `Dialog.tsx`: wraps `<dialog>` with `showModal()` when `open` turns true and `close()` when false; `onClose` fires on Escape (`cancel` event) and on backdrop click; header with the title (`--font-display`) and a close `IconButton`; optional footer row aligned right.
- `Slider.tsx`: `<label>` plus `<input type="range">` with `id` from `useId()`, and an `<output>` showing `format?.(value) ?? value`; `onChange(Number(e.target.value))`.
- `Segmented.tsx`: `role="radiogroup"` with `aria-label`; each option a `<button role="radio" aria-checked>`; arrow keys move selection.
- `ColorSwatches.tsx`: `role="radiogroup"`; each colour a round `<button role="radio" aria-label={hex}>` filled with the colour over a checkerboard (so translucent highlighter colours read correctly); `allowNone` adds a `None` swatch with a diagonal slash; a final "Custom" swatch wraps `<input type="color">` and keeps the alpha suffix of the current value.
- `Toggle.tsx`: `<button role="switch" aria-checked>` with the label.
- `NumberField.tsx`: label, `<input type="number" inputMode="decimal">`, unit suffix; commits on blur and Enter, reverts on Escape, ignores non-finite input.
- `Button.tsx` and `IconButton.tsx`: `IconButton` sets `aria-label={label}`, `title={shortcut ? `${label} (${shortcut})` : label}` and `aria-pressed` when `pressed` is defined. Minimum hit size 36 px, 44 px on `(pointer: coarse)`.
- `Toasts.tsx`: fixed bottom-centre stack (above the phone tool bar), each toast with message, optional action button and dismiss; `role="status"` for info and `role="alert"` for errors; info toasts auto-dismiss after 5 s, errors stay.

`app/src/ui/icons.tsx`: one `Icon` component that renders `<svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` with the path data from a `PATHS: Record<IconName, string>` map. Draw one path (or a few joined with `M`) for each of: `select, hand, pen, highlighter, eraser, text, rect, ellipse, line, arrow, crop, image, slides, camera, paste, pagePlus, undo, redo, trash, duplicate, forward, backward, toFront, toBack, alignLeft, alignHCenter, alignRight, alignTop, alignVCenter, alignBottom, distributeH, distributeV, pack, fit, zoomIn, zoomOut, sun, moon, library, download, check, warning, lock, unlock, rotate, close, more, keyboard, chevronDown, plus, trim, invert, minus`. No emoji and no icon font.

- [ ] **Step 8: Run tests**

Run: `npx vitest run app/src/ui`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app scripts
git commit -m "feat(ui): design tokens, app icon, theme switching and UI primitives"
```

---

### Task 16: Editor store, editor assets and keyboard shortcuts

**Files:**
- Create: `app/src/ui/store.ts`, `app/src/render/assetCache.ts`, `app/src/ui/editorAssets.ts`, `app/src/ui/shortcuts.ts`
- Test: `app/src/ui/store.test.ts`, `app/src/ui/shortcuts.test.ts`

**Interfaces:**
- Consumes: history (Task 4), commands, `SaveStatus`, `layoutText`, `parseMarkdown`, `MathCache`, `applyFilters`, `filtersKey`, `isIdentity`, `createCanvas`, `cssFont`.
- Produces:
  - `Tool`, `ToolOptions`, `View {zoom, scrollX, scrollY}`, `Toast`, `DialogName = 'pdf-import' | 'shortcuts' | 'print-check' | null`, `EditorState`, `class EditorStore`, `StoreContext`, `useStore()`, `useEditor(selector)`, `DEFAULT_OPTIONS`.
  - `class AssetCache {constructor(load, onReady); prime(id, bitmap); source(item); rgba(id); ensure(ids): Promise<void>}`.
  - `class EditorAssets implements RenderAssets {images, maths, measure, image, math, textLayout, textHeight(item), invalidateText()}`.
  - `Command = {kind:'tool', tool} | {kind:'nudge', dx, dy} | {kind:'action', name: ActionName}`; `ActionName = 'undo' | 'redo' | 'duplicate' | 'delete' | 'selectAll' | 'forward' | 'backward' | 'toFront' | 'toBack' | 'exportPdf' | 'exportPng' | 'importImage' | 'importPdf' | 'saveFile' | 'zoomIn' | 'zoomOut' | 'zoomReset' | 'zoomFit' | 'addPage' | 'shortcuts' | 'escape' | 'crop'`; `matchShortcut(e, isMac): Command | null`; `SHORTCUT_LIST` for the shortcut sheet; `isEditableTarget(target)`.

`EditorState` fields: `history`, `selection: Id[]`, `tool`, `cropId: Id | null`, `editingTextId: Id | null`, `options: ToolOptions`, `view: View`, `currentPage: number`, `showGuides: boolean`, `packGap: number`, `exportDpi: number`, `pdfImportDpi: number`, `saveStatus: SaveStatus`, `toasts: Toast[]`, `renderTick: number`, `snapGuides: {page: number; x: number | null; y: number | null} | null`, `dialog: DialogName`.

- [ ] **Step 1: Write failing tests**

`app/src/ui/store.test.ts`:
```ts
import { expect, test } from 'vitest';
import { EditorStore } from './store';
import { addItems, removeItems } from '../model/commands';
import { createDocument, createShapeItem } from '../model/factory';

const rect = () => createShapeItem('rect', { x: 0, y: 0, w: 10, h: 10 }, { stroke: '#000', strokeWidth: 1, fill: null });

test('apply records history, stamps updatedAt and notifies', () => {
    const store = new EditorStore(createDocument('t', 0));
    let calls = 0;
    store.subscribe(() => calls++);
    const r = rect();
    store.apply((d) => addItems(d, 0, [r]));
    expect(store.doc.pages[0].items).toHaveLength(1);
    expect(store.doc.updatedAt).toBeGreaterThan(0);
    expect(calls).toBeGreaterThan(0);
    store.undo();
    expect(store.doc.pages[0].items).toHaveLength(0);
});

test('selection drops ids that no longer exist after undo or edits', () => {
    const store = new EditorStore(createDocument('t', 0));
    const r = rect();
    store.apply((d) => addItems(d, 0, [r]));
    store.select([r.id]);
    store.apply((d) => removeItems(d, [r.id]));
    expect(store.getState().selection).toEqual([]);
});

test('a gesture is one undo step and cancel restores', () => {
    const store = new EditorStore(createDocument('t', 0));
    const r = rect();
    store.beginGesture();
    store.apply((d) => addItems(d, 0, [r]));
    store.apply((d) => d);
    store.endGesture();
    store.undo();
    expect(store.doc.pages[0].items).toHaveLength(0);
    store.beginGesture();
    store.apply((d) => addItems(d, 0, [rect()]));
    store.cancelGesture();
    expect(store.doc.pages[0].items).toHaveLength(0);
});

test('amendDoc does not add history', () => {
    const store = new EditorStore(createDocument('t', 0));
    store.amendDoc((d) => ({ ...d, title: 'derived' }));
    store.undo();
    expect(store.doc.title).toBe('derived');
});

test('replaceDocument resets history and selection', () => {
    const store = new EditorStore(createDocument('a', 0));
    store.apply((d) => addItems(d, 0, [rect()]));
    store.replaceDocument(createDocument('b', 0));
    expect(store.doc.title).toBe('b');
    store.undo();
    expect(store.doc.title).toBe('b');
});

test('toasts get ids and can be dismissed', () => {
    const store = new EditorStore(createDocument('a', 0));
    const id = store.toast('Hello');
    expect(store.getState().toasts).toHaveLength(1);
    store.dismissToast(id);
    expect(store.getState().toasts).toHaveLength(0);
});
```

`app/src/ui/shortcuts.test.ts`:
```ts
import { expect, test } from 'vitest';
import { matchShortcut } from './shortcuts';

const key = (key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) =>
    ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods });

test('tools are single letters', () => {
    expect(matchShortcut(key('p'), false)).toEqual({ kind: 'tool', tool: 'pen' });
    expect(matchShortcut(key('d'), false)).toEqual({ kind: 'tool', tool: 'pen' });
    expect(matchShortcut(key('M'), false)).toEqual({ kind: 'tool', tool: 'highlighter' });
    expect(matchShortcut(key('v'), false)).toEqual({ kind: 'tool', tool: 'select' });
});

test('Ctrl on Linux and Windows, Cmd on macOS', () => {
    expect(matchShortcut(key('z', { ctrlKey: true }), false)).toEqual({ kind: 'action', name: 'undo' });
    expect(matchShortcut(key('z', { metaKey: true }), true)).toEqual({ kind: 'action', name: 'undo' });
    expect(matchShortcut(key('z', { ctrlKey: true }), true)).toBeNull();
    expect(matchShortcut(key('Z', { ctrlKey: true, shiftKey: true }), false)).toEqual({ kind: 'action', name: 'redo' });
    expect(matchShortcut(key('y', { ctrlKey: true }), false)).toEqual({ kind: 'action', name: 'redo' });
    expect(matchShortcut(key('E', { ctrlKey: true, shiftKey: true }), false)).toEqual({ kind: 'action', name: 'exportPng' });
    expect(matchShortcut(key(']', { ctrlKey: true, shiftKey: true }), false)).toEqual({ kind: 'action', name: 'toFront' });
});

test('arrows nudge 1 pt, 10 pt with Shift', () => {
    expect(matchShortcut(key('ArrowLeft'), false)).toEqual({ kind: 'nudge', dx: -1, dy: 0 });
    expect(matchShortcut(key('ArrowDown', { shiftKey: true }), false)).toEqual({ kind: 'nudge', dx: 0, dy: 10 });
});

test('clipboard keys are left to the browser', () => {
    expect(matchShortcut(key('c', { ctrlKey: true }), false)).toBeNull();
    expect(matchShortcut(key('v', { ctrlKey: true }), false)).toBeNull();
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run app/src/ui/store.test.ts app/src/ui/shortcuts.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the store**

`app/src/ui/store.ts`:
```ts
import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import { findItem } from '../model/commands';
import type { TextStyle } from '../model/factory';
import {
    amend, beginGesture, cancelGesture, commit, createHistory, endGesture, redo, undo, type History,
} from '../model/history';
import type { CheatDocument, Id } from '../model/types';
import type { SaveStatus } from '../storage/autosave';

export type Tool = 'select' | 'hand' | 'pen' | 'highlighter' | 'eraser' | 'text' | 'rect' | 'ellipse' | 'line' | 'arrow';

export interface ToolOptions {
    penColor: string;
    penSize: number;
    highlighterColor: string;
    highlighterSize: number;
    shapeStroke: string;
    shapeWidth: number;
    shapeFill: string | null;
    text: TextStyle;
}

export const DEFAULT_OPTIONS: ToolOptions = {
    penColor: '#1b1d22',
    penSize: 2,
    highlighterColor: '#ffd43b80',
    highlighterSize: 12,
    shapeStroke: '#1b1d22',
    shapeWidth: 1.5,
    shapeFill: null,
    text: { font: 'sans', fontSize: 9, color: '#1b1d22', background: null, align: 'left' },
};

export interface View {
    /** Screen pixels per point. */
    zoom: number;
    /** World coordinates (points) at the top-left of the viewport. */
    scrollX: number;
    scrollY: number;
}

export interface Toast {
    id: number;
    message: string;
    kind: 'info' | 'error';
    action?: { label: string; run: () => void };
}

export type DialogName = 'pdf-import' | 'shortcuts' | 'print-check' | null;

export interface EditorState {
    history: History;
    selection: Id[];
    tool: Tool;
    cropId: Id | null;
    editingTextId: Id | null;
    options: ToolOptions;
    view: View;
    currentPage: number;
    showGuides: boolean;
    packGap: number;
    exportDpi: number;
    pdfImportDpi: number;
    saveStatus: SaveStatus;
    toasts: Toast[];
    renderTick: number;
    snapGuides: { page: number; x: number | null; y: number | null } | null;
    dialog: DialogName;
}

type Listener = () => void;
let toastSeq = 0;

export class EditorStore {
    private state: EditorState;
    private listeners = new Set<Listener>();

    constructor(doc: CheatDocument, init: Partial<EditorState> = {}) {
        this.state = {
            history: createHistory(doc),
            selection: [],
            tool: 'select',
            cropId: null,
            editingTextId: null,
            options: DEFAULT_OPTIONS,
            view: { zoom: 1, scrollX: 0, scrollY: 0 },
            currentPage: 0,
            showGuides: true,
            packGap: 4,
            exportDpi: 300,
            pdfImportDpi: 200,
            saveStatus: { state: 'saved', at: doc.updatedAt },
            toasts: [],
            renderTick: 0,
            snapGuides: null,
            dialog: null,
            ...init,
        };
    }

    getState = (): EditorState => this.state;

    subscribe = (fn: Listener): (() => void) => {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    };

    get doc(): CheatDocument {
        return this.state.history.present;
    }

    private set(patch: Partial<EditorState>) {
        this.state = { ...this.state, ...patch };
        for (const l of this.listeners) l();
    }

    /** Keep selection, crop and editing ids pointing at items that exist. */
    private withHistory(history: History) {
        const doc = history.present;
        const exists = (id: Id | null) => (id && findItem(doc, id) ? id : null);
        const selection = this.state.selection.filter((id) => findItem(doc, id));
        const currentPage = Math.min(this.state.currentPage, doc.pages.length - 1);
        this.set({ history, selection, cropId: exists(this.state.cropId), editingTextId: exists(this.state.editingTextId), currentPage });
    }

    apply(fn: (doc: CheatDocument) => CheatDocument): void {
        const prev = this.doc;
        const next = fn(prev);
        if (next === prev) return;
        this.withHistory(commit(this.state.history, { ...next, updatedAt: Date.now() }));
    }

    amendDoc(fn: (doc: CheatDocument) => CheatDocument): void {
        const next = fn(this.doc);
        if (next !== this.doc) this.withHistory(amend(this.state.history, next));
    }

    beginGesture() { this.set({ history: beginGesture(this.state.history) }); }
    endGesture() { this.withHistory(endGesture(this.state.history)); this.set({ snapGuides: null }); }
    cancelGesture() { this.withHistory(cancelGesture(this.state.history)); this.set({ snapGuides: null }); }
    get gestureActive(): boolean { return this.state.history.gestureBase !== null; }

    undo() { this.withHistory(undo(this.state.history)); }
    redo() { this.withHistory(redo(this.state.history)); }

    replaceDocument(doc: CheatDocument) {
        this.set({ history: createHistory(doc), selection: [], cropId: null, editingTextId: null, currentPage: 0, snapGuides: null });
    }

    select(ids: Id[]) { this.set({ selection: ids, cropId: ids.length === 1 && ids[0] === this.state.cropId ? this.state.cropId : null }); }
    setTool(tool: Tool) { this.set({ tool, cropId: null, editingTextId: tool === 'select' ? this.state.editingTextId : null, selection: tool === 'select' ? this.state.selection : [] }); }
    setOptions(patch: Partial<ToolOptions>) { this.set({ options: { ...this.state.options, ...patch } }); }
    setView(view: View) { this.set({ view }); }
    setCurrentPage(i: number) { if (i !== this.state.currentPage) this.set({ currentPage: i }); }
    setCrop(id: Id | null) { this.set({ cropId: id, selection: id ? [id] : this.state.selection }); }
    setEditingText(id: Id | null) { this.set({ editingTextId: id, selection: id ? [id] : this.state.selection }); }
    setSaveStatus(saveStatus: SaveStatus) { this.set({ saveStatus }); }
    setSnapGuides(g: EditorState['snapGuides']) { this.set({ snapGuides: g }); }
    openDialog(dialog: DialogName) { this.set({ dialog }); }
    patch(p: Partial<Pick<EditorState, 'showGuides' | 'packGap' | 'exportDpi' | 'pdfImportDpi'>>) { this.set(p); }
    bumpRender() { this.set({ renderTick: this.state.renderTick + 1 }); }

    toast(message: string, kind: Toast['kind'] = 'info', action?: Toast['action']): number {
        const id = ++toastSeq;
        this.set({ toasts: [...this.state.toasts, { id, message, kind, action }] });
        return id;
    }
    dismissToast(id: number) { this.set({ toasts: this.state.toasts.filter((t) => t.id !== id) }); }
}

export const StoreContext = createContext<EditorStore | null>(null);

export function useStore(): EditorStore {
    const s = useContext(StoreContext);
    if (!s) throw new Error('useStore outside StoreContext');
    return s;
}

export function useEditor<T>(selector: (s: EditorState) => T): T {
    const store = useStore();
    const get = useCallback(() => selector(store.getState()), [store, selector]);
    return useSyncExternalStore(store.subscribe, get, get);
}
```

Selectors passed to `useEditor` must return stable values (a field of the state, or a primitive); a selector that builds a new array or object every call causes an infinite render loop. Components that need derived arrays use `useMemo` over stable fields.

- [ ] **Step 4: Implement the asset cache and editor assets**

`app/src/render/assetCache.ts`:
```ts
import type { Id, ImageItem } from '../model/types';
import { applyFilters, filtersKey, isIdentity, type RGBAImage } from './filters';
import { createCanvas, type AnyCanvas } from './rasterize';

type Entry = { state: 'loading' } | { state: 'error' } | { state: 'ready'; bmp: ImageBitmap };

export class AssetCache {
    private entries = new Map<Id, Entry>();
    private waiters = new Map<Id, Promise<void>>();
    private filtered = new Map<string, AnyCanvas>();
    private pixels = new Map<Id, RGBAImage>();

    constructor(private load: (id: Id) => Promise<Blob | null>, private onReady: () => void) {}

    prime(id: Id, bmp: ImageBitmap) {
        this.entries.set(id, { state: 'ready', bmp });
    }

    private start(id: Id): Promise<void> {
        const existing = this.waiters.get(id);
        if (existing) return existing;
        this.entries.set(id, { state: 'loading' });
        const p = this.load(id)
            .then((blob) => (blob ? createImageBitmap(blob) : Promise.reject(new Error('missing'))))
            .then((bmp) => {
                this.entries.set(id, { state: 'ready', bmp });
                this.onReady();
            }, () => {
                this.entries.set(id, { state: 'error' });
            });
        this.waiters.set(id, p);
        return p;
    }

    bitmap(id: Id): ImageBitmap | null {
        const e = this.entries.get(id);
        if (e?.state === 'ready') return e.bmp;
        if (!e) void this.start(id);
        return null;
    }

    async ensure(ids: Iterable<Id>): Promise<void> {
        await Promise.all([...ids].map((id) => (this.entries.get(id)?.state === 'ready' ? undefined : this.start(id))));
    }

    rgba(id: Id): RGBAImage | null {
        const hit = this.pixels.get(id);
        if (hit) return hit;
        const bmp = this.bitmap(id);
        if (!bmp) return null;
        const c = createCanvas(bmp.width, bmp.height);
        const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
        ctx.drawImage(bmp, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height);
        const img = { data: d.data, width: d.width, height: d.height };
        this.pixels.set(id, img);
        if (this.pixels.size > 4) this.pixels.delete(this.pixels.keys().next().value!);
        return img;
    }

    source(item: ImageItem): CanvasImageSource | null {
        const bmp = this.bitmap(item.assetId);
        if (!bmp) return null;
        if (isIdentity(item.filters)) return bmp;
        const key = `${item.assetId}|${filtersKey(item.filters)}`;
        const hit = this.filtered.get(key);
        if (hit) {
            this.filtered.delete(key);
            this.filtered.set(key, hit);
            return hit;
        }
        const src = this.rgba(item.assetId);
        if (!src) return null;
        const out = applyFilters(src, item.filters);
        const c = createCanvas(out.width, out.height);
        (c.getContext('2d') as CanvasRenderingContext2D).putImageData(new ImageData(out.data, out.width, out.height), 0, 0);
        this.filtered.set(key, c);
        if (this.filtered.size > 24) this.filtered.delete(this.filtered.keys().next().value!);
        return c;
    }
}
```

`app/src/ui/editorAssets.ts`:
```ts
import type { Id, ImageItem, TextItem } from '../model/types';
import { AssetCache } from '../render/assetCache';
import type { RenderAssets } from '../render/drawPage';
import { cssFont } from '../render/fonts';
import { parseMarkdown } from '../render/markdown';
import { MathCache } from '../render/math';
import { createCanvas } from '../render/rasterize';
import { layoutText, type Measurer, type TextLayout } from '../render/textLayout';

export class EditorAssets implements RenderAssets {
    readonly images: AssetCache;
    readonly maths: MathCache;
    private layouts = new WeakMap<TextItem, { version: number; layout: TextLayout }>();
    private version = 0;
    private ctx: CanvasRenderingContext2D | null = null;

    constructor(load: (id: Id) => Promise<Blob | null>, onReady: () => void) {
        this.images = new AssetCache(load, onReady);
        this.maths = new MathCache(() => {
            this.version++;
            onReady();
        });
    }

    /** Call when fonts finish loading so cached layouts are measured again. */
    invalidateText() {
        this.version++;
    }

    measure: Measurer = (text, font) => {
        if (!this.ctx && typeof document !== 'undefined') {
            this.ctx = (createCanvas(1, 1).getContext('2d') as CanvasRenderingContext2D | null);
        }
        if (!this.ctx) return text.length * font.size * 0.5;
        this.ctx.font = cssFont(font);
        return this.ctx.measureText(text).width;
    };

    image = (item: ImageItem) => this.images.source(item);
    math = (tex: string, display: boolean, color: string) => this.maths.image(tex, display, color);

    textLayout = (item: TextItem): TextLayout => {
        const hit = this.layouts.get(item);
        if (hit && hit.version === this.version) return hit.layout;
        const layout = layoutText(parseMarkdown(item.text), {
            width: Math.max(1, item.w - item.padding * 2),
            fontSize: item.fontSize,
            font: item.font,
            align: item.align,
            measure: this.measure,
            math: this.maths.metrics,
        });
        this.layouts.set(item, { version: this.version, layout });
        return layout;
    };

    textHeight(item: TextItem): number {
        return Math.max(item.fontSize * 1.25, this.textLayout(item).height) + item.padding * 2;
    }
}
```

- [ ] **Step 5: Implement shortcuts**

`app/src/ui/shortcuts.ts`:
```ts
import type { Tool } from './store';

export type ActionName =
    | 'undo' | 'redo' | 'duplicate' | 'delete' | 'selectAll' | 'forward' | 'backward' | 'toFront' | 'toBack'
    | 'exportPdf' | 'exportPng' | 'importImage' | 'importPdf' | 'saveFile' | 'zoomIn' | 'zoomOut' | 'zoomReset'
    | 'zoomFit' | 'addPage' | 'shortcuts' | 'escape' | 'crop';

export type Command = { kind: 'tool'; tool: Tool } | { kind: 'nudge'; dx: number; dy: number } | { kind: 'action'; name: ActionName };

export interface KeyLike {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
}

const TOOLS: Record<string, Tool> = {
    v: 'select', h: 'hand', p: 'pen', d: 'pen', m: 'highlighter', e: 'eraser', t: 'text',
    r: 'rect', o: 'ellipse', l: 'line', a: 'arrow',
};

export function matchShortcut(e: KeyLike, isMac: boolean): Command | null {
    const mod = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const act = (name: ActionName): Command => ({ kind: 'action', name });
    if (mod) {
        if (e.altKey) return null;
        if (k === 'z') return act(e.shiftKey ? 'redo' : 'undo');
        if (k === 'y' && !e.shiftKey) return act('redo');
        if (k === 'd' && !e.shiftKey) return act('duplicate');
        if (k === 'a' && !e.shiftKey) return act('selectAll');
        if (k === ']' || k === '}') return act(e.shiftKey ? 'toFront' : 'forward');
        if (k === '[' || k === '{') return act(e.shiftKey ? 'toBack' : 'backward');
        if (k === 'e') return act(e.shiftKey ? 'exportPng' : 'exportPdf');
        if (k === 'o') return act(e.shiftKey ? 'importPdf' : 'importImage');
        if (k === 's' && !e.shiftKey) return act('saveFile');
        if (k === '=' || k === '+') return act('zoomIn');
        if (k === '-' || k === '_') return act('zoomOut');
        if (k === '0') return act('zoomReset');
        if (k === '1') return act('zoomFit');
        if (k === 'Enter') return act('addPage');
        return null; // Ctrl+C, X and V stay with the browser so copy and paste events fire.
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    if (k === 'Delete' || k === 'Backspace') return act('delete');
    if (k === 'Escape') return act('escape');
    if (k === '?') return act('shortcuts');
    if (k === 'c' && !e.shiftKey) return act('crop');
    const step = e.shiftKey ? 10 : 1;
    if (k === 'ArrowLeft') return { kind: 'nudge', dx: -step, dy: 0 };
    if (k === 'ArrowRight') return { kind: 'nudge', dx: step, dy: 0 };
    if (k === 'ArrowUp') return { kind: 'nudge', dx: 0, dy: -step };
    if (k === 'ArrowDown') return { kind: 'nudge', dx: 0, dy: step };
    if (!e.shiftKey && TOOLS[k]) return { kind: 'tool', tool: TOOLS[k] };
    if (e.shiftKey && k === 'm') return { kind: 'tool', tool: 'highlighter' };
    return null;
}

export function isEditableTarget(t: EventTarget | null): boolean {
    const el = t as HTMLElement | null;
    if (!el || !el.tagName) return false;
    return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export const SHORTCUT_LIST: Array<{ group: string; items: Array<[string, string]> }> = [
    { group: 'Tools', items: [['V', 'Select'], ['H or hold Space', 'Hand'], ['P or D', 'Pen'], ['M', 'Highlighter'], ['E', 'Eraser'], ['T', 'Text'], ['R, O, L, A', 'Rectangle, ellipse, line, arrow'], ['C', 'Crop the selected image']] },
    { group: 'Edit', items: [['Mod+Z', 'Undo'], ['Mod+Shift+Z or Mod+Y', 'Redo'], ['Mod+C, X, V', 'Copy, cut, paste'], ['Mod+D', 'Duplicate'], ['Delete', 'Delete'], ['Arrows', 'Nudge 1 pt (Shift: 10 pt)'], ['Mod+A', 'Select all on the page'], ['Mod+] and Mod+[', 'Forward and backward (Shift: to front, to back)']] },
    { group: 'File', items: [['Mod+O', 'Import images'], ['Mod+Shift+O', 'Import from a PDF'], ['Mod+S', 'Save a .cheatsheet file'], ['Mod+E', 'Export PDF'], ['Mod+Shift+E', 'Export PNG']] },
    { group: 'View', items: [['Mod+plus, minus, 0', 'Zoom in, out, 100%'], ['Mod+1', 'Fit width'], ['Mod+Enter', 'Add a page'], ['?', 'This sheet']] },
];
```

The shortcut sheet shows `Mod` as `Ctrl` or `Cmd` depending on the platform.

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run app/src/ui && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src
git commit -m "feat(ui): editor store, editor assets and keyboard shortcuts"
```

---
### Task 17: Canvas view, viewport, selection, move, resize, rotate, crop and zoom

**Files:**
- Create: `app/src/ui/canvas/viewport.ts`, `app/src/model/hits.ts`, `app/src/model/crop.ts`, `app/src/ui/canvas/gestures.ts`, `app/src/ui/canvas/overlay.ts`, `app/src/ui/canvas/CanvasView.tsx`, `app/src/ui/canvas/canvas.css`
- Test: `app/src/ui/canvas/viewport.test.ts`, `app/src/model/hits.test.ts`, `app/src/model/crop.test.ts`, `app/src/ui/canvas/gestures.test.ts`

**Interfaces:**
- Consumes: store (Task 16), geometry, commands, snapping, `drawPage`, `drawItem`, `EditorAssets`.
- Produces:
  - viewport: `PAGE_GAP = 24`, `ZOOM_MIN = 0.1`, `ZOOM_MAX = 8`, `ACTUAL_SIZE = 96 / 72`, `pageTops(setup, count)`, `worldHeight(setup, count)`, `toScreen(view, p)`, `toWorld(view, p)`, `pageAt(setup, count, world): {index, inside}`, `toPagePoint(setup, index, world)`, `fromPagePoint(setup, index, p)`, `visiblePages(setup, count, view, vw, vh)`, `zoomAround(view, factor, screen)`, `fitWidth(setup, vw, page): View`, `clampView(view, setup, count, vw, vh)`.
  - hits: `topItemAt(items, p, tol)`, `itemsInRect(items, rect)`, `strokesTouched(items, a, b, radius): Id[]`.
  - crop: `MIN_CROP_PX = 4`, `cropDrag(start: ImageItem, handle: ResizeHandle | 'pan', localDelta: Point, image: {width, height}): ImageItem`, `fullImageRect(item, image: {width, height}): Rect` (local coordinates of the uncropped image).
  - gestures: `PointerInfo`, `class GestureController {down, move, up, cancel, doubleClick(screen), hoverAt(screen), cursor: string, spaceHeld, live, marquee, eraser}`.
  - overlay: `drawOverlay(ctx, env)`.
  - `CanvasView` component with props `{assets: EditorAssets}`.

- [ ] **Step 1: Write failing tests for the pure parts**

`app/src/ui/canvas/viewport.test.ts`:
```ts
import { expect, test } from 'vitest';
import { clampView, fitWidth, pageAt, pageTops, toPagePoint, toScreen, toWorld, visiblePages, zoomAround } from './viewport';
import { DEFAULT_SETUP } from '../../model/factory';

const setup = { ...DEFAULT_SETUP, size: 'Letter' as const }; // 612 x 792

test('screen and world are inverse', () => {
    const v = { zoom: 2, scrollX: 10, scrollY: -5 };
    const p = toWorld(v, toScreen(v, { x: 33, y: 44 }));
    expect(p.x).toBeCloseTo(33);
    expect(p.y).toBeCloseTo(44);
});

test('pages stack with a gap and a point in the gap picks the nearer page', () => {
    expect(pageTops(setup, 3)).toEqual([0, 816, 1632]);
    expect(pageAt(setup, 3, { x: 10, y: 795 })).toEqual({ index: 0, inside: false });
    expect(pageAt(setup, 3, { x: 10, y: 812 })).toEqual({ index: 1, inside: false });
    expect(pageAt(setup, 3, { x: 10, y: 900 })).toEqual({ index: 1, inside: true });
    expect(pageAt(setup, 3, { x: 10, y: 99999 }).index).toBe(2);
    expect(toPagePoint(setup, 1, { x: 5, y: 900 })).toEqual({ x: 5, y: 84 });
});

test('only pages in the viewport are visible', () => {
    expect(visiblePages(setup, 5, { zoom: 1, scrollX: 0, scrollY: 800 }, 600, 100)).toEqual([0, 1]);
    expect(visiblePages(setup, 5, { zoom: 1, scrollX: 0, scrollY: 900 }, 600, 100)).toEqual([1]);
});

test('zooming keeps the point under the cursor still', () => {
    const v = { zoom: 1, scrollX: 0, scrollY: 0 };
    const screen = { x: 200, y: 150 };
    const before = toWorld(v, screen);
    const after = toWorld(zoomAround(v, 2, screen), screen);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(zoomAround(v, 1000, screen).zoom).toBe(8);
});

test('fit width centres the page', () => {
    const v = fitWidth(setup, 1000, 1);
    const left = toScreen(v, { x: 0, y: 0 }).x;
    const right = toScreen(v, { x: 612, y: 0 }).x;
    expect(left).toBeCloseTo(1000 - right);
    expect(toScreen(v, { x: 0, y: 816 }).y).toBeGreaterThan(0);
});

test('clampView centres content narrower than the viewport', () => {
    const v = clampView({ zoom: 0.5, scrollX: 500, scrollY: 0 }, setup, 1, 1000, 800);
    expect(toScreen(v, { x: 306, y: 0 }).x).toBeCloseTo(500);
});
```

`app/src/model/hits.test.ts`:
```ts
import { expect, test } from 'vitest';
import { itemsInRect, strokesTouched, topItemAt } from './hits';
import { createShapeItem, createStrokeItem } from './factory';

const sq = (x: number) => createShapeItem('rect', { x, y: 0, w: 10, h: 10 }, { stroke: '#000', strokeWidth: 1, fill: null });

test('the top item wins', () => {
    const [a, b] = [sq(0), sq(5)];
    expect(topItemAt([a, b], { x: 7, y: 5 }, 0)?.id).toBe(b.id);
    expect(topItemAt([a, b], { x: 50, y: 5 }, 0)).toBeNull();
});

test('marquee selects intersecting items', () => {
    const [a, b] = [sq(0), sq(100)];
    expect(itemsInRect([a, b], { x: 8, y: 8, w: 5, h: 5 }).map((i) => i.id)).toEqual([a.id]);
});

test('the eraser finds strokes along its path only', () => {
    const s = createStrokeItem([0, 50, 0.5, 100, 50, 0.5], 'pen', '#000', 2);
    const r = sq(0);
    expect(strokesTouched([s, r], { x: 50, y: 0 }, { x: 50, y: 100 }, 3)).toEqual([s.id]);
    expect(strokesTouched([s], { x: 0, y: 0 }, { x: 100, y: 0 }, 3)).toEqual([]);
});
```

`app/src/model/crop.test.ts`:
```ts
import { expect, test } from 'vitest';
import { cropDrag, fullImageRect } from './crop';
import { createImageItem } from './factory';
import { apply, itemMatrix } from './geometry';

const img = { width: 400, height: 200 };
// 2 pt per source pixel, cropped to the middle 100 x 100 pixels
const start = { ...createImageItem({ id: 'a', ...img, mime: 'image/png' }, { x: 0, y: 0 }, 1e6, 1e6), x: 0, y: 0, w: 200, h: 200, crop: { x: 100, y: 50, w: 100, h: 100 } };

test('dragging the east handle reveals more image at the same scale', () => {
    const out = cropDrag(start, 'e', { x: 20, y: 0 }, img);
    expect(out.crop).toEqual({ x: 100, y: 50, w: 110, h: 100 });
    expect(out.w).toBeCloseTo(220);
    expect(out.x).toBeCloseTo(0);
});

test('crop edges stop at the image border', () => {
    expect(cropDrag(start, 'w', { x: -1000, y: 0 }, img).crop.x).toBe(0);
    expect(cropDrag(start, 'e', { x: 1000, y: 0 }, img).crop.w).toBe(300);
    expect(cropDrag(start, 'n', { x: 0, y: 1000 }, img).crop.h).toBe(4);
});

test('panning moves the image under a fixed frame', () => {
    const out = cropDrag(start, 'pan', { x: -20, y: 0 }, img);
    expect(out.crop).toEqual({ x: 110, y: 50, w: 100, h: 100 });
    expect([out.x, out.y, out.w, out.h]).toEqual([0, 0, 200, 200]);
    expect(cropDrag(start, 'pan', { x: 10000, y: 0 }, img).crop.x).toBe(0);
});

test('the opposite edge stays put on a rotated image', () => {
    const rotated = { ...start, rotation: 90 };
    const out = cropDrag(rotated, 'e', { x: 20, y: 0 }, img);
    const before = apply(itemMatrix(rotated), { x: 0, y: 100 });
    const after = apply(itemMatrix(out), { x: 0, y: 100 });
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
});

test('fullImageRect places the whole source around the crop', () => {
    expect(fullImageRect(start, img)).toEqual({ x: -200, y: -100, w: 800, h: 400 });
});
```

`app/src/ui/canvas/gestures.test.ts`:
```ts
import { beforeEach, expect, test } from 'vitest';
import { GestureController, type PointerInfo } from './gestures';
import { EditorStore } from '../store';
import { EditorAssets } from '../editorAssets';
import { addItems } from '../../model/commands';
import { createDocument, createShapeItem } from '../../model/factory';

let store: EditorStore;
let ctrl: GestureController;
const rect = createShapeItem('rect', { x: 100, y: 100, w: 50, h: 50 }, { stroke: '#000', strokeWidth: 1, fill: null });

const ptr = (x: number, y: number, o: Partial<PointerInfo> = {}): PointerInfo => ({
    id: 1, x, y, button: 0, pointerType: 'mouse', pressure: 0.5, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, ...o,
});

beforeEach(() => {
    store = new EditorStore(addItems(createDocument('t', 0), 0, [rect]), { view: { zoom: 1, scrollX: 0, scrollY: 0 } });
    const assets = new EditorAssets(async () => null, () => {});
    ctrl = new GestureController(store, assets, () => ({ w: 800, h: 600 }), () => {});
});

test('click selects, drag moves as one undo step with snapping', () => {
    ctrl.down(ptr(120, 120));
    expect(store.getState().selection).toEqual([rect.id]);
    ctrl.move(ptr(150, 140));
    ctrl.move(ptr(181, 160));
    ctrl.up(ptr(181, 160));
    const moved = store.doc.pages[0].items[0];
    expect(moved.y).toBe(140);
    store.undo();
    expect(store.doc.pages[0].items[0].x).toBe(100);
});

test('a click without movement records no history', () => {
    ctrl.down(ptr(120, 120));
    ctrl.up(ptr(120, 120));
    store.undo();
    expect(store.doc.pages[0].items).toHaveLength(1);
});

test('dragging empty space draws a marquee', () => {
    ctrl.down(ptr(90, 90));
    ctrl.move(ptr(160, 160));
    expect(store.getState().selection).toEqual([rect.id]);
    ctrl.up(ptr(160, 160));
    expect(ctrl.marquee).toBeNull();
});

test('cancel mid-drag restores the start', () => {
    ctrl.down(ptr(120, 120));
    ctrl.move(ptr(200, 200));
    ctrl.cancel();
    expect(store.doc.pages[0].items[0].x).toBe(100);
});

test('pen strokes become one item', () => {
    store.setTool('pen');
    ctrl.down(ptr(10, 10));
    ctrl.move(ptr(20, 15));
    ctrl.move(ptr(30, 25));
    ctrl.up(ptr(30, 25));
    expect(store.doc.pages[0].items.at(-1)?.kind).toBe('stroke');
});
```

In the first test nothing is within the 6 px snap threshold, so the item lands exactly where it was dragged; the test pins one undo step and plain movement.

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run app/src/ui/canvas app/src/model/hits.test.ts app/src/model/crop.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement viewport, hits and crop**

`app/src/ui/canvas/viewport.ts`:
```ts
import { pageDimensions } from '../../model/pageSizes';
import type { PageSetup, Point } from '../../model/types';
import type { View } from '../store';

export const PAGE_GAP = 24;
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8;
export const ACTUAL_SIZE = 96 / 72;

const stride = (setup: PageSetup) => pageDimensions(setup).h + PAGE_GAP;

export function pageTops(setup: PageSetup, count: number): number[] {
    return Array.from({ length: count }, (_, i) => i * stride(setup));
}

export function worldHeight(setup: PageSetup, count: number): number {
    return count * stride(setup) - PAGE_GAP;
}

export const toScreen = (v: View, p: Point): Point => ({ x: (p.x - v.scrollX) * v.zoom, y: (p.y - v.scrollY) * v.zoom });
export const toWorld = (v: View, p: Point): Point => ({ x: p.x / v.zoom + v.scrollX, y: p.y / v.zoom + v.scrollY });

export function pageAt(setup: PageSetup, count: number, world: Point): { index: number; inside: boolean } {
    const { w, h } = pageDimensions(setup);
    const s = stride(setup);
    let index = Math.floor(world.y / s);
    const within = world.y - index * s;
    if (within > h && within - h > PAGE_GAP / 2) index += 1;
    index = Math.max(0, Math.min(count - 1, index));
    const top = index * s;
    const inside = world.x >= 0 && world.x <= w && world.y >= top && world.y <= top + h;
    return { index, inside };
}

export const toPagePoint = (setup: PageSetup, index: number, world: Point): Point => ({ x: world.x, y: world.y - index * stride(setup) });
export const fromPagePoint = (setup: PageSetup, index: number, p: Point): Point => ({ x: p.x, y: p.y + index * stride(setup) });

export function visiblePages(setup: PageSetup, count: number, v: View, vw: number, vh: number): number[] {
    const { h } = pageDimensions(setup);
    const top = v.scrollY, bottom = v.scrollY + vh / v.zoom;
    const out: number[] = [];
    pageTops(setup, count).forEach((t, i) => {
        if (t + h >= top && t <= bottom) out.push(i);
    });
    return out;
}

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export function zoomAround(v: View, factor: number, screen: Point): View {
    const zoom = clampZoom(v.zoom * factor);
    const w = toWorld(v, screen);
    return { zoom, scrollX: w.x - screen.x / zoom, scrollY: w.y - screen.y / zoom };
}

export function fitWidth(setup: PageSetup, vw: number, page: number): View {
    const { w } = pageDimensions(setup);
    const margin = Math.min(32, vw * 0.04);
    const zoom = clampZoom((vw - margin * 2) / w);
    return { zoom, scrollX: (w - vw / zoom) / 2, scrollY: page * stride(setup) - 16 / zoom };
}

/** Keep some of the document on screen; centre it on an axis where it is smaller than the viewport. */
export function clampView(v: View, setup: PageSetup, count: number, vw: number, vh: number): View {
    const { w } = pageDimensions(setup);
    const H = worldHeight(setup, count);
    const VW = vw / v.zoom, VH = vh / v.zoom, pad = 48 / v.zoom;
    const axis = (scroll: number, content: number, viewSize: number) =>
        viewSize >= content ? (content - viewSize) / 2 : Math.min(content - viewSize + pad, Math.max(-pad, scroll));
    return { zoom: v.zoom, scrollX: axis(v.scrollX, w, VW), scrollY: axis(v.scrollY, H, VH) };
}
```

`app/src/model/hits.ts`:
```ts
import { boxBounds, hitItem, rectsIntersect } from './geometry';
import type { Id, Item, Point, Rect } from './types';

export function topItemAt(items: Item[], p: Point, tol: number): Item | null {
    for (let i = items.length - 1; i >= 0; i--) if (hitItem(items[i], p, tol)) return items[i];
    return null;
}

export function itemsInRect(items: Item[], r: Rect): Item[] {
    return items.filter((i) => rectsIntersect(boxBounds(i), r));
}

export function strokesTouched(items: Item[], a: Point, b: Point, radius: number): Id[] {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(len / Math.max(0.5, radius / 2)));
    const out: Id[] = [];
    for (const item of items) {
        if (item.kind !== 'stroke' || item.locked) continue;
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            if (hitItem(item, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, radius)) {
                out.push(item.id);
                break;
            }
        }
    }
    return out;
}
```

`app/src/model/crop.ts`:
```ts
import { apply, itemMatrix, type ResizeHandle } from './geometry';
import type { ImageItem, Point, Rect } from './types';

export const MIN_CROP_PX = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The whole source image in the item's local coordinates. */
export function fullImageRect(item: ImageItem, image: { width: number; height: number }): Rect {
    const sx = item.w / item.crop.w, sy = item.h / item.crop.h;
    return { x: -item.crop.x * sx, y: -item.crop.y * sy, w: image.width * sx, h: image.height * sy };
}

export function cropDrag(start: ImageItem, handle: ResizeHandle | 'pan', d: Point, image: { width: number; height: number }): ImageItem {
    const sx = start.w / start.crop.w, sy = start.h / start.crop.h;
    const c = start.crop;
    if (handle === 'pan') {
        return {
            ...start,
            crop: { ...c, x: clamp(c.x - d.x / sx, 0, image.width - c.w), y: clamp(c.y - d.y / sy, 0, image.height - c.h) },
        };
    }
    let x0 = c.x, y0 = c.y, x1 = c.x + c.w, y1 = c.y + c.h;
    if (handle.includes('w')) x0 = clamp(c.x + d.x / sx, 0, x1 - MIN_CROP_PX);
    if (handle.includes('e')) x1 = clamp(x1 + d.x / sx, x0 + MIN_CROP_PX, image.width);
    if (handle.includes('n')) y0 = clamp(c.y + d.y / sy, 0, y1 - MIN_CROP_PX);
    if (handle.includes('s')) y1 = clamp(y1 + d.y / sy, y0 + MIN_CROP_PX, image.height);
    // New box edges in the start item's local frame, at the same scale.
    const l = (x0 - c.x) * sx, t = (y0 - c.y) * sy;
    const r = start.w + (x1 - (c.x + c.w)) * sx, b = start.h + (y1 - (c.y + c.h)) * sy;
    const w = r - l, h = b - t;
    const centre = apply(itemMatrix(start), { x: (l + r) / 2, y: (t + b) / 2 });
    return { ...start, x: centre.x - w / 2, y: centre.y - h / 2, w, h, crop: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}
```


- [ ] **Step 4: Implement the gesture controller**

`app/src/ui/canvas/gestures.ts`:
```ts
import { addItems, findItem, moveItemsToPage, removeItems, setBoxes, updateItems } from '../../model/commands';
import { cropDrag } from '../../model/crop';
import { createShapeItem, createStrokeItem, createTextItem } from '../../model/factory';
import {
    boxBounds, boxFromLine, handleAt, hitItem, lineEndpoints, resizeBox, rotateBox, rotation, apply as applyM,
    unionRect, type ResizeHandle,
} from '../../model/geometry';
import { itemsInRect, strokesTouched, topItemAt } from '../../model/hits';
import { snapRect, snapTargets } from '../../model/snap';
import type { Box, Id, ImageItem, Item, Point, Rect, ShapeItem, ShapeKind, StrokeItem, TextItem } from '../../model/types';
import type { EditorAssets } from '../editorAssets';
import type { EditorStore, View } from '../store';
import { clampView, pageAt, pageTops, toPagePoint, toWorld, zoomAround } from './viewport';

export interface PointerInfo {
    id: number;
    x: number;
    y: number;
    button: number;
    pointerType: string;
    pressure: number;
    shiftKey: boolean;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
}

type Drag =
    | { kind: 'pan'; start: Point; view: View }
    | { kind: 'move'; page: number; start: Point; startScreen: Point; items: Item[]; started: boolean }
    | { kind: 'resize'; page: number; start: Point; item: Item; handle: ResizeHandle; started: boolean }
    | { kind: 'rotate'; page: number; start: Point; item: Item; started: boolean }
    | { kind: 'line-end'; page: number; item: ShapeItem; fixed: Point; movingIsA: boolean; started: boolean }
    | { kind: 'crop'; page: number; start: Point; item: ImageItem; handle: ResizeHandle | 'pan'; started: boolean }
    | { kind: 'marquee'; page: number; start: Point; base: Id[] }
    | { kind: 'draw'; page: number; points: number[]; tool: 'pen' | 'highlighter' }
    | { kind: 'erase'; page: number; last: Point }
    | { kind: 'shape'; page: number; start: Point; id: Id; shape: ShapeKind }
    | { kind: 'text'; page: number; start: Point; current: Point }
    | { kind: 'pinch'; startDist: number; startMid: Point; view: View };

const isLine = (i: Item): i is ShapeItem => i.kind === 'shape' && (i.shape === 'line' || i.shape === 'arrow');

export class GestureController {
    private pointers = new Map<number, Point>();
    private drag: Drag | null = null;
    spaceHeld = false;
    hover: Id | null = null;
    cursor = 'default';
    live: { page: number; item: StrokeItem } | null = null;
    marquee: { page: number; rect: Rect } | null = null;
    eraser: { page: number; p: Point; r: number } | null = null;

    constructor(
        private store: EditorStore,
        private assets: EditorAssets,
        private size: () => { w: number; h: number },
        private onChange: () => void,
    ) {}

    private get st() { return this.store.getState(); }
    private px(n: number) { return n / this.st.view.zoom; }
    private world(s: Point) { return toWorld(this.st.view, s); }
    private hitPage(s: Point) {
        const doc = this.store.doc;
        const { index } = pageAt(doc.setup, doc.pages.length, this.world(s));
        return { index, p: toPagePoint(doc.setup, index, this.world(s)) };
    }
    private onPage(page: number, s: Point) { return toPagePoint(this.store.doc.setup, page, this.world(s)); }
    private setView(v: View) {
        const { w, h } = this.size();
        this.store.setView(clampView(v, this.store.doc.setup, this.store.doc.pages.length, w, h));
    }
    private begin(d: { started: boolean }) {
        if (!d.started) {
            d.started = true;
            this.store.beginGesture();
        }
    }

    down(e: PointerInfo) {
        this.pointers.set(e.id, { x: e.x, y: e.y });
        if (this.pointers.size === 2 && e.pointerType === 'touch') {
            this.cancel();
            const [a, b] = [...this.pointers.values()];
            this.drag = { kind: 'pinch', startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1, startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view: this.st.view };
            return;
        }
        if (this.pointers.size > 1) return;
        const tool = this.st.tool;
        if (e.button === 1 || e.button === 2 || tool === 'hand' || this.spaceHeld) {
            this.drag = { kind: 'pan', start: { x: e.x, y: e.y }, view: this.st.view };
            this.cursor = 'grabbing';
            return;
        }
        if (e.button !== 0) return;
        const { index, p } = this.hitPage(e);
        this.store.setCurrentPage(index);
        const o = this.st.options;
        switch (tool) {
            case 'pen':
            case 'highlighter':
                this.drag = { kind: 'draw', page: index, points: [p.x, p.y, e.pointerType === 'pen' ? e.pressure : 0.5], tool };
                this.live = { page: index, item: createStrokeItem([p.x, p.y, 0.5], tool, tool === 'pen' ? o.penColor : o.highlighterColor, tool === 'pen' ? o.penSize : o.highlighterSize) };
                this.onChange();
                return;
            case 'eraser':
                this.store.beginGesture();
                this.drag = { kind: 'erase', page: index, last: p };
                this.eraseAlong(index, p, p);
                return;
            case 'rect':
            case 'ellipse':
            case 'line':
            case 'arrow': {
                const s = createShapeItem(tool, { x: p.x, y: p.y, w: 0, h: 0 }, { stroke: o.shapeStroke, strokeWidth: o.shapeWidth, fill: tool === 'rect' || tool === 'ellipse' ? o.shapeFill : null });
                this.store.beginGesture();
                this.store.apply((d) => addItems(d, index, [s]));
                this.drag = { kind: 'shape', page: index, start: p, id: s.id, shape: tool };
                return;
            }
            case 'text':
                this.drag = { kind: 'text', page: index, start: p, current: p };
                return;
            default:
                this.selectDown(index, p, e);
        }
    }

    private selectDown(index: number, p: Point, e: PointerInfo) {
        const doc = this.store.doc;
        const page = doc.pages[index];
        const st = this.st;
        const tol = this.px(e.pointerType === 'touch' ? 16 : 8);
        if (st.cropId) {
            const f = findItem(doc, st.cropId);
            if (f && f.item.kind === 'image' && f.pageIndex === index) {
                const h = handleAt(f.item, p, tol, -1e6);
                if (h && h !== 'rotate') {
                    this.drag = { kind: 'crop', page: index, start: p, item: f.item, handle: h, started: false };
                    return;
                }
                if (hitItem(f.item, p, 0)) {
                    this.drag = { kind: 'crop', page: index, start: p, item: f.item, handle: 'pan', started: false };
                    return;
                }
            }
            this.store.setCrop(null);
        }
        if (st.selection.length === 1) {
            const f = findItem(doc, st.selection[0]);
            if (f && f.pageIndex === index && !f.item.locked) {
                const h = handleAt(f.item, p, tol, isLine(f.item) ? -1e6 : this.px(24));
                if (h && isLine(f.item)) {
                    const [a, b] = lineEndpoints(f.item);
                    this.drag = { kind: 'line-end', page: index, item: f.item, fixed: h === 'nw' ? b : a, movingIsA: h === 'nw', started: false };
                    return;
                }
                if (h === 'rotate') {
                    this.drag = { kind: 'rotate', page: index, start: p, item: f.item, started: false };
                    return;
                }
                if (h) {
                    this.drag = { kind: 'resize', page: index, start: p, item: f.item, handle: h, started: false };
                    return;
                }
            }
        }
        const hit = topItemAt(page.items, p, this.px(3));
        if (!hit) {
            if (!e.shiftKey) this.store.select([]);
            this.drag = { kind: 'marquee', page: index, start: p, base: e.shiftKey ? st.selection : [] };
            return;
        }
        let sel = st.selection.filter((id) => page.items.some((i) => i.id === id));
        if (e.shiftKey) sel = sel.includes(hit.id) ? sel.filter((i) => i !== hit.id) : [...sel, hit.id];
        else if (!sel.includes(hit.id)) sel = [hit.id];
        this.store.select(sel);
        const items = page.items.filter((i) => sel.includes(i.id) && !i.locked);
        if (items.length && sel.includes(hit.id)) {
            this.drag = { kind: 'move', page: index, start: p, startScreen: { x: e.x, y: e.y }, items, started: false };
        }
    }

    doubleClick(s: Point) {
        if (this.st.tool !== 'select') return;
        const { index, p } = this.hitPage(s);
        const hit = topItemAt(this.store.doc.pages[index].items, p, this.px(3));
        if (hit?.kind === 'text' && !hit.locked) {
            this.store.beginGesture();
            this.store.setEditingText(hit.id);
        } else if (hit?.kind === 'image' && !hit.locked) this.store.setCrop(hit.id);
    }

    move(e: PointerInfo) {
        if (!this.pointers.has(e.id)) {
            this.hoverAt(e);
            return;
        }
        this.pointers.set(e.id, { x: e.x, y: e.y });
        const d = this.drag;
        if (!d) return;
        const doc = this.store.doc;
        switch (d.kind) {
            case 'pinch': {
                const [a, b] = [...this.pointers.values()];
                if (!a || !b) return;
                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                const zoomed = zoomAround(d.view, dist / d.startDist, d.startMid);
                this.setView({ ...zoomed, scrollX: zoomed.scrollX - (mid.x - d.startMid.x) / zoomed.zoom, scrollY: zoomed.scrollY - (mid.y - d.startMid.y) / zoomed.zoom });
                return;
            }
            case 'pan':
                this.setView({ ...d.view, scrollX: d.view.scrollX - (e.x - d.start.x) / d.view.zoom, scrollY: d.view.scrollY - (e.y - d.start.y) / d.view.zoom });
                return;
            case 'move': {
                if (!d.started && Math.hypot(e.x - d.startScreen.x, e.y - d.startScreen.y) < 3) return;
                this.begin(d);
                const p = this.onPage(d.page, e);
                let dx = p.x - d.start.x, dy = p.y - d.start.y;
                const ids = new Set(d.items.map((i) => i.id));
                if (!e.altKey) {
                    const moving = unionRect(d.items.map((i) => boxBounds({ ...i, x: i.x + dx, y: i.y + dy })))!;
                    const others = doc.pages[d.page].items.filter((i) => !ids.has(i.id)).map(boxBounds);
                    const snap = snapRect(moving, snapTargets(doc.setup, others), this.px(6), doc.setup.grid);
                    dx += snap.dx;
                    dy += snap.dy;
                    this.store.setSnapGuides({ page: d.page, x: snap.guideX, y: snap.guideY });
                }
                const boxes: Record<Id, Box> = {};
                for (const i of d.items) boxes[i.id] = { x: i.x + dx, y: i.y + dy, w: i.w, h: i.h, rotation: i.rotation };
                this.store.apply((doc2) => setBoxes(doc2, boxes));
                return;
            }
            case 'resize': {
                this.begin(d);
                const p = this.onPage(d.page, e);
                const delta = { x: p.x - d.start.x, y: p.y - d.start.y };
                if (d.item.kind === 'text') {
                    const handle = (d.handle.includes('w') ? 'w' : d.handle.includes('e') ? 'e' : null);
                    if (!handle) return;
                    const box = resizeBox(d.item, handle, delta, false, d.item.fontSize * 2);
                    const next = { ...d.item, w: box.w } as TextItem;
                    const h = this.assets.textHeight(next);
                    const y = d.item.rotation ? box.y + (box.h - h) / 2 : d.item.y;
                    this.store.apply((doc2) => setBoxes(doc2, { [d.item.id]: { ...box, y, h } }));
                    return;
                }
                const keep = (d.item.kind === 'image') !== e.shiftKey;
                const box = resizeBox(d.item, d.handle, delta, keep);
                this.store.apply((doc2) => setBoxes(doc2, { [d.item.id]: box }));
                return;
            }
            case 'rotate': {
                this.begin(d);
                const p = this.onPage(d.page, e);
                const r = rotateBox(d.item, d.start, p, e.shiftKey);
                this.store.apply((doc2) => setBoxes(doc2, { [d.item.id]: { x: d.item.x, y: d.item.y, w: d.item.w, h: d.item.h, rotation: r } }));
                return;
            }
            case 'line-end': {
                this.begin(d);
                let p = this.onPage(d.page, e);
                if (e.shiftKey) p = snapAngle(d.fixed, p);
                const b = d.movingIsA ? boxFromLine(p, d.fixed) : boxFromLine(d.fixed, p);
                this.store.apply((doc2) => updateItems(doc2, { [d.item.id]: b }));
                return;
            }
            case 'crop': {
                this.begin(d);
                const p = this.onPage(d.page, e);
                const local = applyM(rotation(-d.item.rotation), { x: p.x - d.start.x, y: p.y - d.start.y });
                const asset = doc.assets[d.item.assetId];
                const out = cropDrag(d.item, d.handle, local, { width: asset?.width ?? d.item.crop.w, height: asset?.height ?? d.item.crop.h });
                this.store.apply((doc2) => updateItems(doc2, { [d.item.id]: { x: out.x, y: out.y, w: out.w, h: out.h, crop: out.crop } }));
                return;
            }
            case 'marquee': {
                const p = this.onPage(d.page, e);
                const rect = { x: Math.min(p.x, d.start.x), y: Math.min(p.y, d.start.y), w: Math.abs(p.x - d.start.x), h: Math.abs(p.y - d.start.y) };
                this.marquee = { page: d.page, rect };
                const hits = itemsInRect(doc.pages[d.page].items, rect).map((i) => i.id);
                this.store.select([...new Set([...d.base, ...hits])]);
                this.onChange();
                return;
            }
            case 'draw': {
                const p = this.onPage(d.page, e);
                d.points.push(p.x, p.y, e.pointerType === 'pen' ? e.pressure : 0.5);
                const o = this.st.options;
                this.live = { page: d.page, item: createStrokeItem(d.points, d.tool, d.tool === 'pen' ? o.penColor : o.highlighterColor, d.tool === 'pen' ? o.penSize : o.highlighterSize) };
                this.onChange();
                return;
            }
            case 'erase': {
                const p = this.onPage(d.page, e);
                this.eraseAlong(d.page, d.last, p);
                d.last = p;
                return;
            }
            case 'shape': {
                let p = this.onPage(d.page, e);
                if (e.shiftKey) p = d.shape === 'line' || d.shape === 'arrow' ? snapAngle(d.start, p) : square(d.start, p);
                const b = boxFromLine(d.start, p);
                this.store.apply((doc2) => updateItems(doc2, { [d.id]: d.shape === 'line' || d.shape === 'arrow' ? b : { ...b, flipX: false, flipY: false } }));
                return;
            }
            case 'text':
                d.current = this.onPage(d.page, e);
                return;
        }
    }

    private eraseAlong(page: number, a: Point, b: Point) {
        const r = this.px(8);
        this.eraser = { page, p: b, r };
        const ids = strokesTouched(this.store.doc.pages[page].items, a, b, r);
        if (ids.length) this.store.apply((d) => removeItems(d, ids));
        this.onChange();
    }

    up(e: PointerInfo) {
        this.pointers.delete(e.id);
        const d = this.drag;
        if (d?.kind === 'pinch') {
            if (this.pointers.size === 0) this.drag = null;
            return;
        }
        this.drag = null;
        if (this.cursor === 'grabbing') this.cursor = this.spaceHeld || this.st.tool === 'hand' ? 'grab' : 'default';
        if (!d) return;
        const doc = this.store.doc;
        switch (d.kind) {
            case 'move': {
                if (!d.started) break;
                const ids = d.items.map((i) => i.id);
                const now = ids.map((id) => findItem(this.store.doc, id)?.item).filter((i): i is Item => !!i);
                const u = unionRect(now.map(boxBounds));
                if (u) {
                    const tops = pageTops(doc.setup, doc.pages.length);
                    const centre = { x: u.x + u.w / 2, y: tops[d.page] + u.y + u.h / 2 };
                    const target = pageAt(doc.setup, doc.pages.length, centre);
                    if (target.inside && target.index !== d.page) {
                        this.store.apply((doc2) => moveItemsToPage(doc2, ids, target.index, 0, tops[d.page] - tops[target.index]));
                        this.store.setCurrentPage(target.index);
                    }
                }
                this.store.endGesture();
                break;
            }
            case 'resize':
            case 'rotate':
            case 'line-end':
            case 'crop':
                if (d.started) this.store.endGesture();
                break;
            case 'marquee':
                this.marquee = null;
                break;
            case 'draw': {
                const o = this.st.options;
                const stroke = createStrokeItem(d.points, d.tool, d.tool === 'pen' ? o.penColor : o.highlighterColor, d.tool === 'pen' ? o.penSize : o.highlighterSize);
                this.live = null;
                this.store.apply((doc2) => addItems(doc2, d.page, [stroke]));
                break;
            }
            case 'erase':
                this.eraser = null;
                this.store.endGesture();
                break;
            case 'shape': {
                const s = findItem(this.store.doc, d.id)?.item;
                if (s && Math.hypot(s.w, s.h) < 2) {
                    if (d.shape === 'rect' || d.shape === 'ellipse') {
                        this.store.apply((doc2) => updateItems(doc2, { [d.id]: { x: d.start.x - 50, y: d.start.y - 30, w: 100, h: 60 } }));
                    } else {
                        this.store.cancelGesture();
                        break;
                    }
                }
                this.store.endGesture();
                this.store.setTool('select');
                this.store.select([d.id]);
                break;
            }
            case 'text': {
                const width = Math.abs(d.current.x - d.start.x) > 20 ? Math.abs(d.current.x - d.start.x) : 200;
                const x = Math.min(d.start.x, d.current.x);
                const t = createTextItem({ x, y: d.start.y }, this.st.options.text, width);
                this.store.beginGesture();
                this.store.apply((doc2) => addItems(doc2, d.page, [t]));
                this.store.setTool('select');
                this.store.setEditingText(t.id);
                break;
            }
            default:
                break;
        }
        this.store.setSnapGuides(null);
        this.onChange();
    }

    cancel() {
        const d = this.drag;
        this.drag = null;
        this.live = null;
        this.marquee = null;
        this.eraser = null;
        if (d && d.kind !== 'pan' && d.kind !== 'pinch' && this.store.gestureActive) this.store.cancelGesture();
        this.onChange();
    }

    hoverAt(s: Point) {
        const st = this.st;
        if (st.tool !== 'select') {
            this.cursor = st.tool === 'hand' || this.spaceHeld ? 'grab' : st.tool === 'text' ? 'text' : 'crosshair';
            return;
        }
        if (this.spaceHeld) {
            this.cursor = 'grab';
            return;
        }
        const { index, p } = this.hitPage(s);
        const items = this.store.doc.pages[index].items;
        let cursor = 'default';
        if (st.selection.length === 1) {
            const f = findItem(this.store.doc, st.selection[0]);
            if (f && f.pageIndex === index && !f.item.locked) {
                const h = handleAt(f.item, p, this.px(8), isLine(f.item) ? -1e6 : this.px(24));
                if (h === 'rotate') cursor = 'grab';
                else if (h) cursor = resizeCursor(h, f.item.rotation);
            }
        }
        const hit = topItemAt(items, p, this.px(3));
        if (cursor === 'default' && hit) cursor = hit.locked ? 'not-allowed' : 'move';
        const hover = hit?.id ?? null;
        if (hover !== this.hover || cursor !== this.cursor) {
            this.hover = hover;
            this.cursor = cursor;
            this.onChange();
        }
    }
}

function snapAngle(from: Point, to: Point): Point {
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    const a = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / (Math.PI / 4)) * (Math.PI / 4);
    return { x: from.x + Math.cos(a) * len, y: from.y + Math.sin(a) * len };
}

function square(from: Point, to: Point): Point {
    const s = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
    return { x: from.x + Math.sign(to.x - from.x || 1) * s, y: from.y + Math.sign(to.y - from.y || 1) * s };
}

const CURSORS = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'];
const HANDLE_ANGLE: Record<ResizeHandle, number> = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 };

function resizeCursor(h: ResizeHandle, rotationDeg: number): string {
    const a = (((HANDLE_ANGLE[h] + rotationDeg) % 180) + 180) % 180;
    return CURSORS[Math.round(a / 45) % 4];
}
```


- [ ] **Step 5: Implement the overlay**

`app/src/ui/canvas/overlay.ts` exports `drawOverlay(ctx, env)` where `env = { state: EditorState; doc: CheatDocument; ctrl: GestureController; assets: EditorAssets; dpr: number }`. It runs after the pages are drawn, with `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`, and converts page points to screen with `toScreen(view, fromPagePoint(setup, page, p))`. In order:

1. Hover outline: if `ctrl.hover` is set, not selected and the tool is select, stroke its `boxCorners` polygon in `rgba(47,111,219,0.5)` at 1 px.
2. Selection: for each selected item stroke its corner polygon in `#2f6fdb` at 1.5 px (dashed `[4, 3]` if locked). With exactly one unlocked item, the select tool active and no crop: lines and arrows get two 5 px radius white circles with a blue rim at their endpoints; other items get eight 8 px white squares with a blue rim at `handlePositions(item, 24 / zoom)` (12 px squares when `matchMedia('(pointer: coarse)')` matches), plus the rotate handle: a line from the top-centre handle and a 6 px radius circle.
3. Crop: for `cropId`, draw the full source (`assets.image(item)`) at 35% alpha over `fullImageRect(item, asset)` in the item's local frame (set the page transform, then `itemMatrix`), redraw the cropped region at full alpha, then stroke the crop frame in `#f0b90b` at 2 px with L-shaped corner marks 14 px long and 4 px thick and short bars at the edge midpoints.
4. Marquee: fill `rgba(47,111,219,0.08)` and stroke `#2f6fdb` 1 px over `ctrl.marquee.rect`.
5. Snap guides: for `state.snapGuides`, a 1 px `#e64980` line across the whole page at the guide x or y.
6. Live stroke: draw `ctrl.live.item` with `drawItem` under the page transform.
7. Eraser: a 1.5 px circle of radius `r` around `ctrl.eraser.p` in `--ink-3`.

- [ ] **Step 6: Implement the canvas view**

`app/src/ui/canvas/CanvasView.tsx` behaviour:
- A wrapper `div.canvas-wrap` (fills its grid area, `position: relative`) containing `<canvas role="img" aria-label="Cheatsheet pages">` with `touch-action: none`, and the `TextEditor` (Task 18) as an absolutely positioned sibling.
- One `GestureController` per mount (`useRef`), built with the store, the assets, a size getter reading the wrapper's client size, and an `onChange` that schedules a redraw.
- A `ResizeObserver` on the wrapper sets `canvas.width/height` to CSS size times `devicePixelRatio` and schedules a redraw. On the first non-zero size, if the store's view still has its initial `zoom: 1, scrollX: 0, scrollY: 0`, set `fitWidth(setup, width, currentPage)`.
- `store.subscribe` schedules a redraw through `requestAnimationFrame` (one pending frame at most).
- Redraw: fill with `--canvas-bg` (read with `getComputedStyle`, refreshed when the theme changes); for each `visiblePages(...)` draw a soft page shadow (`ctx.shadowColor`, `shadowBlur = 16 * dpr`, `shadowOffsetY = 2 * dpr`, fill the page rectangle white, then reset the shadow), set the transform to `(dpr * zoom, 0, 0, dpr * zoom, -scrollX * zoom * dpr, (top - scrollY) * zoom * dpr)`, then `drawPage(ctx, page, setup, assets, { guides: showGuides, hidden: editingTextId ? new Set([editingTextId]) : undefined })`; then `drawOverlay`. Update `canvas.style.cursor = ctrl.cursor`.
- Pointer events: `pointerdown` calls `setPointerCapture`, focuses the wrapper (so keyboard shortcuts work after clicking the canvas), converts to `PointerInfo` with coordinates relative to the canvas, and calls `ctrl.down`; `pointermove`, `pointerup` and `pointercancel` call `move`, `up` and `cancel`. `dblclick` calls `ctrl.doubleClick`. `contextmenu` is prevented.
- A non-passive `wheel` listener: with Ctrl or Meta, `zoomAround(view, Math.exp(-deltaY * 0.0025), point)`; otherwise pan by `deltaX / zoom` and `deltaY / zoom` (with Shift swapping axes for mice). Always `preventDefault`. Pass the result through `clampView`.
- After every view change, set the current page to `pageAt(setup, count, toWorld(view, centre of viewport)).index`.
- `keydown`/`keyup` for Space on `window` (ignored when `isEditableTarget`) toggle `ctrl.spaceHeld` and the cursor.

`canvas.css`: `.canvas-wrap { position: relative; overflow: hidden; background: var(--canvas-bg); outline: none; } .canvas-wrap canvas { display: block; width: 100%; height: 100%; touch-action: none; }`.

- [ ] **Step 7: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/src
git commit -m "feat(ui): canvas view with selection, snapping, resize, rotate, crop, pan and pinch zoom"
```

---

### Task 18: Text editing and text height sync

**Files:**
- Create: `app/src/ui/editor/TextEditor.tsx`, `app/src/ui/editor/textEditor.css`, `app/src/ui/syncTextHeights.ts`
- Modify: `app/src/ui/canvas/CanvasView.tsx` (render `<TextEditor assets={assets} />` inside the wrapper)
- Test: `app/src/ui/syncTextHeights.test.ts`, `app/src/ui/editor/TextEditor.test.tsx`

**Interfaces:**
- Consumes: store, `EditorAssets.textHeight`, `updateItems`, `removeItems`, `findItem`, viewport.
- Produces: `TextEditor {assets}` component; `syncTextHeights(store, measure: (item: TextItem) => number): boolean` (returns true when something changed, applied through `amendDoc`).

Editing lifecycle: the gesture is begun by whoever starts editing (the text tool on creation, `doubleClick` on an existing box). `TextEditor` updates the item on every keystroke inside that gesture and ends it on blur, Escape or Mod+Enter. If the text is empty when editing ends, the item is removed; if the gesture began with the item's creation, that means `cancelGesture()` so nothing is recorded.

- [ ] **Step 1: Write failing tests**

`app/src/ui/syncTextHeights.test.ts`:
```ts
import { expect, test } from 'vitest';
import { syncTextHeights } from './syncTextHeights';
import { EditorStore } from './store';
import { addItems } from '../model/commands';
import { createDocument, createTextItem } from '../model/factory';

test('updates stale heights without an undo step', () => {
    const t = createTextItem({ x: 0, y: 0 }, { font: 'sans', fontSize: 10, color: '#000', background: null, align: 'left' }, 100, 'hello');
    const store = new EditorStore(addItems(createDocument('t', 0), 0, [t]));
    expect(syncTextHeights(store, () => 42)).toBe(true);
    expect(store.doc.pages[0].items[0].h).toBe(42);
    expect(syncTextHeights(store, () => 42)).toBe(false);
    store.undo();
    expect(store.doc.pages[0].items).toHaveLength(0); // the undo step is the original add, not the height sync
});
```

`app/src/ui/editor/TextEditor.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { TextEditor } from './TextEditor';
import { EditorStore, StoreContext } from '../store';
import { EditorAssets } from '../editorAssets';
import { addItems } from '../../model/commands';
import { createDocument, createTextItem } from '../../model/factory';

function setup(text: string) {
    const t = createTextItem({ x: 10, y: 10 }, { font: 'sans', fontSize: 10, color: '#000', background: null, align: 'left' }, 100, text);
    const store = new EditorStore(createDocument('t', 0));
    store.beginGesture();
    store.apply((d) => addItems(d, 0, [t]));
    store.setEditingText(t.id);
    const assets = new EditorAssets(async () => null, () => {});
    render(<StoreContext.Provider value={store}><TextEditor assets={assets} /></StoreContext.Provider>);
    return { store, t };
}

test('typing updates the item and blur commits one undo step', () => {
    const { store } = setup('');
    const box = screen.getByRole('textbox', { name: 'Text box' });
    fireEvent.change(box, { target: { value: '**Bold** idea' } });
    expect(store.doc.pages[0].items[0]).toMatchObject({ text: '**Bold** idea' });
    act(() => box.blur());
    expect(store.getState().editingTextId).toBeNull();
    store.undo();
    expect(store.doc.pages[0].items).toHaveLength(0);
});

test('a new box left empty disappears without a trace', () => {
    const { store } = setup('');
    act(() => screen.getByRole('textbox', { name: 'Text box' }).blur());
    expect(store.doc.pages[0].items).toHaveLength(0);
    expect(store.getState().history.past).toHaveLength(0);
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run app/src/ui/syncTextHeights.test.ts app/src/ui/editor`
Expected: FAIL.

- [ ] **Step 3: Implement**

`app/src/ui/syncTextHeights.ts`:
```ts
import { updateItems, type ItemPatch } from '../model/commands';
import type { Id, TextItem } from '../model/types';
import type { EditorStore } from './store';

export function syncTextHeights(store: EditorStore, measure: (item: TextItem) => number): boolean {
    const patches: Record<Id, ItemPatch> = {};
    for (const page of store.doc.pages) {
        for (const item of page.items) {
            if (item.kind !== 'text') continue;
            const h = measure(item);
            if (Math.abs(h - item.h) > 0.01) patches[item.id] = { h };
        }
    }
    if (Object.keys(patches).length === 0) return false;
    store.amendDoc((d) => updateItems(d, patches));
    return true;
}
```

`app/src/ui/editor/TextEditor.tsx`:
```tsx
import { useEffect, useLayoutEffect, useRef } from 'react';
import { findItem, removeItems, updateItems } from '../../model/commands';
import type { TextItem } from '../../model/types';
import { FONT_FAMILIES } from '../../render/fonts';
import { fromPagePoint, toScreen } from '../canvas/viewport';
import type { EditorAssets } from '../editorAssets';
import { useEditor, useStore } from '../store';
import './textEditor.css';

export function TextEditor({ assets }: { assets: EditorAssets }) {
    const store = useStore();
    const id = useEditor((s) => s.editingTextId);
    const view = useEditor((s) => s.view);
    const doc = useEditor((s) => s.history.present);
    const ref = useRef<HTMLTextAreaElement>(null);
    const createdEmpty = useRef(false);

    const found = id ? findItem(doc, id) : null;
    const item = found?.item.kind === 'text' ? (found.item as TextItem) : null;

    useLayoutEffect(() => {
        if (!id) return;
        const f = findItem(store.doc, id);
        createdEmpty.current = !!f && f.item.kind === 'text' && f.item.text === '' && (store.getState().history.gestureBase ? !findItem(store.getState().history.gestureBase!, id) : false);
        const el = ref.current;
        if (el) {
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
        }
    }, [id, store]);

    useEffect(() => {
        if (id && !item) store.setEditingText(null);
    }, [id, item, store]);

    if (!id || !item || !found) return null;

    const finish = () => {
        const current = findItem(store.doc, id)?.item as TextItem | undefined;
        if (!current || current.text.trim() === '') {
            if (createdEmpty.current) store.cancelGesture();
            else {
                store.apply((d) => removeItems(d, [id]));
                store.endGesture();
            }
        } else store.endGesture();
        store.setEditingText(null);
    };

    const z = view.zoom;
    const topLeft = toScreen(view, fromPagePoint(doc.setup, found.pageIndex, { x: item.x, y: item.y }));
    return (
        <textarea
            ref={ref}
            aria-label="Text box"
            className="text-editor"
            value={item.text}
            spellCheck
            style={{
                left: topLeft.x,
                top: topLeft.y,
                width: item.w * z,
                height: Math.max(item.h, assets.textHeight(item)) * z,
                transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
                font: `${item.fontSize * z}px/1.25 ${FONT_FAMILIES[item.font]}`,
                padding: item.padding * z,
                color: item.color,
                background: item.background ?? 'rgb(255 255 255 / 0.92)',
                textAlign: item.align,
            }}
            onChange={(e) => {
                const text = e.target.value;
                store.apply((d) => updateItems(d, { [id]: { text, h: assets.textHeight({ ...item, text }) } }));
            }}
            onBlur={finish}
            onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                    e.preventDefault();
                    e.currentTarget.blur();
                }
            }}
            placeholder="Type here. **bold**, *italic*, `code`, - lists, $x^2$"
        />
    );
}
```

`textEditor.css`: `.text-editor { position: absolute; transform-origin: center; resize: none; border: 1.5px solid #2f6fdb; border-radius: 2px; outline: none; overflow: hidden; box-shadow: var(--shadow); white-space: pre-wrap; }`.

In `App` (Task 22) call `syncTextHeights(store, (i) => assets.textHeight(i))` after fonts load and from the assets' `onReady` callback.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src
git commit -m "feat(ui): in-place Markdown text editing and text height sync"
```

---
### Task 19: Actions: import, clipboard, editing, layout and export

**Files:**
- Create: `app/src/ui/importImage.ts`, `app/src/ui/actions.ts`, `app/src/ui/editor/PdfImportDialog.tsx`, `app/src/ui/editor/pdfImport.css`
- Test: `app/src/ui/importImage.test.ts`, `app/src/ui/actions.test.ts`

**Interfaces:**
- Consumes: store, assets, `LibraryApi`, `Platform`, `classifyFile`, commands, `packPage`, `alignItems`, `distributeItems`, `findTrimRect`, `exportPdf`, `browserPdfDeps`, `exportPngs`, `packCheatsheet`, `unpackCheatsheet`, `importLegacyAutosave`, `createImageItem`, `createTextItem`, `printableArea`, `downscaleSize`, `sniffImageMime`.
- Produces:
  - `chooseEncoding(mime, scaled): 'keep' | 'png' | 'jpeg'`; `decodeImage(blob): Promise<DecodedImage>` with `DecodedImage {bytes, mime, width, height, bitmap}`.
  - `class Actions` with: `onOpenDocument: (doc) => void`, `pendingPdf: File | null`, `importFiles(files, at?)`, `importImages(blobs, at?)`, `addImageRegions(pageBytes: Uint8Array, regions: Rect[], dpi)`, `pasteText(text, at?)`, `pasteFromClipboard()`, `copy()`, `cut()`, `paste()`, `hasClipboard()`, `deleteSelection()`, `duplicateSelection()`, `nudge(dx, dy)`, `selectAll()`, `reorder(how)`, `align(mode)`, `distribute(axis)`, `pack(mode)`, `trimSelected()`, `resetFilters()`, `toggleLock()`, `addPage()`, `duplicatePage(i)`, `removePage(i)`, `movePage(from, to)`, `goToPage(i)`, `zoomBy(f)`, `zoomActual()`, `zoomFit()`, `exportPdf(pages?)`, `exportPng(pages?)`, `saveCheatsheet()`, `run(command: Command)`.
  - `PdfImportDialog` component.
  - `at` is `{ page: number; point: Point }` in page coordinates (drop location); without it, items land in the centre of the current page.

- [ ] **Step 1: Write failing tests**

`app/src/ui/importImage.test.ts`:
```ts
import { expect, test } from 'vitest';
import { chooseEncoding } from './importImage';

test('keeps small PNG, JPEG and WebP bytes as they are', () => {
    expect(chooseEncoding('image/png', false)).toBe('keep');
    expect(chooseEncoding('image/jpeg', false)).toBe('keep');
    expect(chooseEncoding('image/webp', false)).toBe('keep');
});

test('re-encodes GIFs and anything that was downscaled', () => {
    expect(chooseEncoding('image/gif', false)).toBe('png');
    expect(chooseEncoding('image/png', true)).toBe('png');
    expect(chooseEncoding('image/jpeg', true)).toBe('jpeg');
});
```

`app/src/ui/actions.test.ts`:
```ts
import 'fake-indexeddb/auto';
import { beforeEach, expect, test, vi } from 'vitest';
import { Actions } from './actions';
import { EditorStore } from './store';
import { EditorAssets } from './editorAssets';
import { MemoryLibrary } from '../storage/library';
import { addItems } from '../model/commands';
import { createDocument, createShapeItem } from '../model/factory';
import type { Platform } from '../platform';

const platform: Platform = {
    kind: 'web',
    saveFile: vi.fn(async () => 'saved' as const),
    pickFiles: vi.fn(async () => []),
    readLegacyAutosave: async () => null,
};

let store: EditorStore;
let actions: Actions;
const sq = (x: number) => createShapeItem('rect', { x, y: 0, w: 10, h: 10 }, { stroke: '#000', strokeWidth: 1, fill: null });

beforeEach(() => {
    store = new EditorStore(addItems(createDocument('t', 0), 0, [sq(0), sq(50)]));
    actions = new Actions(store, new EditorAssets(async () => null, () => {}), new MemoryLibrary(), platform);
});

test('copy and paste duplicates with new ids and an offset', () => {
    const [a] = store.doc.pages[0].items;
    store.select([a.id]);
    actions.copy();
    actions.paste();
    const items = store.doc.pages[0].items;
    expect(items).toHaveLength(3);
    expect(items[2].id).not.toBe(a.id);
    expect(items[2].x).toBe(12);
    expect(store.getState().selection).toEqual([items[2].id]);
});

test('cut removes and paste brings it back', () => {
    const [a] = store.doc.pages[0].items;
    store.select([a.id]);
    actions.cut();
    expect(store.doc.pages[0].items).toHaveLength(1);
    actions.paste();
    expect(store.doc.pages[0].items).toHaveLength(2);
});

test('pasting plain text creates a text box on the current page', () => {
    actions.pasteText('E = mc^2');
    const last = store.doc.pages[0].items.at(-1)!;
    expect(last).toMatchObject({ kind: 'text', text: 'E = mc^2' });
});

test('nudge, select all, delete', () => {
    actions.selectAll();
    expect(store.getState().selection).toHaveLength(2);
    actions.nudge(10, 0);
    expect(store.doc.pages[0].items.map((i) => i.x)).toEqual([10, 60]);
    actions.deleteSelection();
    expect(store.doc.pages[0].items).toHaveLength(0);
});

test('locked items are not nudged or deleted', () => {
    const [a] = store.doc.pages[0].items;
    store.select([a.id]);
    actions.toggleLock();
    actions.nudge(5, 5);
    actions.deleteSelection();
    expect(store.doc.pages[0].items[0]).toMatchObject({ x: 0, locked: true });
});

test('saving a .cheatsheet hands a zip to the platform', async () => {
    await actions.saveCheatsheet();
    expect(platform.saveFile).toHaveBeenCalledWith('t.cheatsheet', expect.any(Blob), 'cheatsheet');
});

test('a corrupt .cheatsheet is reported and nothing opens', async () => {
    const open = vi.fn();
    actions.onOpenDocument = open;
    await actions.importFiles([new File([new Uint8Array([1, 2, 3])], 'broken.cheatsheet')]);
    expect(open).not.toHaveBeenCalled();
    expect(store.getState().toasts.at(-1)).toMatchObject({ kind: 'error' });
});

test('pasted text stays inside the printable area', () => {
    actions.pasteText('x'.repeat(10));
    const t = store.doc.pages[0].items.at(-1)!;
    expect(t.kind).toBe('text');
    expect(t.x).toBeGreaterThanOrEqual(18);
    expect(t.x + t.w).toBeLessThanOrEqual(595.2756 - 18 + 1e-6);
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run app/src/ui/importImage.test.ts app/src/ui/actions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement image decoding**

`app/src/ui/importImage.ts`:
```ts
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
```

- [ ] **Step 4: Implement actions**

`app/src/ui/actions.ts`:
```ts
import {
    addAsset, addItems, addPage, cloneItems, duplicateItems, duplicatePage, findItem, movePage, removeItems,
    removePage, reorderItems, translateItems, updateItems, type ItemPatch, type Reorder,
} from '../model/commands';
import { createImageItem, createTextItem, DEFAULT_FILTERS } from '../model/factory';
import { FormatError, packCheatsheet, unpackCheatsheet, type AssetBytes } from '../model/format';
import { alignItems, distributeItems, packPage, type AlignMode, type PackMode } from '../model/layout';
import { importLegacyAutosave } from '../model/legacy';
import { pageDimensions, printableArea } from '../model/pageSizes';
import type { AssetMeta, CheatDocument, Id, ImageItem, Item, Point, Rect } from '../model/types';
import { classifyFile } from '../platform/classify';
import type { Platform } from '../platform';
import { exportPdf } from '../render/exportPdf';
import { exportPngs, safeFileName } from '../render/exportPng';
import { ensureFontsLoaded } from '../render/fonts';
import { findTrimRect } from '../render/filters';
import { browserPdfDeps } from '../render/rasterize';
import type { LibraryApi } from '../storage/library';
import { ACTUAL_SIZE, clampView, fitWidth, pageTops, zoomAround } from './canvas/viewport';
import type { EditorAssets } from './editorAssets';
import { decodeImage } from './importImage';
import type { Command } from './shortcuts';
import type { EditorStore } from './store';
import { zipSync } from 'fflate';

export type Drop = { page: number; point: Point };

export class Actions {
    onOpenDocument: (doc: CheatDocument) => void = () => {};
    pendingPdf: File | null = null;
    viewport = { w: 1000, h: 800 };
    private clipboard: Item[] = [];
    private pasteCount = 0;

    constructor(readonly store: EditorStore, readonly assets: EditorAssets, readonly library: LibraryApi, readonly platform: Platform) {}

    private get doc() { return this.store.doc; }
    private get page() { return this.store.getState().currentPage; }
    private error(e: unknown) {
        this.store.toast(e instanceof Error ? e.message : String(e), 'error');
    }
    private selected(): Item[] {
        return this.store.getState().selection.map((id) => findItem(this.doc, id)?.item).filter((i): i is Item => !!i);
    }
    private unlockedSelection(): Id[] {
        return this.selected().filter((i) => !i.locked).map((i) => i.id);
    }
    private centre(at?: Drop): { page: number; point: Point } {
        if (at) return at;
        const { w, h } = pageDimensions(this.doc.setup);
        return { page: this.page, point: { x: w / 2, y: h / 2 } };
    }

    // Import

    async importFiles(files: File[], at?: Drop): Promise<void> {
        const images: File[] = [];
        for (const f of files) {
            const kind = classifyFile(f.name, f.type);
            try {
                if (kind === 'image') images.push(f);
                else if (kind === 'pdf') {
                    this.pendingPdf = f;
                    this.store.openDialog('pdf-import');
                } else if (kind === 'cheatsheet') {
                    const { doc, assets } = unpackCheatsheet(new Uint8Array(await f.arrayBuffer()));
                    await this.openImported(doc, assets);
                } else if (kind === 'legacy-json') {
                    const { doc, assets } = await importLegacyAutosave(await f.text(), f.name.replace(/\.json$/i, ''));
                    await this.openImported(doc, assets);
                } else {
                    this.store.toast(`${f.name} is not something Cheatsheet Maker can open.`, 'error');
                }
            } catch (e) {
                this.error(e instanceof FormatError ? e : new Error(`${f.name}: ${(e as Error).message}`));
            }
        }
        if (images.length) await this.importImages(images, at);
    }

    private async openImported(doc: CheatDocument, assets: AssetBytes) {
        const stored = await this.library.importDocument(doc, assets);
        this.onOpenDocument(stored);
        this.store.toast(`Opened "${stored.title}".`);
    }

    async importImages(blobs: Blob[], at?: Drop): Promise<void> {
        const { page, point } = this.centre(at);
        const area = printableArea(this.doc.setup);
        const items: ImageItem[] = [];
        const metas: AssetMeta[] = [];
        for (const [n, blob] of blobs.entries()) {
            try {
                const img = await decodeImage(blob);
                const id = await this.library.putAsset(img.bytes, img.mime);
                this.assets.images.prime(id, img.bitmap);
                const meta = { id, mime: img.mime, width: img.width, height: img.height };
                metas.push(meta);
                items.push(createImageItem(meta, { x: point.x + n * 16, y: point.y + n * 16 }, area.w, area.h));
            } catch (e) {
                this.error(e);
            }
        }
        if (!items.length) return;
        this.store.apply((d) => addItems(metas.reduce(addAsset, d), page, items));
        this.store.setTool('select');
        this.store.select(items.map((i) => i.id));
    }

    /** Regions are in PDF points on a page rasterised at `dpi`; the raster is stored once. */
    async addImageRegions(pagePng: Uint8Array, pixelSize: { width: number; height: number }, regions: Rect[], dpi: number): Promise<void> {
        const id = await this.library.putAsset(pagePng, 'image/png');
        const meta = { id, mime: 'image/png', ...pixelSize };
        const area = printableArea(this.doc.setup);
        const { point } = this.centre();
        const s = dpi / 72;
        const items: ImageItem[] = regions.map((r, n) => {
            const fit = Math.min(1, area.w / r.w, area.h / r.h);
            const w = r.w * fit, h = r.h * fit;
            return {
                ...createImageItem(meta, point, area.w, area.h),
                x: point.x - w / 2 + n * 16,
                y: point.y - h / 2 + n * 16,
                w,
                h,
                crop: { x: Math.round(r.x * s), y: Math.round(r.y * s), w: Math.max(1, Math.round(r.w * s)), h: Math.max(1, Math.round(r.h * s)) },
                filters: { ...DEFAULT_FILTERS },
            };
        });
        this.store.apply((d) => addItems(addAsset(d, meta), this.page, items));
        this.store.setTool('select');
        this.store.select(items.map((i) => i.id));
    }

    pasteText(text: string, at?: Drop): void {
        const { page, point } = this.centre(at);
        const area = printableArea(this.doc.setup);
        const width = Math.min(240, area.w);
        const t = createTextItem({ x: 0, y: 0 }, this.store.getState().options.text, width, text.trim());
        const h = this.assets.textHeight(t);
        const x = Math.max(area.x, Math.min(point.x - width / 2, area.x + area.w - width));
        this.store.apply((d) => addItems(d, page, [{ ...t, x, y: Math.max(area.y, point.y - h / 2), h }]));
        this.store.select([t.id]);
    }

    async pasteFromClipboard(): Promise<void> {
        if (this.clipboard.length) return this.paste();
        try {
            const items = await navigator.clipboard.read();
            const blobs: Blob[] = [];
            for (const item of items) {
                const type = item.types.find((t) => t.startsWith('image/'));
                if (type) blobs.push(await item.getType(type));
                else if (item.types.includes('text/plain')) {
                    const text = await (await item.getType('text/plain')).text();
                    if (text.trim()) this.pasteText(text);
                }
            }
            if (blobs.length) await this.importImages(blobs);
        } catch {
            this.store.toast('The browser blocked clipboard access. Press Ctrl+V (Cmd+V on a Mac) to paste instead.');
        }
    }

    // Clipboard (items inside the app)

    hasClipboard() { return this.clipboard.length > 0; }
    copy() {
        this.clipboard = this.selected();
        this.pasteCount = 0;
    }
    cut() {
        this.copy();
        this.deleteSelection();
        this.pasteCount = -1;
    }
    paste() {
        if (!this.clipboard.length) return;
        this.pasteCount++;
        const copies = cloneItems(this.clipboard, 12 * this.pasteCount);
        this.store.apply((d) => addItems(d, this.page, copies));
        this.store.select(copies.map((i) => i.id));
    }

    // Editing

    deleteSelection() {
        const ids = this.unlockedSelection();
        if (ids.length) this.store.apply((d) => removeItems(d, ids));
    }
    duplicateSelection() {
        const ids = this.unlockedSelection();
        if (!ids.length) return;
        let created: Id[] = [];
        this.store.apply((d) => {
            const r = duplicateItems(d, ids);
            created = r.ids;
            return r.doc;
        });
        this.store.select(created);
    }
    nudge(dx: number, dy: number) {
        const ids = this.unlockedSelection();
        if (ids.length) this.store.apply((d) => translateItems(d, ids, dx, dy));
    }
    selectAll() {
        this.store.setTool('select');
        this.store.select(this.doc.pages[this.page].items.map((i) => i.id));
    }
    reorder(how: Reorder) {
        const ids = this.store.getState().selection;
        if (ids.length) this.store.apply((d) => reorderItems(d, ids, how));
    }
    align(mode: AlignMode) { this.store.apply((d) => alignItems(d, this.store.getState().selection, mode)); }
    distribute(axis: 'h' | 'v') { this.store.apply((d) => distributeItems(d, this.store.getState().selection, axis)); }
    pack(mode: PackMode) {
        const sel = this.store.getState().selection;
        const before = this.doc.pages.length;
        this.store.apply((d) => packPage(d, this.page, sel.length > 1 ? sel : null, mode, this.store.getState().packGap));
        const added = this.doc.pages.length - before;
        if (added > 0) this.store.toast(`Everything did not fit, so ${added} new page${added > 1 ? 's were' : ' was'} added after this one.`);
    }
    toggleLock() {
        const items = this.selected();
        if (!items.length) return;
        const lock = !items.every((i) => i.locked);
        const patches: Record<Id, ItemPatch> = {};
        for (const i of items) patches[i.id] = { locked: lock };
        this.store.apply((d) => updateItems(d, patches));
    }
    trimSelected() {
        const patches: Record<Id, ItemPatch> = {};
        for (const item of this.selected()) {
            if (item.kind !== 'image' || item.locked) continue;
            const src = this.assets.images.rgba(item.assetId);
            if (!src) continue;
            // Trim inside the current crop only.
            const { x, y, w, h } = item.crop;
            const data = new Uint8ClampedArray(w * h * 4);
            for (let row = 0; row < h; row++) data.set(src.data.subarray(((y + row) * src.width + x) * 4, ((y + row) * src.width + x + w) * 4), row * w * 4);
            const r = findTrimRect({ data, width: w, height: h });
            if (!r || (r.w === w && r.h === h)) continue;
            const sx = item.w / w, sy = item.h / h;
            patches[item.id] = { crop: { x: x + r.x, y: y + r.y, w: r.w, h: r.h }, w: r.w * sx, h: r.h * sy, x: item.x + r.x * sx, y: item.y + r.y * sy };
        }
        if (Object.keys(patches).length) this.store.apply((d) => updateItems(d, patches));
        else this.store.toast('Nothing to trim: the image has no plain border.');
    }
    resetFilters() {
        const patches: Record<Id, ItemPatch> = {};
        for (const i of this.selected()) if (i.kind === 'image') patches[i.id] = { filters: { ...DEFAULT_FILTERS } };
        this.store.apply((d) => updateItems(d, patches));
    }

    // Pages

    addPage() {
        const at = this.page + 1;
        this.store.apply((d) => addPage(d, at));
        this.goToPage(at);
    }
    duplicatePage(i: number) { this.store.apply((d) => duplicatePage(d, i)); this.goToPage(i + 1); }
    removePage(i: number) {
        if (this.doc.pages.length <= 1) return;
        this.store.apply((d) => removePage(d, i));
        this.goToPage(Math.min(i, this.doc.pages.length - 1));
    }
    movePage(from: number, to: number) { this.store.apply((d) => movePage(d, from, to)); this.goToPage(to); }
    goToPage(i: number) {
        const v = this.store.getState().view;
        this.store.setCurrentPage(i);
        this.store.setView({ ...v, scrollY: pageTops(this.doc.setup, this.doc.pages.length)[i] - 16 / v.zoom });
    }

    // View

    private setView(v: ReturnType<typeof fitWidth>) {
        this.store.setView(clampView(v, this.doc.setup, this.doc.pages.length, this.viewport.w, this.viewport.h));
    }
    zoomBy(f: number) { this.setView(zoomAround(this.store.getState().view, f, { x: this.viewport.w / 2, y: this.viewport.h / 2 })); }
    zoomActual() { this.zoomBy(ACTUAL_SIZE / this.store.getState().view.zoom); }
    zoomFit() { this.setView(fitWidth(this.doc.setup, this.viewport.w, this.page)); }

    // Export

    private async ready() {
        await ensureFontsLoaded();
        this.assets.invalidateText();
        const ids = new Set<Id>();
        for (const p of this.doc.pages) for (const i of p.items) if (i.kind === 'image') ids.add(i.assetId);
        await this.assets.images.ensure(ids);
        // Laying out every text box queues its formulas; wait for them and their images.
        for (const p of this.doc.pages) for (const i of p.items) if (i.kind === 'text') {
            const layout = this.assets.textLayout(i);
            for (const r of layout.runs) if (r.kind === 'math') this.assets.math(r.tex, r.display, i.color);
        }
        await this.assets.maths.whenIdle();
        for (const p of this.doc.pages) for (const i of p.items) if (i.kind === 'text') {
            for (const r of this.assets.textLayout(i).runs) if (r.kind === 'math') this.assets.math(r.tex, r.display, i.color);
        }
        await this.assets.maths.whenIdle();
    }

    async exportPdf(pages?: number[]) {
        try {
            await this.ready();
            const bytes = await exportPdf(this.doc, browserPdfDeps(this.assets, (id) => this.doc.assets[id]?.mime ?? 'image/png'), { dpi: this.store.getState().exportDpi, pages });
            const res = await this.platform.saveFile(`${safeFileName(this.doc.title)}.pdf`, new Blob([bytes], { type: 'application/pdf' }), 'pdf');
            if (res === 'saved') this.store.toast('PDF exported.');
        } catch (e) {
            this.error(e);
        }
    }

    async exportPng(pages?: number[]) {
        try {
            await this.ready();
            const list = pages ?? [this.page];
            const files = await exportPngs(this.doc, list, this.store.getState().exportDpi, this.assets);
            if (files.length === 1) {
                await this.platform.saveFile(files[0].name, files[0].blob, 'png');
            } else {
                const entries: Record<string, Uint8Array> = {};
                for (const f of files) entries[f.name] = new Uint8Array(await f.blob.arrayBuffer());
                await this.platform.saveFile(`${safeFileName(this.doc.title)} pages.zip`, new Blob([zipSync(entries, { level: 0 })], { type: 'application/zip' }), 'zip');
            }
        } catch (e) {
            this.error(e);
        }
    }

    async saveCheatsheet() {
        try {
            const assets: AssetBytes = new Map();
            for (const p of this.doc.pages) for (const i of p.items) {
                if (i.kind !== 'image' || assets.has(i.assetId)) continue;
                const bytes = await this.library.getAssetBytes(i.assetId);
                if (bytes) assets.set(i.assetId, { bytes, mime: this.doc.assets[i.assetId]?.mime ?? 'image/png' });
            }
            const zip = packCheatsheet(this.doc, assets);
            await this.platform.saveFile(`${safeFileName(this.doc.title)}.cheatsheet`, new Blob([zip], { type: 'application/zip' }), 'cheatsheet');
        } catch (e) {
            this.error(e);
        }
    }

    // Commands from shortcuts and menus

    run(c: Command) {
        const st = this.store.getState();
        if (c.kind === 'tool') return this.store.setTool(c.tool);
        if (c.kind === 'nudge') return this.nudge(c.dx, c.dy);
        switch (c.name) {
            case 'undo': return this.store.undo();
            case 'redo': return this.store.redo();
            case 'duplicate': return this.duplicateSelection();
            case 'delete': return this.deleteSelection();
            case 'selectAll': return this.selectAll();
            case 'forward': return this.reorder('forward');
            case 'backward': return this.reorder('backward');
            case 'toFront': return this.reorder('front');
            case 'toBack': return this.reorder('back');
            case 'exportPdf': return void this.exportPdf();
            case 'exportPng': return void this.exportPng();
            case 'importImage': return void this.platform.pickFiles('image/*', true).then((f) => this.importFiles(f));
            case 'importPdf': return void this.platform.pickFiles('application/pdf,.pdf', false).then((f) => this.importFiles(f));
            case 'saveFile': return void this.saveCheatsheet();
            case 'zoomIn': return this.zoomBy(1.2);
            case 'zoomOut': return this.zoomBy(1 / 1.2);
            case 'zoomReset': return this.zoomActual();
            case 'zoomFit': return this.zoomFit();
            case 'addPage': return this.addPage();
            case 'shortcuts': return this.store.openDialog('shortcuts');
            case 'crop': {
                const one = st.selection.length === 1 ? findItem(this.doc, st.selection[0])?.item : null;
                if (one?.kind === 'image' && !one.locked) this.store.setCrop(st.cropId ? null : one.id);
                return;
            }
            case 'escape':
                if (st.dialog) return this.store.openDialog(null);
                if (st.cropId) return this.store.setCrop(null);
                if (st.tool !== 'select') return this.store.setTool('select');
                return this.store.select([]);
        }
    }
}
```

`app/src/ui/editor/PdfImportDialog.tsx` behaviour (uses `Dialog` from Task 15, open when `state.dialog === 'pdf-import'` and `actions.pendingPdf` is set):
- Load pdf.js lazily: `const pdfjs = await import('pdfjs-dist'); pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;` then `pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise`. A `PasswordException` (`e.name === 'PasswordException'`) shows "This PDF is password protected. Remove the password and import it again."; any other failure shows "This file could not be read as a PDF." Nothing is added in either case.
- Left column: page thumbnails (render each page at 120 px wide on demand with `IntersectionObserver`), click to choose. Right: the chosen page rendered to fit the dialog width (`page.render({ canvas, viewport })` with `viewport = page.getViewport({ scale })`), with an overlay where pointer drags draw rectangles. Store rectangles in PDF points (`screen / scale`). Each rectangle has a small remove button; rectangles on other pages are kept and counted in the footer.
- Footer: DPI `Segmented` (150, 200, 300; bound to `pdfImportDpi`), "Add whole page", and "Add N regions" (disabled at 0).
- Adding: for every page with regions (or the current page for "whole page"), render at `dpi / 72` into a canvas, encode PNG with `canvasToBytes`, and call `actions.addImageRegions(png, { width: canvas.width, height: canvas.height }, regions, dpi)`. A whole page is one region `{ x: 0, y: 0, w: viewport.width / scale, h: viewport.height / scale }`. Close the dialog and clear `pendingPdf`, then toast "Added N regions. Use Layout, Auto-pack to tidy them."
- Clean up: `pdf.destroy()` on close.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: PASS. If `pdfjs-dist/build/pdf.worker.min.mjs?url` has no type, `vite/client` types cover `?url` imports.

- [ ] **Step 6: Commit**

```bash
git add app/src
git commit -m "feat(ui): import images, PDF regions and files; clipboard, layout and export actions"
```

---

### Task 20: Inspector, page setup and print check

**Files:**
- Create: `app/src/ui/editor/inspector/Inspector.tsx`, `ImagePanel.tsx`, `TextPanel.tsx`, `ShapePanel.tsx`, `StrokePanel.tsx`, `MultiPanel.tsx`, `PagePanel.tsx`, `ToolPanel.tsx`, `ArrangePanel.tsx`, `inspector.css`; `app/src/ui/editor/PrintCheck.tsx`; `app/src/ui/palette.ts`
- Test: `app/src/ui/editor/inspector/Inspector.test.tsx`

**Interfaces:**
- Consumes: store, `Actions`, primitives, `printCheck`, `PAGE_SIZES`, `FONT_LABELS`.
- Produces: `Inspector {actions}`; `PrintCheckDialog {actions}`; `INK_COLORS`, `HIGHLIGHTER_COLORS`, `FILL_COLORS` in `palette.ts`.

`palette.ts`:
```ts
export const INK_COLORS = ['#1b1d22', '#c92a2a', '#1971c2', '#2f9e44', '#e8590c', '#7048e8', '#868e96'];
export const HIGHLIGHTER_COLORS = ['#ffd43b80', '#8ce99a80', '#faa2c180', '#74c0fc80', '#ffc07880'];
export const FILL_COLORS = ['#fff3bf', '#d3f9d8', '#ffe3e3', '#d0ebff', '#f1f3f5'];
```

What each panel shows (every change goes through `store.apply(updateItems(...))`, so it is undoable; sliders use a gesture: `beginGesture` on pointerdown, `endGesture` on pointerup, so one drag is one undo step):
- `ToolPanel` (when a drawing tool is active and nothing is selected): pen colour and size (0.5 to 12), highlighter colour and size (4 to 32), shape stroke, width and fill, text font, size, colour and background. Writes `store.setOptions`.
- `ImagePanel`: Crop (toggles crop mode), Auto-trim, the filter controls (White to transparent slider 0 to 0.6 labelled "Remove white"; Invert toggle labelled "Invert (dark slides)"; Grayscale toggle; Contrast slider 0.5 to 2), Reset filters, and an effective DPI read-out with a warning colour under 150.
- `TextPanel`: font (`Segmented` of `FONT_LABELS`), size (`NumberField`, 4 to 72 pt), colour, background (`ColorSwatches` with `allowNone` and `FILL_COLORS` plus the highlighter yellow), alignment, padding. Changing font, size or padding also recomputes `h` with `assets.textHeight`.
- `ShapePanel`: stroke colour, stroke width (0 to 8), fill (rect and ellipse only).
- `StrokePanel`: colour and size.
- `MultiPanel` (more than one selected): count, align (six `IconButton`s), distribute (two, disabled under three items), Auto-pack selection (Arrange, Fit).
- `ArrangePanel` (any selection): X, Y, W, H in mm (display `pt * 25.4 / 72`, write back in points), rotation in degrees, lock toggle, layer order buttons, duplicate, delete.
- `PagePanel` (nothing selected and select tool): page size (`select` of `PAGE_SIZES` labels), orientation, margin (mm), columns (1 to 6), gutter (mm), grid (off, 5 mm, 10 mm), show guides toggle, pack gap (pt), Auto-pack buttons for the page.
- `PrintCheckDialog` (`dialog === 'print-check'`): runs `printCheck(doc)`; lists issues as rows "Page N: message" with a "Show" button that closes the dialog, scrolls to the page and selects the item; "No problems found: everything should print sharply." when empty; footer button "Actual size" (calls `actions.zoomActual()` and closes).

- [ ] **Step 1: Write failing tests**

`app/src/ui/editor/inspector/Inspector.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { Inspector } from './Inspector';
import { EditorStore, StoreContext } from '../../store';
import { EditorAssets } from '../../editorAssets';
import { Actions } from '../../actions';
import { MemoryLibrary } from '../../../storage/library';
import { webPlatform } from '../../../platform/web';
import { addItems } from '../../../model/commands';
import { createDocument, createImageItem, createTextItem } from '../../../model/factory';

function mount(selectKind: 'image' | 'text' | 'none') {
    const img = createImageItem({ id: 'a', mime: 'image/png', width: 100, height: 100 }, { x: 100, y: 100 }, 1e6, 1e6);
    const txt = createTextItem({ x: 0, y: 0 }, { font: 'sans', fontSize: 9, color: '#000', background: null, align: 'left' }, 100, 'hi');
    const store = new EditorStore(addItems(createDocument('t', 0), 0, [img, txt]));
    if (selectKind !== 'none') store.select([selectKind === 'image' ? img.id : txt.id]);
    const actions = new Actions(store, new EditorAssets(async () => null, () => {}), new MemoryLibrary(), webPlatform);
    render(<StoreContext.Provider value={store}><Inspector actions={actions} /></StoreContext.Provider>);
    return { store, img, txt };
}

test('image filters are undoable item changes', async () => {
    const { store, img } = mount('image');
    await userEvent.click(screen.getByRole('switch', { name: /Invert/ }));
    const out = store.doc.pages[0].items.find((i) => i.id === img.id)!;
    expect(out.kind === 'image' && out.filters.invert).toBe(true);
    store.undo();
    const back = store.doc.pages[0].items.find((i) => i.id === img.id)!;
    expect(back.kind === 'image' && back.filters.invert).toBe(false);
});

test('text font can be switched', async () => {
    const { store, txt } = mount('text');
    await userEvent.click(screen.getByRole('radio', { name: 'Narrow' }));
    expect(store.doc.pages[0].items.find((i) => i.id === txt.id)).toMatchObject({ font: 'narrow' });
});

test('with nothing selected the page setup shows', async () => {
    const { store } = mount('none');
    await userEvent.click(screen.getByRole('radio', { name: 'Landscape' }));
    expect(store.doc.setup.orientation).toBe('landscape');
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run app/src/ui/editor/inspector`
Expected: FAIL.

- [ ] **Step 3: Implement the panels as described, then run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src
git commit -m "feat(ui): inspector with image cleanup, text, shape and page setup, and print check"
```

---

### Task 21: Editor shell: top bar, tool rail, pages panel and phone layout

**Files:**
- Create: `app/src/ui/editor/EditorScreen.tsx`, `TopBar.tsx`, `ToolRail.tsx`, `PagesPanel.tsx`, `StatusIndicator.tsx`, `ShortcutsDialog.tsx`, `editor.css`; `app/src/ui/useMediaQuery.ts`
- Test: `app/src/ui/editor/EditorScreen.test.tsx`, `app/src/ui/editor/PagesPanel.test.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces: `EditorScreen {actions, assets, onOpenLibrary}`; `useMediaQuery(query): boolean`.

Layout (CSS grid on `.editor`):
- Desktop (`min-width: 720px`): rows `var(--bar-h) 1fr`; columns `56px 168px 1fr 288px` (rail, pages, canvas, inspector). Below 1100 px the pages column collapses to a toggleable overlay drawer.
- Phone (under 720 px): rows `var(--bar-h) 1fr auto`; the canvas fills the middle; the bottom bar holds the tools (select, pen, highlighter, eraser, text, a shapes popover, and a crop button when one image is selected) plus Pages and Inspect buttons that open bottom sheets (`Dialog` styled as a sheet, max 70vh).

`TopBar`:
- Left: library `IconButton` ("All cheatsheets"), an inline title `<input aria-label="Title">` (commits `setTitle` on blur or Enter).
- Middle: undo and redo `IconButton`s (disabled per `canUndo`/`canRedo`); then `MenuButton`s:
  - **Insert**: Images (Mod+O), Paste, Camera (only when `(pointer: coarse)`), From a PDF (Mod+Shift+O), Text box (sets text tool), New page (Mod+Enter).
  - **Layout**: Auto-pack (fill page), Auto-pack (keep sizes), separator, Align left, centre, right, top, middle, bottom, separator, Distribute horizontally, vertically, separator, Bring to front, Forward, Backward, Send to back.
  - **View**: Zoom in, Zoom out, Actual size, Fit width, Show guides (check).
  - **Export**: PDF (Mod+E), PNG of this page (Mod+Shift+E), PNG of all pages, Save .cheatsheet file (Mod+S), separator, Print check.
- Right: `StatusIndicator` (Saved, Saving, "Not saved" in `--danger` with the message as tooltip and a click that offers "Save a .cheatsheet file"), theme toggle (`IconButton` cycling system, light, dark; icon `sun` or `moon`), shortcuts `IconButton` (`?`).
- On phones, Insert, Layout, View and Export collapse into one `MenuButton` labelled "More".

`ToolRail`: vertical `IconButton`s with `pressed` for select, hand, pen, highlighter, eraser, text, rect, ellipse, line, arrow; tooltips include the shortcut letter.

`PagesPanel`: a list of `<li>` cards, each with a thumbnail canvas (page aspect ratio, 136 px wide, rendered with `drawPage` at the fitting scale, re-rendered when the page object or `renderTick` changes, debounced 150 ms), the page number, and a hover `MenuButton` (Duplicate, Delete, Move up, Move down). The current page has an accent outline. Cards are draggable (`draggable`, HTML5 drag and drop on desktop; on touch, long press 400 ms enters reorder mode with up and down buttons) and dropping calls `actions.movePage`. Clicking a card calls `actions.goToPage`. An "Add page" button sits under the list.

`EditorScreen` also:
- Registers a `window` `keydown` listener: skip when `isEditableTarget(e.target)` unless the key is Escape; `matchShortcut(e, isMac)`; if a command matches, `preventDefault` and `actions.run(cmd)`. `isMac` is `/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)`.
- Registers `copy`, `cut` and `paste` listeners on `document`: skip editable targets. On copy and cut with a selection, call `actions.copy()` or `actions.cut()`, put a marker `cheatsheet-maker:items` in `text/plain`, and `preventDefault`. On paste: if `clipboardData.files` has images, `actions.importFiles`; else if the text equals the marker, `actions.paste()`; else if there is text, `actions.pasteText(text)`.
- Handles `dragover` and `drop` on the canvas area: files are imported at the drop point (convert the client point to page coordinates with the viewport helpers); a drop highlight shows while dragging.
- Renders `Toasts`, `PdfImportDialog`, `PrintCheckDialog`, `ShortcutsDialog` (lists `SHORTCUT_LIST` with `Mod` shown as Ctrl or Cmd).
- Keeps `actions.viewport` in sync with the canvas size.

- [ ] **Step 1: Write failing tests**

`app/src/ui/editor/EditorScreen.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, expect, test, vi } from 'vitest';
import { EditorScreen } from './EditorScreen';
import { EditorStore, StoreContext } from '../store';
import { EditorAssets } from '../editorAssets';
import { Actions } from '../actions';
import { MemoryLibrary } from '../../storage/library';
import { webPlatform } from '../../platform/web';
import { createDocument } from '../../model/factory';

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
    window.matchMedia ??= ((q: string) => ({ matches: q.includes('min-width'), media: q, addEventListener() {}, removeEventListener() {} })) as never;
});

function mount() {
    const store = new EditorStore(createDocument('Physics', 0));
    const assets = new EditorAssets(async () => null, () => {});
    const actions = new Actions(store, assets, new MemoryLibrary(), webPlatform);
    const onOpenLibrary = vi.fn();
    render(<StoreContext.Provider value={store}><EditorScreen actions={actions} assets={assets} onOpenLibrary={onOpenLibrary} /></StoreContext.Provider>);
    return { store, actions, onOpenLibrary };
}

test('keyboard shortcuts switch tools and add pages', async () => {
    const { store } = mount();
    await userEvent.keyboard('p');
    expect(store.getState().tool).toBe('pen');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    expect(store.doc.pages).toHaveLength(2);
});

test('the title is editable and undoable', async () => {
    const { store } = mount();
    const title = screen.getByRole('textbox', { name: 'Title' });
    await userEvent.clear(title);
    await userEvent.type(title, 'Exam 2{Enter}');
    expect(store.doc.title).toBe('Exam 2');
});

test('the library button leaves the editor', async () => {
    const { onOpenLibrary } = mount();
    await userEvent.click(screen.getByRole('button', { name: 'All cheatsheets' }));
    expect(onOpenLibrary).toHaveBeenCalled();
});

test('the shortcut sheet opens with ?', async () => {
    mount();
    await userEvent.keyboard('?');
    expect(screen.getByRole('dialog', { name: /Keyboard shortcuts/ })).toBeInTheDocument();
});
```

jsdom's `<dialog>` lacks `showModal`; the `Dialog` component must feature-detect it and fall back to the `open` attribute, so this test works and old browsers still show dialogs.

`app/src/ui/editor/PagesPanel.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { PagesPanel } from './PagesPanel';
import { EditorStore, StoreContext } from '../store';
import { EditorAssets } from '../editorAssets';
import { Actions } from '../actions';
import { MemoryLibrary } from '../../storage/library';
import { webPlatform } from '../../platform/web';
import { addPage } from '../../model/commands';
import { createDocument } from '../../model/factory';

test('lists pages, adds one and moves one', async () => {
    const store = new EditorStore(addPage(createDocument('t', 0)));
    const assets = new EditorAssets(async () => null, () => {});
    const actions = new Actions(store, assets, new MemoryLibrary(), webPlatform);
    render(<StoreContext.Provider value={store}><PagesPanel actions={actions} assets={assets} /></StoreContext.Provider>);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    const firstId = store.doc.pages[0].id;
    await userEvent.click(screen.getAllByRole('button', { name: /Page 1 options/ })[0]);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move down' }));
    expect(store.doc.pages[1].id).toBe(firstId);
    await userEvent.click(screen.getByRole('button', { name: 'Add page' }));
    expect(store.doc.pages).toHaveLength(3);
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run app/src/ui/editor`
Expected: FAIL for the two new files.

- [ ] **Step 3: Implement the shell as described, then run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src
git commit -m "feat(ui): editor shell with menus, tool rail, page thumbnails and a phone layout"
```

---

### Task 22: Library screen and app wiring

**Files:**
- Create: `app/src/ui/library/LibraryScreen.tsx`, `app/src/ui/library/library.css`, `app/src/ui/thumbnail.ts`, `app/src/ui/prefs.ts`
- Modify: `app/src/ui/App.tsx`, `app/src/ui/App.test.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces: `App`; `LibraryScreen {library, onOpen(id), onNew(), onImport(files), legacyOffer: string | null, onImportLegacy(), onDismissLegacy()}`; `renderThumbnail(doc, assets): Promise<Blob | null>` (first page, 240 px wide, PNG); `Prefs` (`options`, `exportDpi`, `pdfImportDpi`, `packGap`, `showGuides`) with `loadPrefs(library)` and `savePrefs(library, prefs)` stored under the meta key `prefs`.

App flow:
1. On mount: `openLibrary()`; if not persistent, show an error toast with the reason and set the save status to error. Start `ensureFontsLoaded()` in parallel.
2. Load prefs. Read `lastDoc` meta; if it exists in the library open the editor on it, otherwise show the library (and if the library is empty, create "Untitled cheatsheet", store it and open it so a first-time visitor lands straight in the editor).
3. Editor mode: create `EditorStore(doc, prefs)`, `EditorAssets((id) => library.getAsset(id), () => { store.bumpRender(); syncTextHeights(...) })`, `Actions` (with `onOpenDocument` switching to the given doc). After fonts load: `assets.invalidateText()`, `syncTextHeights`, `store.bumpRender()`.
4. Autosave: `createAutosaver(async (doc) => { await library.put(doc, await renderThumbnail(doc, assets)); }, (s) => store.setSaveStatus(s))`; subscribe to the store and schedule when `history.present` changes by reference. Flush on `visibilitychange` to hidden, on `pagehide`, and before switching documents. Save `lastDoc` when a document opens. Save prefs (debounced 1 s) when options, DPIs, gap or guides change.
5. Library mode: `LibraryScreen` lists `library.list()` as cards (thumbnail or a blank page shape, title, "Edited" relative time with `Intl.RelativeTimeFormat`, page count). Card menu: Open, Rename (inline input), Duplicate (`importDocument` of the stored doc with " copy" appended), Export .cheatsheet, Delete (inline confirm row: "Delete this cheatsheet? This cannot be undone." with Delete and Cancel buttons; no `window.confirm`). Header: product name in `--font-display` with the icon, "New cheatsheet" primary button, "Open file" button (`.cheatsheet`, `.json`), theme toggle. Dropping files on the library imports them.
6. Legacy offer: if `platform.readLegacyAutosave()` returns text and meta `legacyOffered` is not set, the library shows a banner: "Found a cheatsheet from the old Linux app." with "Import it" and "Not now" (both set `legacyOffered`).

- [ ] **Step 1: Replace the App test**

`app/src/ui/App.test.tsx`:
```tsx
// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, expect, test } from 'vitest';
import { App } from './App';

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
    window.matchMedia ??= ((q: string) => ({ matches: q.includes('min-width'), media: q, addEventListener() {}, removeEventListener() {} })) as never;
});

test('a first visit lands in a new cheatsheet and the library lists it', async () => {
    render(<App />);
    const title = await screen.findByRole('textbox', { name: 'Title' });
    expect(title).toHaveValue('Untitled cheatsheet');
    await userEvent.click(screen.getByRole('button', { name: 'All cheatsheets' }));
    expect(await screen.findByRole('heading', { name: 'Cheatsheet Maker' })).toBeInTheDocument();
    expect(await screen.findByText('Untitled cheatsheet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New cheatsheet' }));
    expect(await screen.findByRole('textbox', { name: 'Title' })).toHaveValue('Untitled cheatsheet');
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run app/src/ui/App.test.tsx`
Expected: FAIL (the App still renders only a heading).

- [ ] **Step 3: Implement `thumbnail.ts`, `prefs.ts`, `LibraryScreen` and the new `App` as described, then run everything**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: PASS and a production build.

- [ ] **Step 4: Drive the app in a browser**

Run `npm run dev` in the background and use the Playwright MCP browser at `http://localhost:5173`:
1. Paste an image (use `browser_run_code_unsafe` to dispatch a `paste` event with a PNG `File` in a `DataTransfer`), move it, resize it from a corner, rotate it with Shift held, crop it (double-click, drag the east handle), undo twice, redo once.
2. Draw with the pen and highlighter, erase one stroke.
3. Add a text box with `**Bayes** $P(A|B) = \frac{P(B|A)P(A)}{P(A)}$` and check the formula renders.
4. Add a rectangle and an arrow; Auto-pack (fill page).
5. Switch theme; resize to 390 x 844 and check the phone layout (bottom tools, sheets).
6. Reload: the document comes back.
Take a screenshot of each state and look at it. Fix anything broken before committing.

- [ ] **Step 5: Commit**

```bash
git add app/src
git commit -m "feat(ui): library screen, autosave and app wiring"
```

---
## Phase E: Distribution, website and repository

### Task 23: Installable web app (PWA)

**Files:**
- Modify: `app/vite.config.ts`, `app/src/main.tsx`, `app/src/ui/App.tsx`, `app/package.json` (scripts)
- Create: `app/src/pwa.ts`
- Test: covered by the offline test in Task 26; this task verifies the manifest and service worker by build output.

**Interfaces:**
- Produces: npm scripts `dev:tauri` (`vite --mode tauri`), `build:tauri` (`tsc --noEmit -p . && vite build --mode tauri`), `build:e2e` (`vite build --mode e2e`); `registerPwa(onUpdate: (reload: () => void) => void): void` in `pwa.ts`; a `launchQueue` consumer in `App` that imports `.cheatsheet` files opened from the OS on Chromium desktop.

- [ ] **Step 1: Configure vite-plugin-pwa**

`app/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig(({ mode }) => ({
    base: './',
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    server: { port: 5173, strictPort: true, fs: { allow: ['..'] } },
    build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 2500 },
    plugins: [
        react(),
        mode !== 'tauri' &&
            VitePWA({
                registerType: 'prompt',
                injectRegister: null,
                includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
                manifest: {
                    id: './',
                    name: 'Cheatsheet Maker',
                    short_name: 'Cheatsheet',
                    description: 'Turn screenshots, lecture slides, notes and formulas into a dense, printable cheatsheet.',
                    start_url: './',
                    scope: './',
                    display: 'standalone',
                    background_color: '#f6f4ee',
                    theme_color: '#f6f4ee',
                    categories: ['education', 'productivity'],
                    icons: [
                        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                        { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                        { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
                    ],
                    file_handlers: [{ action: './', accept: { 'application/x-cheatsheet': ['.cheatsheet'] } }],
                },
                workbox: {
                    globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'],
                    maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
                    navigateFallback: 'index.html',
                    cleanupOutdatedCaches: true,
                },
            }),
    ],
}));
```

Add `declare const __APP_VERSION__: string;` to `app/src/vite-env.d.ts`, plus `/// <reference types="vite-plugin-pwa/client" />`.

- [ ] **Step 2: Register with an update prompt**

`app/src/pwa.ts`:
```ts
import { isTauri } from './platform';

/** Registers the service worker on the web; `onUpdate` gets a function that activates the new version. */
export function registerPwa(onUpdate: (reload: () => void) => void): void {
    if (isTauri() || !('serviceWorker' in navigator) || !import.meta.env.PROD) return;
    void import('virtual:pwa-register').then(({ registerSW }) => {
        const update = registerSW({
            onNeedRefresh: () => onUpdate(() => void update(true)),
        });
    });
}
```

In `App`, after the store exists, call `registerPwa((reload) => store.toast('A new version of Cheatsheet Maker is ready.', 'info', { label: 'Reload', run: reload }))`. Also in `App`:
```ts
const lq = (window as unknown as { launchQueue?: { setConsumer(cb: (p: { files: Array<{ getFile(): Promise<File> }> }) => void): void } }).launchQueue;
lq?.setConsumer(async (p) => actions.importFiles(await Promise.all(p.files.map((f) => f.getFile()))));
```
In e2e mode only (`import.meta.env.MODE === 'e2e'`), expose `window.__cm = { store, actions }` for the Playwright suite.

- [ ] **Step 3: Build and check the output**

Run: `npm run build -w app && ls app/dist && cat app/dist/manifest.webmanifest`
Expected: `sw.js`, `manifest.webmanifest`, icons; the manifest has the name, icons and the file handler. Run `npm run build:tauri -w app` and confirm `app/dist/sw.js` is absent.

- [ ] **Step 4: Commit**

```bash
git add app
git commit -m "feat(pwa): installable offline web app with an update prompt and file handling"
```

---

### Task 24: Tauri desktop shell

**Files:**
- Create: `Cargo.toml` (workspace), `app/src-tauri/{Cargo.toml, build.rs, tauri.conf.json, tauri.windows.conf.json, capabilities/default.json, src/main.rs, src/lib.rs, cheatsheet-maker.desktop}`, `app/src-tauri/icons/*` (generated)
- Test: Rust unit test in `app/src-tauri/src/lib.rs`

**Interfaces:**
- Produces: Tauri command `legacy_autosave() -> Option<String>`; `npm run tauri -- dev` and `npm run tauri -- build`.

- [ ] **Step 1: Write the Rust workspace and crate**

`Cargo.toml`:
```toml
[workspace]
members = ["app/src-tauri"]
resolver = "2"

[workspace.package]
version = "1.0.0"
edition = "2021"
license = "MIT"
authors = ["Daniel Tyukov"]
repository = "https://github.com/danieltyukov/cheatsheet-maker"

[profile.release]
codegen-units = 1
lto = true
opt-level = "s"
strip = true
```

`app/src-tauri/Cargo.toml`:
```toml
[package]
name = "cheatsheet-maker"
description = "Make dense, printable cheatsheets from screenshots, slides, notes and formulas"
version.workspace = true
edition.workspace = true
license.workspace = true
authors.workspace = true
repository.workspace = true

[lib]
name = "cheatsheet_maker_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
```

`app/src-tauri/build.rs`:
```rust
fn main() {
    tauri_build::build()
}
```

`app/src-tauri/src/main.rs`:
```rust
// Hide the console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    cheatsheet_maker_lib::run()
}
```

`app/src-tauri/src/lib.rs`:
```rust
use std::path::Path;
use tauri::Manager;

/// The GTK version kept its work in `<config dir>/cheatsheet-maker/autosave.json`.
fn read_legacy_autosave(config_dir: &Path) -> Option<String> {
    std::fs::read_to_string(config_dir.join("cheatsheet-maker").join("autosave.json")).ok()
}

#[tauri::command]
fn legacy_autosave(app: tauri::AppHandle) -> Option<String> {
    read_legacy_autosave(&app.path().config_dir().ok()?)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![legacy_autosave])
        .run(tauri::generate_context!())
        .expect("Cheatsheet Maker failed to start");
}

#[cfg(test)]
mod tests {
    use super::read_legacy_autosave;

    #[test]
    fn reads_the_gtk_autosave_when_present() {
        let dir = std::env::temp_dir().join(format!("cm-legacy-{}", std::process::id()));
        assert_eq!(read_legacy_autosave(&dir), None);
        std::fs::create_dir_all(dir.join("cheatsheet-maker")).unwrap();
        std::fs::write(dir.join("cheatsheet-maker").join("autosave.json"), "{\"pages\":[]}").unwrap();
        assert_eq!(read_legacy_autosave(&dir).as_deref(), Some("{\"pages\":[]}"));
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
```

- [ ] **Step 2: Write the Tauri configuration**

`app/src-tauri/tauri.conf.json`:
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Cheatsheet Maker",
  "mainBinaryName": "cheatsheet-maker",
  "version": "1.0.0",
  "identifier": "io.github.danieltyukov.CheatsheetMaker",
  "build": {
    "beforeDevCommand": "npm run dev:tauri",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "npm run build:tauri",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Cheatsheet Maker",
        "width": 1280,
        "height": 860,
        "minWidth": 360,
        "minHeight": 480,
        "dragDropEnabled": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; worker-src 'self' blob:; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' ipc: http://ipc.localhost"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "category": "Education",
    "shortDescription": "Make dense, printable cheatsheets",
    "longDescription": "Paste screenshots, crop regions out of lecture PDFs, type notes and formulas, draw and highlight, auto-pack everything onto the page and export a PDF.",
    "copyright": "Copyright (c) 2026 Daniel Tyukov. MIT licence.",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"],
    "linux": {
      "deb": { "section": "education" }
    }
  }
}
```

`dragDropEnabled: false` lets HTML drag and drop reach the web page (Tauri otherwise intercepts file drops, and WebView2 requires it off for HTML drops).

`app/src-tauri/tauri.windows.conf.json`:
```json
{
  "bundle": {
    "windows": {
      "nsis": { "installMode": "currentUser" },
      "webviewInstallMode": { "type": "downloadBootstrapper" }
    }
  }
}
```

`app/src-tauri/capabilities/default.json`:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "What the main window may do: native save and open dialogs, and writing the file the user picked.",
  "windows": ["main"],
  "permissions": ["core:default", "dialog:allow-save", "dialog:allow-open", "fs:allow-write-file"]
}
```

The dialog plugin adds the path the user picked to the fs scope, so `fs:allow-write-file` needs no broader scope. Verify this in Step 5; if the write is refused, add a scoped permission `{ "identifier": "fs:allow-write-file", "allow": [{ "path": "$HOME/**" }, { "path": "$DOWNLOAD/**" }, { "path": "$DOCUMENT/**" }, { "path": "$DESKTOP/**" }] }` instead of the bare one.

- [ ] **Step 3: Generate icons**

Run: `node scripts/render-icons.mjs && cd app && npx tauri icon src-tauri/icon-1024.png && cd ..`
Expected: `app/src-tauri/icons/` holds `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`, `icon.png`, the Square logos and `android/` and `ios/` sets. Delete `app/src-tauri/icons/ios` (no iOS build) and keep the rest.

- [ ] **Step 4: Rust tests, format and lint**

Run: `cargo fmt --all --check && cargo clippy -p cheatsheet-maker --all-targets -- -D warnings && cargo test -p cheatsheet-maker`
Expected: clean; one test passes.

- [ ] **Step 5: Build and run on Linux**

Run: `npm run tauri -- build --bundles deb,appimage`
Expected: `target/release/bundle/deb/*.deb` and `target/release/bundle/appimage/*.AppImage`.

Run the AppImage, then check by hand (screenshot each step with the system screenshot tool or `xdotool`/`import` and look at it):
1. The window opens on a new cheatsheet with the new icon in the dock.
2. Drag an image file from the file manager onto the canvas: it appears.
3. Export PDF: the native save dialog opens, the file is written, and it opens in a PDF viewer with the right content.
4. Save a `.cheatsheet` file and open it again from the library.
5. With `~/.config/cheatsheet-maker/autosave.json` present (it is on this machine if the GTK app was used; otherwise copy the Task 7 fixture there), the library offers to import it.

- [ ] **Step 6: Commit**

```bash
git add Cargo.toml Cargo.lock app/src-tauri app/package.json scripts
git commit -m "feat(desktop): Tauri shell with native save dialogs and GTK autosave import"
```

---

### Task 25: Android build

**Files:**
- Create: `app/src-tauri/gen/android/**` (generated by `tauri android init`), `app/src-tauri/capabilities/mobile.json` if the Android build needs different permissions
- Modify: `.gitignore` (Android build outputs), `app/src-tauri/gen/android/app/build.gradle.kts` (release signing from `keystore.properties` when present)

**Interfaces:**
- Produces: `npx tauri android build --apk` output and a documented signing setup through `keystore.properties`, matching owl-transfer's release job (secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`).

- [ ] **Step 1: Initialise**

Run: `cd app && NDK_HOME=$ANDROID_HOME/ndk/28.2.13676358 npx tauri android init && cd ..`
Expected: `app/src-tauri/gen/android/` exists. Add to `.gitignore`: `app/src-tauri/gen/android/app/build/`, `app/src-tauri/gen/android/.gradle/`, `app/src-tauri/gen/android/buildSrc/build/`, `app/src-tauri/gen/android/keystore.properties`, `*.jks`.

- [ ] **Step 2: Release signing that is optional**

In `app/src-tauri/gen/android/app/build.gradle.kts`, load `keystore.properties` from the Android project root when it exists and use it for the `release` signing config (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`); when it does not exist, leave release unsigned so forks can still build. Copy the pattern from `/tmp/.../survey/owl-transfer/app/src-tauri/gen/android/app/build.gradle.kts` if it is still in the scratchpad, otherwise write it:
```kotlin
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = java.util.Properties()
if (keystorePropertiesFile.exists()) keystoreProperties.load(java.io.FileInputStream(keystorePropertiesFile))

android {
    signingConfigs {
        if (keystorePropertiesFile.exists()) {
            create("release") {
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
            }
        }
    }
    buildTypes {
        getByName("release") {
            if (keystorePropertiesFile.exists()) signingConfig = signingConfigs.getByName("release")
        }
    }
}
```
Merge these blocks into the generated file's existing `android { ... }` rather than adding a second one.

- [ ] **Step 3: Build a debug APK and run it on the emulator**

Run: `cd app && NDK_HOME=$ANDROID_HOME/ndk/28.2.13676358 npx tauri android build --apk --debug --target x86_64 && cd ..`
Expected: an APK under `app/src-tauri/gen/android/app/build/outputs/apk/`.

With the android MCP tools: `list_avds`, `boot_emulator`, `install_app` with the APK, `launch_app` (`io.github.danieltyukov.CheatsheetMaker`), then `screenshot` and check:
1. The editor shows the phone layout with tools along the bottom.
2. Draw with a swipe in pen mode; a stroke appears.
3. Insert, Images opens the Android file picker (`<input type="file">`). If the picker does not open, the WebView lacks a file chooser: record it and use `@tauri-apps/plugin-dialog`'s `open()` plus `@tauri-apps/plugin-fs`'s `readFile()` for `pickFiles` on Android in `platform/tauri.ts`.
4. Export, PDF: the save dialog appears and a file is written (check with `adb shell ls /sdcard/Download` or the picked location). If the save dialog is unsupported, fall back in `platform/tauri.ts` to writing into the Downloads directory with `writeFile(name, bytes, { baseDir: BaseDirectory.Download })` and toast the location; add `fs:allow-download-write` to a mobile capability.
5. Rotate the emulator; the layout adapts.
Fix whatever fails, rebuild, repeat.

- [ ] **Step 4: Commit**

```bash
git add .gitignore app/src-tauri
git commit -m "feat(android): Tauri Android project with optional release signing"
```

---

### Task 26: End-to-end tests

**Files:**
- Create: `app/playwright.config.ts`, `app/e2e/helpers.ts`, `app/e2e/editor.spec.ts`, `app/e2e/import-export.spec.ts`, `app/e2e/offline.spec.ts`, `app/e2e/phone.spec.ts`, `app/e2e/fixtures/{photo.png, slides.pdf, legacy-autosave.json}`, `app/e2e/make-fixtures.mjs`
- Modify: `app/package.json` (`"e2e": "playwright test"`)

**Interfaces:**
- Consumes: `window.__cm` (e2e builds only, Task 23).

- [ ] **Step 1: Fixtures**

`app/e2e/make-fixtures.mjs` writes `photo.png` (a 600 x 400 PNG with a white border and a dark block in the middle, made with `pdf-lib`-free raw PNG encoding through `node:zlib`) and `slides.pdf` (two pages made with `pdf-lib`: page 1 has the text "Fourier transform" and a filled rectangle, page 2 says "Page two"). Copy `app/src/test/fixtures/legacy-autosave.json` into `app/e2e/fixtures/`. Run it once and commit the outputs so CI does not need to regenerate them.

- [ ] **Step 2: Config**

`app/playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 60_000,
    fullyParallel: true,
    retries: process.env.CI ? 1 : 0,
    use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
    webServer: {
        command: 'npm run build:e2e && npm run preview',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } }, testIgnore: /phone/ },
        { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /phone/ },
    ],
});
```

- [ ] **Step 3: Helpers**

`app/e2e/helpers.ts`:
```ts
import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

export const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url).pathname;

/** Fresh app, no saved documents, downloads instead of the save picker. */
export async function openApp(page: Page) {
    await page.addInitScript(() => {
        (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = undefined;
    });
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible();
}

export async function pasteImage(page: Page, file = 'photo.png') {
    const b64 = readFileSync(fixture(file)).toString('base64');
    await page.evaluate(async (data) => {
        const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        const dt = new DataTransfer();
        dt.items.add(new File([bytes], 'shot.png', { type: 'image/png' }));
        document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    }, b64);
}

export const items = (page: Page) =>
    page.evaluate(() => (window as unknown as { __cm: { store: { doc: { pages: Array<{ items: Array<{ kind: string; x: number; y: number; w: number; h: number; text?: string }> }> } } } }).__cm.store.doc.pages.map((p) => p.items));

/** Screen position of a point in page 0 coordinates. */
export async function screenOf(page: Page, x: number, y: number) {
    return page.evaluate(([px, py]) => {
        const cm = (window as unknown as { __cm: { store: { getState(): { view: { zoom: number; scrollX: number; scrollY: number } } } } }).__cm;
        const v = cm.store.getState().view;
        const r = document.querySelector('.canvas-wrap canvas')!.getBoundingClientRect();
        return { x: r.left + (px - v.scrollX) * v.zoom, y: r.top + (py - v.scrollY) * v.zoom };
    }, [x, y]);
}
```

- [ ] **Step 4: Editor tests**

`app/e2e/editor.spec.ts` covers, each as its own `test`:
1. Paste an image: one image item, selected.
2. Drag it by its centre 100 px right: `x` grows by about `100 / zoom`; Mod+Z restores it; Mod+Shift+Z redoes.
3. Double-click it to crop; drag the east crop handle left 80 px; the item's `w` and its `crop.w` both shrink and stay in the same ratio.
4. Pen: press `p`, draw a polyline with `page.mouse`; a `stroke` item appears. Press `e`, drag across it; it is gone.
5. Text with math: press `t`, click the page, type `**Bayes** $P(A|B)$`, press Escape; a `text` item with that text exists and its `h` is larger than one line once the math has rendered (`expect.poll`).
6. Auto-pack: paste three images, open Layout, choose "Auto-pack (fill page)"; all three are inside the printable area and do not overlap (compute in the test from the item boxes).
7. Reload: the document and its items come back from IndexedDB.

`app/e2e/import-export.spec.ts`:
1. Insert, From a PDF, choose `slides.pdf` (`page.setInputFiles` on the file chooser via `page.waitForEvent('filechooser')`); the dialog shows two thumbnails; drag a box on page 1; "Add 1 region"; one image item whose crop is a sub-rectangle of the page raster.
2. A password-protected PDF (made in `make-fixtures.mjs` with `qpdf` if available; skip with `test.skip` when the fixture is missing) shows the password message and adds nothing.
3. Export PDF: `page.waitForEvent('download')`, read the file, load it with `pdf-lib` in Node, check the page count equals the document's and the page size is A4.
4. Save a `.cheatsheet` (download), then from the library "Open file" choose it: a second document with the same items opens.
5. Library "Open file" with `legacy-autosave.json`: a document with an image and a stroke opens.

`app/e2e/offline.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test('loads offline after the first visit', async ({ page, context }) => {
    await openApp(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible();
    await context.setOffline(false);
});
```

`app/e2e/phone.spec.ts`: the bottom tool bar is visible and the tool rail is not; tap the pen tool and draw with `page.touchscreen` (or `page.mouse` with `hasTouch`) to create a stroke; "Inspect" opens a sheet; the page has no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`).

- [ ] **Step 5: Run**

Run: `npx playwright install chromium && npm run e2e -w app`
Expected: all tests pass in both projects. Fix the app (not the tests) when behaviour is wrong.

- [ ] **Step 6: Commit**

```bash
git add app/e2e app/playwright.config.ts app/package.json
git commit -m "test(e2e): Playwright coverage for editing, import, export, offline and phones"
```

---

### Task 27: Project website and screenshots

**Files:**
- Create: `site/package.json`, `site/vite.config.ts`, `site/index.html`, `site/privacy.html`, `site/style.css`, `site/main.js`, `site/og.svg`, `site/public/{favicon.svg, apple-touch-icon.png, og.png}`, `site/playwright.config.ts`, `site/e2e/site.spec.ts`, `scripts/screenshots.mjs`, `docs/img/{editor-light.webp, editor-dark.webp, phone.webp, phone-dark.webp}`
- Modify: root `package.json` (`typecheck` stays app-only; add `"site": "npm run dev -w site"`), `scripts/render-icons.mjs` (also render `site/public/og.png` from `site/og.svg` at 1200 x 630 and copy the favicon and apple-touch icon)

**Interfaces:**
- Produces: `npm run build -w site` writes `site/dist`; the Pages workflow (Task 28) copies `app/dist` into `site/dist/app`.

- [ ] **Step 1: Screenshots**

`scripts/screenshots.mjs` uses Playwright against `vite preview` of the e2e build: builds a demo document through `window.__cm` (a title "Signals and Systems, final exam"; a few images made from `app/e2e/fixtures` and from small SVG diagrams rendered to PNG; text boxes with formulas such as `$$X(f) = \int_{-\infty}^{\infty} x(t)\,e^{-j2\pi ft}\,dt$$`, a bullet list of definitions, a highlighter stroke and an arrow), auto-packs it, and captures the editor at 1440 x 900 in light and dark and the phone layout at 390 x 844 in light and dark. Converts PNG to WebP with `npx sharp-cli` or `cwebp` if installed, otherwise keeps PNG and adjusts the references. Look at every image before using it.

- [ ] **Step 2: The site**

`site/package.json`:
```json
{
  "name": "@cheatsheet-maker/site",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 4174 --strictPort",
    "e2e": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.63.0",
    "vite": "^8.3.2"
  }
}
```

`site/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
    base: './',
    server: { fs: { allow: ['..'] } },
    build: { rollupOptions: { input: { index: resolve(__dirname, 'index.html'), privacy: resolve(__dirname, 'privacy.html') } } },
});
```

`site/style.css` starts with `@import '../app/src/tokens.css';` and imports the fonts from `../node_modules/@fontsource-variable/...` the same way `main.tsx` does (through `main.js` `import` statements so Vite bundles them). Before writing the page, load the `artifact-design` skill only if publishing an artifact; for the site itself follow the `frontend-design` direction chosen in Task 15.

`site/index.html` sections, in order, plain second-person copy, no emojis, no em dashes:
1. Header: icon, "Cheatsheet Maker", nav (Features, Install, Privacy, GitHub), theme toggle button with `aria-pressed`.
2. Hero: an eyebrow "Free and open source", the h1 "Every formula, slide and screenshot you need, on one printable page.", a short paragraph, primary button "Open the web app" (`./app/`) and secondary "Download" whose label and link follow the visitor's OS (`main.js` reads `navigator.userAgentData?.platform ?? navigator.platform`; Windows to `CheatsheetMaker_x64-setup.exe`, macOS to `CheatsheetMaker_universal.dmg`, Linux to `cheatsheet-maker_x86_64.AppImage`, Android to `cheatsheet-maker.apk`, iOS to an anchor explaining Add to Home Screen; all through `https://github.com/danieltyukov/cheatsheet-maker/releases/latest/download/<name>`). Below: the editor screenshot in a `<picture>` with light and dark sources.
3. Features, each a short heading plus two sentences: Paste and crop; Lecture slides to sheet (PDF regions); Formulas that typeset (LaTeX); Auto-pack; Ink saver (white to transparent, invert dark slides, auto-trim); Print check; Draw and highlight; Works everywhere (web, desktop, Android, offline).
4. How it works: three numbered steps (collect, arrange, export).
5. Install: one block per platform with the exact file names and the honest notes (unsigned Windows installer, SmartScreen "More info, Run anyway"; unnotarised macOS build, right-click Open or System Settings, Open Anyway; AppImage `chmod +x`; deb with `sudo apt install ./cheatsheet-maker_amd64.deb`; Android allow installs from your browser once; iPhone and iPad: open the web app in Safari, Share, Add to Home Screen).
6. Privacy: "Your sheets never leave your device." Everything is stored in the browser or app storage on your device; no account, no server, no analytics, no cookies.
7. FAQ: file format, moving work between devices (save a `.cheatsheet` file), printing tips, the old Linux version (import its autosave), contributing.
8. Footer: GitHub link, MIT, Privacy, font licence note ("Fonts: Atkinson Hyperlegible Next, Archivo Narrow, Source Serif 4, JetBrains Mono and Bricolage Grotesque, all under the SIL Open Font License."), "No third-party requests, no cookies."

`site/privacy.html`: the same privacy statement in full, including what the native apps can access (files you pick, and on Linux the old autosave file it offers to import).

`site/og.svg`: 1200 x 630, accent yellow left panel with the icon mark, ink headline "Cheatsheet Maker" and the tagline on paper colour.

- [ ] **Step 3: Site test**

`site/e2e/site.spec.ts` (with `site/playwright.config.ts` serving `npm run build && npm run preview` on port 4174): the hero heading is visible; "Open the web app" links to `./app/`; the theme toggle flips `data-theme` and `aria-pressed`; no horizontal scroll at 390 px; every internal link resolves (privacy page loads).

Run: `npm run build -w site && npm run e2e -w site`
Expected: PASS. Open the built site with the Playwright MCP browser at desktop and phone widths, in both themes, and look at it.

- [ ] **Step 4: Commit**

```bash
git add site docs/img scripts package.json
git commit -m "docs(site): project website with install instructions and screenshots"
```

---

### Task 28: Repository files, CI, Pages and releases

**Files:**
- Create: `LICENSE`, `README.md` (replace), `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `PRIVACY.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/FILE-FORMAT.md`, `.github/ISSUE_TEMPLATE/{bug.yml, feature.yml, config.yml}`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/CODEOWNERS`, `.github/dependabot.yml`, `.github/workflows/{ci.yml, pages.yml, release.yml}`, `scripts/check-version.sh`, `scripts/release-notes.sh`

- [ ] **Step 1: Licence and community files**

`LICENSE`: the MIT licence text exactly, with `Copyright (c) 2026 Daniel Tyukov`. Nothing else in the file (font notices live in the README and site footer).

`CODE_OF_CONDUCT.md`: Contributor Covenant 2.1, with enforcement contact "the maintainer through a private message on GitHub (https://github.com/danieltyukov)". Take the text from `survey/screen-side-switcher/CODE_OF_CONDUCT.md` in the scratchpad if present, changing only the project name and contact.

`SECURITY.md`: "## Reporting a vulnerability" (use GitHub's private advisory form at `https://github.com/danieltyukov/cheatsheet-maker/security/advisories/new`; expect a reply within a week) and "## Scope" (the app has no server; relevant issues are malicious `.cheatsheet` or PDF files that run code or escape the file the user picked, the Tauri capabilities, and the release pipeline; unsigned Windows and macOS builds and unsigned fork APKs are known and documented).

`PRIVACY.md`: same content as `site/privacy.html` in Markdown.

`CONTRIBUTING.md`: setup (`npm install`, `npm run dev`, `npm test`, `npm run e2e -w app`, `npm run tauri -- dev`, Android with `NDK_HOME`), where things live (point to `docs/ARCHITECTURE.md`), rules (model code stays DOM-free and gets unit tests; UI behaviour gets a Testing Library or Playwright test; no emojis and no em or en dashes; conventional commits; "Describe the change and why it is right, not the process that produced it"; a CHANGELOG line under Unreleased when a person would notice).

`CLAUDE.md`:
```markdown
# Cheatsheet Maker

TypeScript editor for printable cheatsheets, shipped as a PWA and as Tauri builds (Windows, macOS, Linux, Android).

Read `docs/ARCHITECTURE.md` first. Specs and plans live in `docs/superpowers/`.

## Commands

    npm install
    npm run dev              # web app on :5173
    npm test                 # Vitest: model, render, storage, UI
    npm run typecheck
    npm run e2e -w app       # Playwright against the built PWA
    npm run tauri -- dev     # desktop shell
    cargo test -p cheatsheet-maker

## Conventions

- `app/src/model` has no DOM access and every rule there has a unit test.
- One renderer (`render/drawPage.ts`) for screen, thumbnails and export; do not fork it.
- No emojis and no em or en dashes in code, docs, UI text or commits.
- Conventional commits; no AI attribution, session links or co-author trailers.
```

- [ ] **Step 2: Architecture and file format docs**

`docs/ARCHITECTURE.md`: the layer diagram (model, render, storage, platform, ui), the data flow of an edit (gesture, command, history, autosave, render), the asset store and why it is content addressed, how export reuses the renderer, how PWA and Tauri builds differ (`--mode tauri`), and the testing layers.

`docs/FILE-FORMAT.md`: the `.cheatsheet` zip layout, `document.json` field by field (every type from Task 2 with units: points, degrees, source pixels), asset naming, versioning rules (readers reject newer versions; writers bump the version for any incompatible change), and the legacy `autosave.json` mapping.

- [ ] **Step 3: README**

`README.md` in the owl-transfer shape, plain second person, no badges:
```markdown
<p align="center">
  <img src="app/icon-source.svg" width="128" alt="The Cheatsheet Maker icon: a sheet of paper outlined in ink, filled with packed dark tiles and crossed by a yellow highlighter stroke, on a yellow background.">
</p>

<h1 align="center">Cheatsheet Maker</h1>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/img/editor-dark.webp">
  <img src="docs/img/editor-light.webp" alt="...describe the screenshot in one full sentence...">
</picture>
```
followed by: a two-paragraph introduction (what it does; local-first, no account); `Project site: <https://danieltyukov.github.io/cheatsheet-maker/>`; `## What it is` (features in prose and a short list, the phone screenshot at width 300); `## Install` (releases link, then **Web.**, **Windows.**, **macOS.**, **Linux.**, **Android.**, **iPhone and iPad.** paragraphs with the exact file names and caveats from Task 27); `## First sheet` (numbered: paste or import, arrange or auto-pack, print check, export); `## Keyboard shortcuts` (a table from `SHORTCUT_LIST`); `## Coming from the old Linux version` (tag `v0-gtk`, autosave import); `## Build from source` (Node 22, Rust stable, the Tauri Linux packages `libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`, Android SDK and NDK); `## Repository layout` (4-space indented tree); `## Documentation` (bullets "`docs/X.md`, what it covers"); `## Licence` ("MIT, in `LICENSE`." plus the font OFL note). Code fences carry no language tag. Every screenshot reference must exist.

- [ ] **Step 4: CHANGELOG and version scripts**

`CHANGELOG.md`:
```markdown
# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-10-04

### Added

- Rewritten as a TypeScript app that runs in the browser, installs as a PWA and ships as native builds for Windows, macOS, Linux and Android.
- Text boxes with Markdown and LaTeX math; highlighter, eraser, rectangles, ellipses, lines and arrows.
- PDF import: pick regions from lecture slides and keep the crop editable.
- Auto-pack (arrange or fit to page), snap guides, grid, rotation, multi-select, align, distribute and layer order.
- Page size, orientation, margins and column guides; a page sidebar with drag to reorder.
- Image cleanup: remove white, invert, grayscale, contrast and auto-trim.
- PNG export, a print check and an actual-size view.
- A library of cheatsheets stored on the device, `.cheatsheet` files and import of the old autosave.

### Removed

- The GTK3 C application. It is still available at the `v0-gtk` tag.
```

`scripts/check-version.sh` (POSIX sh, versions in `Cargo.toml` `[workspace.package]`, `app/package.json`, `site/package.json`, `app/src-tauri/tauri.conf.json` must agree; with a tag argument, the tag must match):
```sh
#!/bin/sh
# Checks that every place that carries the version agrees, and, given a tag,
# that the tag names that version.
#
#   scripts/check-version.sh [v1.0.0]
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
json_version() { sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$1" | head -n 1; }

cargo=$(sed -n 's/^version = "\([^"]*\)"/\1/p' "$root/Cargo.toml" | head -n 1)
status=0
for file in app/package.json site/package.json app/src-tauri/tauri.conf.json; do
  version=$(json_version "$root/$file")
  if [ "$version" != "$cargo" ]; then
    echo "$file says $version but Cargo.toml says $cargo" >&2
    status=1
  fi
done

if [ $# -gt 0 ] && [ "${1#v}" != "$cargo" ]; then
  echo "tag $1 does not match version $cargo" >&2
  status=1
fi

[ $status -eq 0 ] && echo "version $cargo"
exit $status
```

`scripts/release-notes.sh`:
```sh
#!/bin/sh
# Prints the CHANGELOG.md section for a version, for the release notes.
#
#   scripts/release-notes.sh 1.0.0
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
version=${1#v}
notes=$(awk -v v="$version" '
  index($0, "## [" v "]") == 1 { found = 1; next }
  found && /^## \[/ { exit }
  found { print }
' "$root/CHANGELOG.md")

if [ -z "$(printf '%s' "$notes" | tr -d '[:space:]')" ]; then
  echo "CHANGELOG.md has no section for $version" >&2
  exit 1
fi
printf '%s\n' "$notes"
```

Run: `sh scripts/check-version.sh && sh scripts/release-notes.sh 1.0.0`
Expected: `version 1.0.0`, then the 1.0.0 section.

- [ ] **Step 5: GitHub templates**

- `.github/CODEOWNERS`: `* @danieltyukov`
- `.github/ISSUE_TEMPLATE/config.yml`: `blank_issues_enabled: false`, contact links to Discussions ("Ideas and questions") and to `security/advisories/new` ("Security problem").
- `.github/ISSUE_TEMPLATE/bug.yml`: issue form with: what happened (textarea, required), steps to reproduce (required), what you expected, where it runs (dropdown: Web in Chrome or Edge, Web in Firefox, Web in Safari, Installed web app, Windows app, macOS app, Linux AppImage, Linux deb, Android app), version (input; "Shown in the shortcut sheet footer"), a sample `.cheatsheet` file note ("attach one if you can; it contains your images, so only share what you are happy to make public").
- `.github/ISSUE_TEMPLATE/feature.yml`: the problem (required), the idea, alternatives considered.
- `.github/PULL_REQUEST_TEMPLATE.md`: `## What this changes`, `## How I tested it`, `## Checklist` with: `npm test`, `npm run typecheck` and `cargo test -p cheatsheet-maker` pass; `npm run e2e -w app` passes for UI changes; the change has a test in the layer it belongs to; a CHANGELOG line under Unreleased if a person would notice; no personal files in fixtures.
- `.github/dependabot.yml`: cargo, npm (ignore `@types/node` majors) and github-actions, weekly, grouped minor and patch, limit 5, as in screen-side.

- [ ] **Step 6: Workflows**

`.github/workflows/ci.yml`: on push to `master`, pull requests and `workflow_dispatch`; `permissions: contents: read`; concurrency per ref. Jobs:
- `web` (ubuntu-latest): checkout, setup-node 22 with npm cache, `npm ci`, `npm run typecheck`, `npm test`, `npx playwright install --with-deps chromium`, `npm run e2e -w app`, `npm run build -w site`, `sh scripts/check-version.sh`, `shellcheck scripts/*.sh`. Upload `app/playwright-report` on failure.
- `tauri` (ubuntu-22.04): checkout, Rust stable with rustfmt and clippy, the Tauri apt packages, Rust cache keyed on `Cargo.lock`, `npm ci`, `npm run build:tauri -w app` (so `frontendDist` exists), `cargo fmt --all --check`, `cargo clippy -p cheatsheet-maker --all-targets -- -D warnings`, `cargo test -p cheatsheet-maker`.
Use the same action major versions as screen-side (`actions/checkout@v7`, `actions/setup-node@v7`, `actions/cache@v6`, `actions/upload-artifact@v7`, `dtolnay/rust-toolchain@stable`).

`.github/workflows/pages.yml`: the screen-side Pages workflow with `branches: [master]`, paths `site/**`, `app/**`, `docs/img/**`, `package.json`, `package-lock.json`, `.github/workflows/pages.yml`; build steps `npm ci`, `npm run build -w app`, `npm run build -w site`, `mkdir -p site/dist/app && cp -r app/dist/. site/dist/app/`; upload `site/dist`; deploy job unchanged. Keep the comment that Pages must be set to "GitHub Actions" once in the repository settings.

`.github/workflows/release.yml`: the screen-side release workflow shape (tag `v*`, dispatch is a dry run, `check` job running both scripts), with jobs:
- `linux-app` on ubuntu-22.04: `npx tauri build --bundles deb,appimage` from `app/`; take `cheatsheet-maker_amd64.deb` and `cheatsheet-maker_x86_64.AppImage`.
- `windows-app` on windows-latest: `npx tauri build --bundles nsis,msi`; take `CheatsheetMaker_x64-setup.exe` and `CheatsheetMaker_x64.msi`.
- `macos-app` on macos-latest: Rust targets `aarch64-apple-darwin, x86_64-apple-darwin`; `npx tauri build --target universal-apple-darwin --bundles dmg`; take `CheatsheetMaker_universal.dmg`.
- `android` on ubuntu-latest: Java (temurin 21), sdkmanager installs `platforms;android-36`, `build-tools;36.0.0` and an NDK (export `NDK_HOME`), Rust targets `aarch64-linux-android, x86_64-linux-android, armv7-linux-androideabi, i686-linux-android`; write `keystore.properties` from the four secrets when `ANDROID_KEYSTORE_BASE64` is set, otherwise emit `::warning::` and build unsigned; `npx tauri android build --apk --target aarch64 --target x86_64`; remove the keystore files; take `cheatsheet-maker.apk` from `gen/android/app/build/outputs/apk/universal/release/`.
- `publish` (needs all, only for tags, `contents: write`): download artifacts, `sha256sum -- * > SHA256SUMS`, notes from `release-notes.sh` plus a "## Downloads" section listing each file with one line of guidance, `gh release create "$TAG" --title "Cheatsheet Maker ${TAG#v}" --notes-file notes.md --verify-tag assets/*`.
The `take()` helper from screen-side copies exactly one matching bundle to its stable name and fails otherwise.

Validate every workflow with `actionlint` if it is installed (`go run github.com/rhysd/actionlint/cmd/actionlint@latest` works when Go is available); otherwise check them with `npx --yes yaml-lint .github/workflows/*.yml` and by reading each against the screen-side originals.

- [ ] **Step 7: Commit**

```bash
git add LICENSE README.md CHANGELOG.md CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md PRIVACY.md CLAUDE.md docs .github scripts
git commit -m "docs: open-source repository files, CI, Pages and release workflows"
```

---

### Task 29: Final verification

- [ ] **Step 1: Everything green from a clean install**

Run: `rm -rf node_modules app/node_modules site/node_modules && npm ci && npm run typecheck && npm test && npm run e2e -w app && npm run build -w site && npm run e2e -w site && cargo fmt --all --check && cargo clippy -p cheatsheet-maker --all-targets -- -D warnings && cargo test -p cheatsheet-maker && sh scripts/check-version.sh`
Expected: every command succeeds. Record the test counts.

- [ ] **Step 2: Style rules**

Run: `git grep -nP '[\x{2013}\x{2014}]' -- . ':!package-lock.json' ':!Cargo.lock' ':!app/src-tauri/gen'` and `git grep -nP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' -- . ':!package-lock.json'`
Expected: no output (third-party licence texts excepted, if any).

- [ ] **Step 3: Native builds**

Rebuild the Linux AppImage and deb and the Android debug APK from the final tree and repeat the hand checks from Tasks 24 and 25 (open, import, draw, export).

- [ ] **Step 4: Whole-branch review**

Dispatch a code reviewer subagent over `git diff v0-gtk..revamp` with the spec and this plan; fix what it confirms; rerun Step 1.

- [ ] **Step 5: Report**

Tell the maintainer what is done, what was verified and how, what was not verified (Windows and macOS builds only run in CI; iOS is PWA only), and the outward steps that are theirs to approve: pushing `revamp` (and the `v0-gtk` tag), merging, setting Pages to "GitHub Actions", the repository description, homepage and topics from the spec, adding Android signing secrets, and tagging `v1.0.0` to publish a release.
