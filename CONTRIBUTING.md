# Contributing

Thanks for helping. Bug reports, ideas and pull requests are all welcome. For a
large change, open an issue first so we can agree on the shape before you
write it.

## Setting up

You need Node 22 with npm 10 or newer. For the native apps you also need Rust
from rustup.

```
npm ci
npm run dev           # the web app at http://localhost:5173
npm test              # Vitest: model, render, storage and UI tests
npm run typecheck
npm run e2e -w app    # Playwright against the built web app
npm run e2e -w site   # Playwright against the website
```

Desktop app, from `app/`:

```
npx tauri dev
```

On Linux that needs
`libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`.

Android app, from `app/`, with JDK 21, the Android SDK and NDK installed:

```
export NDK_HOME="$ANDROID_HOME/ndk/<version>"
npx tauri android dev
npx tauri android build --apk --debug --target x86_64   # for an emulator
```

## Where things live

`docs/ARCHITECTURE.md` explains the layers. In short: `app/src/model` holds every
rule about documents and has no access to the DOM; `app/src/render` draws pages
and exports them; `app/src/storage` keeps the library; `app/src/platform` hides
the difference between the web and Tauri; `app/src/ui` is React.

## Rules for changes

- Model code stays free of the DOM, and every rule in it has a unit test.
- Interface behaviour gets a Testing Library test or a Playwright test, in the
  layer it belongs to.
- There is one page renderer (`render/drawPage.ts`) for the screen, thumbnails
  and export. Change it there rather than adding a second path.
- Write a failing test before the fix when you fix a bug.
- No emojis, and no em or en dashes, in code, comments, interface text, docs or
  commit messages.
- Commit messages follow Conventional Commits (`feat(ui): ...`, `fix(render): ...`,
  `docs: ...`). Describe the change and why it is right, not the process that
  produced it.
- Add a line under "Unreleased" in `CHANGELOG.md` when a person using the app
  would notice the change.

## Screenshots and icons

`node scripts/render-icons.mjs` renders every icon from `app/icon-source.svg`
(needs `rsvg-convert`). `node scripts/screenshots.mjs` rebuilds the README and
website screenshots from the real app. Both are run by hand.

## Releases

A release is a tag. Bump the version in `Cargo.toml`, `app/package.json`,
`site/package.json` and `app/src-tauri/tauri.conf.json`
(`sh scripts/check-version.sh` checks they agree), move the "Unreleased" notes
into a new section of `CHANGELOG.md`, and push a `v1.2.3` tag. The release
workflow builds every platform and publishes them with checksums.

Running the release workflow by hand from the Actions tab is a dry run: it
builds every platform, keeps the files as workflow artifacts for a day, and
publishes nothing.

The Android APK is signed with a key that never lives in this repository. The
release workflow reads it from four repository secrets:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | The keystore, base64 encoded: `base64 -w0 release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | Store password |
| `ANDROID_KEY_ALIAS` | Key alias |
| `ANDROID_KEY_PASSWORD` | Key password (the store password, for a PKCS12 keystore) |

Without them the release still runs and attaches an unsigned APK, which Android
will not install. Back up the keystore and its passwords: an app signed with a
lost key cannot be updated in place, only uninstalled and installed again.

`master` is protected: changes arrive through pull requests once the "App and
site" and "Desktop shell" checks pass, and it cannot be force-pushed or
deleted.
