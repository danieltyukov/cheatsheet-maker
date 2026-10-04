# Cheatsheet Maker: cross-platform revamp

Date: 2026-10-04
Status: approved in conversation, awaiting written-spec review

## Goal

Rebuild Cheatsheet Maker so it installs on any desktop and any phone, add the
features that make dense exam cheatsheets fast to produce, and set the
repository up as an open-source project in the same shape as the maintainer's
other public repos (owl-transfer, to-hoot, screen-side-switcher).

Success means:

- The app runs as an installable web app (PWA) on Windows, macOS, Linux,
  Android and iOS, and as native Tauri builds for Windows (.exe, .msi), macOS
  (.dmg), Linux (.AppImage, .deb) and Android (.apk).
- Everything the GTK version did still works: paste, drop, import, move,
  resize, crop, freehand drawing, multiple pages, autosave, PDF export.
- The four agreed feature bundles ship: text/math/shapes, import from slides,
  smart layout, ink saver and cleanup.
- The repository has a licence, contributor docs, issue forms, CI, a release
  workflow, a project website and a README in the house style.
- Unit, component and end-to-end tests pass in CI, and the app has been driven
  by hand in Chrome, as a Tauri Linux build and on an Android emulator.

Constraints:

- Local-first. No account, no server, no analytics, no third-party requests at
  runtime. Fonts are self-hosted.
- No emojis and no em or en dashes in code, docs, UI strings or commits.
- Nothing is pushed and no GitHub settings change until the maintainer has
  reviewed the branch.

## What exists today

About 2,100 lines of C on GTK3, Cairo and json-glib (`src/`). One A4 page is
shown at a time. A page holds image items (pixbuf, position and size in
points, crop rectangle in source pixels) and freehand strokes (points, RGBA,
width). Autosave writes `~/.config/cheatsheet-maker/autosave.json` with images
as base64 PNG. Export draws every page to a Cairo PDF surface. Compiled objects
and the binary are committed. The app id is a placeholder and the logo is a
"thinking face" emoji image.

The current commit is tagged `v0-gtk` so the C version stays recoverable. The
C sources, Makefile, `build/` and the binary are removed from the tree.

## Architecture

npm workspaces, same layout as owl-transfer:

    app/                 the application (React 19, Vite, TypeScript)
      src/model/         document types, commands, history, geometry, packing,
                         snapping, file format, legacy import. No DOM.
      src/render/        Canvas2D page renderer, text and math layout,
                         image filters, PDF and PNG export
      src/storage/       IndexedDB library and asset store
      src/platform/      web and Tauri adapters for files and dialogs
      src/ui/            React components and the editor store
      src/tokens.css     design tokens shared with the site
      src-tauri/         Tauri 2 shell (desktop and Android)
      e2e/               Playwright tests against the built PWA
    site/                landing page (Vite, static output)
    scripts/             icon rendering, version check, release notes
    docs/                architecture, file format, specs and plans

The model layer is pure TypeScript with no DOM access, so every rule about
documents can be tested directly in Vitest. Rendering is a single function
`drawPage(ctx, page, setup, assets, options)` used for the editor, thumbnails,
PNG export and the raster parts of PDF export, so what you see is what prints.

### Document model (file format version 1)

    CheatDocument {
      version: 1
      id, title, createdAt, updatedAt
      setup: PageSetup            shared by every page
      pages: Page[]
      assets: Record<AssetId, AssetMeta>
    }
    PageSetup {
      size: 'A4' | 'Letter' | 'A3' | 'A5' | 'Legal'
      orientation: 'portrait' | 'landscape'
      margin: number              points
      columns: number             1 to 6, guides only
      gutter: number              points
      grid: number                points, 0 means off
    }
    Page { id, items: Item[] }    array order is z order, last is on top
    AssetMeta { id, mime, width, height }   id is the SHA-256 of the bytes

Every item shares `id, kind, x, y, w, h, rotation` (points, degrees, rotation
about the centre) and an optional `locked` flag. Kinds:

- `image`: `assetId`, `crop {x, y, w, h}` in source pixels, `filters
  {whiteToAlpha, invert, grayscale, contrast}`.
- `text`: `text` (Markdown-lite source), `fontSize`, `font` (`sans`,
  `narrow`, `serif`, `mono`), `color`, `background` (colour or null),
  `padding`, `align`. Height is computed from the layout and stored.
- `shape`: `shape` (`rect`, `ellipse`, `line`, `arrow`), `stroke`,
  `strokeWidth`, `fill` (colour or null), `flipX`, `flipY` (which diagonal a
  line or arrow runs along inside its box).
- `stroke`: `tool` (`pen`, `highlighter`), `color`, `size`, `points` (flat
  `[x, y, pressure, ...]` relative to the item origin). Resizing a stroke
  rescales its points.

Strokes are ordinary items, so they can be selected, moved, layered and
erased like anything else.

### Commands and history

Edits are pure functions `(doc, args) => doc` that return a new document with
structural sharing. The editor keeps a history of document snapshots, capped
at 200. A drag, resize or crop is one history entry, committed on pointer up.
Images live in the asset store and are referenced by id, so snapshots are
cheap.

### Storage

IndexedDB through `idb`:

- `docs`: one record per document (the JSON above) plus a small thumbnail.
- `assets`: image bytes keyed by SHA-256, shared across documents, and
  garbage collected (by scanning the stored documents) when a document is
  deleted.
- `meta`: last opened document, preferences.

Autosave runs 500 ms after the last edit. The status indicator reads Saved,
Saving, or Not saved with the reason. On first save the app calls
`navigator.storage.persist()`. Imported images larger than 4096 px on the long
side are downscaled once on import.

### `.cheatsheet` file

A zip (fflate) containing `document.json` and `assets/<sha256>.<ext>`.
`docs/FILE-FORMAT.md` documents it. Opening a file never overwrites an
existing document: it is added to the library as a new one.

### Legacy import

The old `autosave.json` (base64 PNG images, crop rectangles, RGBA strokes)
maps one to one onto version 1 with A4 portrait setup. It can be imported from
the library screen on every platform. On Tauri desktop the app also looks for
`~/.config/cheatsheet-maker/autosave.json` on first run and offers to import
it.

### Platform adapters

One interface used by the UI:

    saveFile(name, blob, kind)       kind: pdf | png | cheatsheet
    openFiles(accept, multiple)      returns File-like objects
    readLegacyAutosave()             Tauri desktop only, null elsewhere

The web adapter uses the File System Access API where available and falls
back to a download link and a file input. The Tauri adapter uses
`@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs`. The service worker is
disabled in the Tauri build.

## Editor

### Layout

Desktop: a top bar (library button, document title, undo, redo, Insert menu,
Layout menu, Export menu, theme toggle), a tool rail on the left, a page
thumbnails sidebar, the canvas, and an inspector on the right that shows
properties for the current selection or, with nothing selected, page setup.

Phone (under 720 px wide): compact top bar, tools along the bottom, pages and
inspector as bottom sheets.

The canvas shows all pages stacked vertically and draws only the visible ones.
Scrolling pans, Ctrl or Cmd plus the wheel zooms, two fingers pan and pinch.
The current page is the one under the centre of the view. An item dropped with
its centre over another page moves to that page.

### Tools and shortcuts

| Tool | Key | Notes |
|------|-----|-------|
| Select | V | click, Shift-click, marquee; drag to move, handles to resize, top handle to rotate (Shift snaps to 15 degrees) |
| Hand | H, hold Space | pan |
| Pen | P or D | pressure-sensitive (perfect-freehand), colour and size in the inspector |
| Highlighter | M | wide, translucent, multiply blend |
| Eraser | E | removes whole strokes it touches |
| Text | T | click to place, double-click a text box to edit |
| Rectangle, Ellipse, Line, Arrow | R, O, L, A | Shift keeps squares, circles and 45 degree lines |
| Crop | C | on the selected image, as in the GTK app |

Other shortcuts: Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y for history; Ctrl+C, X, V
and D for clipboard and duplicate; Delete; arrow keys nudge 1 pt (Shift 10
pt); Ctrl+A selects all on the page; Ctrl+] and Ctrl+[ move forward and back,
with Shift to front and back; Ctrl+E exports PDF; Ctrl+Shift+E exports PNG;
Ctrl+O imports images; Ctrl+Shift+O imports a PDF; Ctrl+S saves a
`.cheatsheet` file; Ctrl+plus, minus and 0 zoom; Ctrl+Enter adds a page; `?`
shows the shortcut sheet. Cmd replaces Ctrl on macOS.

Handles grow on coarse pointers so they are usable with a finger.

### Text and math

Text boxes accept a small Markdown subset: `#` and `##` headings, `**bold**`,
`*italic*`, `` `code` ``, `- ` bullets, `1. ` numbered lists, `$inline$` and
`$$display$$` TeX. Layout is a pure function over a measuring callback, so it
is tested without a browser. Math is rendered by MathJax 4 to SVG, lazy
loaded the first time a document needs it, and drawn to the canvas as an
image. A TeX error shows the source in red inside the box rather than failing
the render.

Fonts are bundled through `@fontsource-variable`, so text renders the same on
every platform: Atkinson Hyperlegible Next (sans, chosen for legibility at
small sizes), Archivo Narrow (narrow, for density), Source Serif 4 (serif) and
JetBrains Mono (mono). Pasting plain text creates a text box.

### Import

- Paste (Ctrl+V or the Paste button), drag and drop, and the file picker, as
  before.
- On phones, a Camera button opens the camera through
  `<input type="file" accept="image/*" capture="environment">`.
- PDF import (pdf.js): a dialog with page thumbnails and a large page view.
  Drag one or more boxes on a page and press Add, or add the whole page. The
  page is rasterised at 200 DPI (setting: 150, 200, 300) and stored once; each
  box becomes an image item whose crop points at it, so the crop can be
  widened later. Items are placed at their physical size from the slide,
  scaled down only if larger than the printable area.
- Dropping a `.cheatsheet` or legacy `.json` opens it as a new document;
  dropping a PDF opens the import dialog.

### Smart layout

- Auto-pack, from the Layout menu, applies to the selection or, with nothing
  selected, to the current page. Images, text boxes and rectangles and
  ellipses are packed; strokes, lines and arrows whose bounding box lies
  inside one packed item move and scale with that item, others stay put.
  - Arrange keeps sizes and packs tightly inside the margins, spilling onto
    new pages if needed.
  - Fit to page scales every packed item by one common factor, the largest
    that fits on the page, found by binary search over a MaxRects packer.
  - The packing gap defaults to 4 pt and is set in the inspector.
- Snap guides to page edges, margins, column guides, the page centre and
  other items' edges and centres while moving or resizing. Hold Alt to
  suppress snapping. An optional grid both shows and snaps.
- Align (left, centre, right, top, middle, bottom) and distribute
  (horizontally, vertically) for multi-selections.
- Layer order: forward, backward, to front, to back.
- Page setup: size, orientation, margins, column guides and gutter, grid.
- Pages sidebar: thumbnails, drag to reorder, add, duplicate, delete (the last
  page cannot be deleted).

### Ink saver and cleanup

Per image, in the inspector:

- White to transparent, with a threshold slider: near-white pixels fade to
  transparent, so screenshots stop printing grey boxes.
- Invert, for dark-theme slides.
- Grayscale.
- Contrast.
- Auto-trim: crops off uniform margins by finding the bounding box of pixels
  that differ from the border colour.
- Reset filters.

Filters are pure functions over `ImageData`, cached per asset and filter set,
and applied identically on screen and in exports.

### Export and print check

- PDF: pdf-lib. Images are cropped and filtered before embedding and
  deduplicated. Strokes and shapes are vector paths; highlighter uses the
  multiply blend mode. Text and math boxes are rasterised at the export DPI
  (setting, default 300). Every page has the document's page size.
- PNG: the current page or all pages, at a chosen DPI. Several pages are
  saved as one PNG per page inside a zip.
- Print check: a panel that lists images whose effective resolution on the
  page is under 150 DPI and text under 5 pt, each with a button that selects
  the item. An Actual size zoom shows the page at its physical size.

### Errors

- Storage full or unavailable: the status indicator says so and offers to
  export a `.cheatsheet` backup; edits stay in memory.
- An image or PDF that cannot be decoded, or a password-protected PDF: a toast
  with the reason; nothing is added.
- A `.cheatsheet` with an unknown version or broken JSON: rejected with a
  message; no existing document is touched.
- Export failure: a toast with the reason; the document is unchanged.

## Distribution

### PWA

`vite-plugin-pwa` generates the service worker and manifest (name, short name,
icons including maskable, standalone display, theme colours, a file handler
for `.cheatsheet` on Chromium desktop). Updates use a prompt: a toast offers
to reload when a new version is ready. The app is served at
`https://danieltyukov.github.io/cheatsheet-maker/app/`; the build uses a
relative base so the same output also works inside Tauri.

### Tauri

- `productName` "Cheatsheet Maker", identifier
  `io.github.danieltyukov.CheatsheetMaker`, version 1.0.0 in every manifest
  (checked by `scripts/check-version.sh`).
- Plugins: dialog, fs (scoped to user-chosen paths and the legacy autosave
  file). One Rust command, `legacy_autosave`, reads the old autosave file.
- Android is generated with `tauri android init` and built for aarch64 and
  x86_64.
- iOS is served by the PWA. A native iOS build needs a Mac and a paid Apple
  developer account and is out of scope.

### Release workflow

`release.yml` runs on a `v*` tag; `workflow_dispatch` is a dry run that
builds everything and publishes nothing. Jobs:

1. Versions agree; a CHANGELOG section exists for the tag.
2. Linux on ubuntu-22.04: `cheatsheet-maker_x86_64.AppImage`,
   `cheatsheet-maker_amd64.deb`.
3. Windows: `CheatsheetMaker_x64-setup.exe`, `CheatsheetMaker_x64.msi`.
4. macOS universal: `CheatsheetMaker_universal.dmg` (ad-hoc signed, not
   notarised).
5. Android: `cheatsheet-maker.apk`, signed if the keystore secrets are set,
   otherwise unsigned with a warning.
6. Publish: `SHA256SUMS`, release notes from the CHANGELOG plus a Downloads
   block, `gh release create --verify-tag`.

### Website

`site/` is a static Vite page that imports `app/src/tokens.css`. Sections: a
hero with the icon, name, one-line pitch, Open the web app and Download
buttons (the primary button follows the visitor's OS), and light and dark
screenshots; a feature section; how it works in three steps; install per
platform; privacy; FAQ; footer with repository link, MIT, privacy and a font
licence note. Light and dark themes with a toggle. OG image and favicon.

`pages.yml` builds the site and the PWA, copies the PWA into `site/dist/app/`
and deploys with `actions/deploy-pages`.

### Branding

A new SVG icon master at `app/icon-source.svg`: a sheet in ink with a few
packed tiles and a highlighter stroke, on highlighter yellow. It carries the
old logo's yellow but is an original mark. `scripts/render-icons.mjs` renders
the favicon, PWA icons (192, 512, maskable), apple-touch icon, OG image and
the 1024 px source for `tauri icon`, which generates the desktop and Android
sets. Tokens: highlighter yellow accent, ink text, warm paper background in
light mode, a near-black background in dark mode. The UI uses Atkinson
Hyperlegible Next (already bundled for documents); headings on the site and
the app title use Bricolage Grotesque. All fonts are OFL and self-hosted.

### Repository files

- `LICENSE` (MIT only; font notices go in the README and site footer)
- `README.md` in the owl-transfer format
- `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `PRIVACY.md`
- `CHANGELOG.md` (Keep a Changelog, 1.0.0 entry)
- `.editorconfig`, `.gitignore`, `CLAUDE.md`
- `docs/ARCHITECTURE.md`, `docs/FILE-FORMAT.md`
- `.github/`: `ISSUE_TEMPLATE/{bug.yml, feature.yml, config.yml}`,
  `PULL_REQUEST_TEMPLATE.md`, `CODEOWNERS`, `dependabot.yml`,
  `workflows/{ci.yml, pages.yml, release.yml}`
- Suggested repository description: "Turn screenshots, lecture slides, notes
  and formulas into a dense, printable cheatsheet. Windows, macOS, Linux,
  Android and the web, no account." Homepage
  `https://danieltyukov.github.io/cheatsheet-maker/`. Topics: cheatsheet,
  pdf, pwa, tauri, study-tools, exam, note-taking, react, typescript.

## Testing

- Vitest, model: every command, history (including drag coalescing), geometry
  with rotation, hit testing, MaxRects packing and fit-to-page search,
  snapping, `.cheatsheet` round trip, legacy import of a real GTK autosave
  file, version rejection.
- Vitest, render: Markdown-lite parsing and layout with a fake measurer, image
  filters and auto-trim on synthetic `ImageData`, PDF export structure (page
  count, page size) read back with pdf-lib.
- Vitest with Testing Library: toolbar and tool switching, inspector controls,
  library actions, page sidebar reorder.
- Playwright against `vite preview` of the PWA build: create a document, paste
  an image, crop it, draw a stroke, add a text box with math, import a PDF
  region, auto-pack, undo and redo, export a PDF and check its page count,
  reload and find the document restored, load the app offline after the first
  visit, and a phone-sized viewport pass. A site smoke test checks links and
  both themes.
- Manual: drive the PWA in Chrome, run the Tauri Linux build, install the APK
  on an Android emulator and exercise import, draw and export.

CI (`ci.yml`) runs typecheck, unit and component tests, the PWA build, the
Playwright suite, the site build and `cargo check` of the Tauri crate, with no
secrets so forks can run it.

## Out of scope

- Native iOS builds (the PWA covers iOS).
- Real-time collaboration, cloud sync, accounts.
- OS file associations for `.cheatsheet` in the native builds.
- Vector text in PDFs (text is rasterised at print DPI).
- Partial stroke erasing.
