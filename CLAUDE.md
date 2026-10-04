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
