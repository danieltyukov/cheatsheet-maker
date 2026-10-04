# The .cheatsheet file format

A `.cheatsheet` file is a zip archive:

    document.json
    assets/<sha256>.png
    assets/<sha256>.jpg
    ...

`document.json` is the document described below. Every image the document uses
is stored once under `assets/`, named by the lowercase hex SHA-256 of its bytes
and an extension for its type (`png`, `jpg`, `webp`, `gif`).

Opening a file never replaces an existing document: it is added to the library
as a new one.

## Units

- Lengths are in **points** (1/72 inch), measured from the top-left corner of
  the page, with y pointing down.
- Angles are in **degrees**, clockwise, about the centre of the item's box.
- Image crops are in **source pixels** of the stored image.
- Colours are `#rgb`, `#rrggbb` or `#rrggbbaa` hex strings. Nothing else is
  accepted.

## Document

| Field | Type | Meaning |
| --- | --- | --- |
| `version` | `1` | Format version |
| `id` | string | Document id |
| `title` | string | Title shown in the library |
| `createdAt`, `updatedAt` | number | Milliseconds since 1970 |
| `setup` | PageSetup | Page settings shared by every page |
| `pages` | Page[] | At least one page |
| `assets` | object | Asset id to AssetMeta |

## PageSetup

| Field | Type | Meaning |
| --- | --- | --- |
| `size` | `"A4"`, `"Letter"`, `"A3"`, `"A5"`, `"Legal"` | Paper size |
| `orientation` | `"portrait"`, `"landscape"` | |
| `margin` | number | Points on every side |
| `columns` | number | Column guides, 1 to 6 |
| `gutter` | number | Points between columns |
| `grid` | number | Grid spacing in points, 0 for none |

## Page

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | |
| `items` | Item[] | In z order: the last item is drawn on top |

## Item

Every item has `id`, `kind`, `x`, `y`, `w`, `h`, `rotation`, and may have
`locked: true`.

**`kind: "image"`**

| Field | Type | Meaning |
| --- | --- | --- |
| `assetId` | string | Key into `assets` |
| `crop` | `{x, y, w, h}` | The visible part of the image, in source pixels |
| `filters.whiteToAlpha` | number | 0 is off; up to 1 widens the near-white range made transparent |
| `filters.invert` | boolean | Invert colours |
| `filters.grayscale` | boolean | |
| `filters.contrast` | number | 1 is unchanged |

**`kind: "text"`**

| Field | Type | Meaning |
| --- | --- | --- |
| `text` | string | Markdown subset: `#` and `##` headings, `**bold**`, `*italic*`, `` `code` ``, `- ` and `1. ` lists, `$inline$` and `$$display$$` TeX |
| `fontSize` | number | Points |
| `font` | `"sans"`, `"narrow"`, `"serif"`, `"mono"` | |
| `color` | colour | Text colour |
| `background` | colour or `null` | Box fill |
| `padding` | number | Points inside the box |
| `align` | `"left"`, `"center"`, `"right"` | |

The stored `h` is the measured height of the laid-out text; readers may
recompute it.

**`kind: "shape"`**

| Field | Type | Meaning |
| --- | --- | --- |
| `shape` | `"rect"`, `"ellipse"`, `"line"`, `"arrow"` | |
| `stroke` | colour | Line colour |
| `strokeWidth` | number | Points |
| `fill` | colour or `null` | Rectangles and ellipses only |
| `flipX`, `flipY` | boolean | Lines and arrows run from the corner the flips select to the opposite one; arrows point at the second |

**`kind: "stroke"`**

| Field | Type | Meaning |
| --- | --- | --- |
| `tool` | `"pen"`, `"highlighter"` | A highlighter multiplies with what is under it |
| `color` | colour | |
| `size` | number | Nominal width in points |
| `points` | number[] | Flat `x, y, pressure` triples relative to the item's top-left corner; pressure 0 to 1, 0.5 when unknown |

## AssetMeta

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | SHA-256 of the bytes |
| `mime` | string | `image/png`, `image/jpeg`, `image/webp` or `image/gif` |
| `width`, `height` | number | Pixels |

## Versions

Readers reject a `version` they do not know, with a message asking for a newer
app, rather than guessing. Writers increase the version for any change an older
reader could misread. Adding an optional field that older readers can ignore
does not need a new version.

## The old autosave

The GTK version kept `~/.config/cheatsheet-maker/autosave.json`:
`{current_page, pages: [{items: [...], strokes: [...]}]}` with images as base64
PNG in `image_data`, positions and sizes in points (`x`, `y`, `width`,
`height`), crops in pixels (`crop_x`, `crop_y`, `crop_w`, `crop_h`), and strokes
as `{r, g, b, a, width, points: [{x, y}]}` with colour components from 0 to 1.
Importing maps it onto version 1 with an A4 portrait page, keeps every image and
stroke, and places strokes above images as the old app drew them.
