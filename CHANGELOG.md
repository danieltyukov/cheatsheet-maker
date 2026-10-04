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
