# Architecture

Cheatsheet Maker is one TypeScript application. The same build runs as a web app
(installable, offline), inside Tauri on Windows, macOS and Linux, and inside
Tauri on Android. This document explains how it is put together and why.

## Layers

    app/src/model     the document and every rule about it. No DOM.
    app/src/render    pixels and files: page renderer, text and math, filters, export
    app/src/storage   where documents and images are kept
    app/src/platform  what differs between the web and Tauri
    app/src/ui        React: library, editor, canvas, inspector, dialogs

Dependencies point downwards only: `ui` uses everything, `render` and `storage`
use `model`, and `model` uses nothing but itself and `fflate`.

### model

`types.ts` defines a document: a `PageSetup` shared by every page, a list of
pages, and per page a list of items in z order. An item is an image, a text box,
a shape or a pen or highlighter stroke, and every item is a box (`x, y, w, h` in
points, rotated by `rotation` degrees about its centre). Treating strokes as
items means they can be selected, moved, layered and erased like anything else.

Edits are pure functions (`commands.ts`) that take a document and return a new
one, reusing every object that did not change. That makes undo cheap:
`history.ts` keeps whole document snapshots, because images are referenced by id
rather than embedded, so a snapshot costs a few small objects.

A drag, resize, rotation or crop is a *gesture*: `beginGesture` remembers the
document, every pointer move replaces the present without recording a step, and
`endGesture` records one step from the remembered document. Escape calls
`cancelGesture`, which restores it. Derived data (a text box's measured height)
is written with `amend`, which never records a step.

`pack.ts` is a MaxRects packer. `layout.ts` uses it for auto-pack: *keep sizes*
fills pages in order, and *fill the page* binary-searches the largest common
scale at which everything fits on one page, trying two placement heuristics at
each step. Strokes and arrows that sit inside an item move with it; others are
packed as boxes of their own.

`format.ts` reads and writes `.cheatsheet` files and validates everything it
reads, including that colours are plain hex, because colours reach the canvas
and inline styles. `legacy.ts` imports the autosave of the old GTK app.

### render

`drawPage.ts` draws a page in points onto a 2D canvas context. The editor, the
page thumbnails, PNG export and the raster parts of PDF export all call it, so
what is on screen is what prints.

Text boxes are parsed by `markdown.ts` (a small subset) and laid out by
`textLayout.ts`, which wraps lines with a measuring callback and asks for math
metrics through another callback. Both callbacks are injected, so layout is
tested without a browser. `math.ts` typesets TeX with MathJax 4 to SVG (no DOM
needed), loads extra alphabets on demand, and turns the SVG into an image for
the canvas.

`filters.ts` holds the ink-saver filters and auto-trim as pure functions over
RGBA pixels. `assetCache.ts` decodes images once and caches filtered copies.

`exportPdf.ts` writes PDFs with pdf-lib. Images are cropped and filtered first
and embedded once per distinct result. Strokes and shapes are vector paths in
the PDF; text and math are rasterised at the export resolution. Each item is
placed with one transformation matrix that matches the canvas, so rotation
behaves identically on screen and on paper.

On the main thread, canvases are encoded synchronously (`toDataURL`): Chromium's
asynchronous encoders can wait several seconds for idle time.

### storage

`library.ts` keeps three IndexedDB stores: documents (with a thumbnail),
images keyed by the SHA-256 of their bytes, and small settings. Content
addressing means a lecture page used by five crops, or an image in two
documents, is stored once. Images are removed when no stored document refers
to them. If IndexedDB is unavailable (some private windows), a `MemoryLibrary`
with the same interface keeps the editor working, and the status says the work
is not being saved.

`autosave.ts` saves 500 ms after the last edit, one save at a time, and reports
Saved, Saving, or Not saved with the reason.

### platform

Opening files uses an `<input type="file">` everywhere: desktop webviews and the
Android WebView all handle it. Saving differs: the web uses the File System
Access API where it exists and a download link otherwise; Tauri uses the native
save dialog and writes through the fs plugin, because webviews do not download.

### ui

`store.ts` is a small external store read with `useSyncExternalStore`. The canvas
(`canvas/CanvasView.tsx`) draws every visible page and an overlay of handles and
guides, and hands pointer input to `canvas/gestures.ts`, which turns it into
store updates. `actions.ts` collects everything the menus, shortcuts and
inspector do.

## Builds

`vite build` produces the web app with a service worker (vite-plugin-pwa) that
precaches the app, the fonts, MathJax and the pdf.js worker, so it works offline
after one visit. MathJax's rarely used alphabets are cached when first needed.

`vite build --mode tauri` produces the same app without the service worker for
Tauri. `app/src-tauri` is a thin Rust shell: the dialog and fs plugins and one
command that reads the old GTK autosave. On Android, `MainActivity` pads the
WebView by the system bar insets, because Android 15 draws apps edge to edge and
the WebView reports no safe-area insets.

## Tests

- Vitest unit tests for the model and render layers (Node, no DOM).
- Vitest with Testing Library and jsdom for components and the store.
- Playwright against the production web build for whole flows: paste, crop,
  draw, text with math, PDF import, auto-pack, export, reload, offline, phones.
- `cargo test` for the Rust shell.
