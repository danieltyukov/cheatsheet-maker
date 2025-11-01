# Cheatsheet Maker

A super-fast, minimal tool for making printed cheat sheets by pasting and arranging images on A4 pages, then exporting to PDF. Built in C with GTK3 and Cairo for speed and low memory usage.

## Features

- A4 canvas (portrait) with smooth zoom (mouse wheel, Ctrl+Plus/Minus)
- Paste images (Ctrl+V) from clipboard
- Import images from files (Ctrl+O) or drag-and-drop onto canvas
- Move images — click and drag anywhere on the image
- Resize images — click and drag the white square handles with blue borders (corners/edges)
- Crop mode — toggle "Crop" button or press C:
   - Drag yellow handles to adjust crop region (Google Docs style)
   - Drag inside the yellow box to move the crop region
   - Handles are large and easy to click
- Multi-page document (Prev/Next navigation; add pages as needed)
- Export to PDF (Ctrl+E) — multi-page A4 PDF

## Install dependencies (Ubuntu)

```bash
sudo apt update
sudo apt install -y build-essential libgtk-3-dev libcairo2-dev libgdk-pixbuf2.0-dev
```

## Build

```bash
make
```

## Run

```bash
make run
# or
./cheatsheet-maker
```

## One-line install on Ubuntu (with desktop icon)

This script builds the app, installs it under ~/.local, adds an icon and a launcher.

```bash
./scripts/install-ubuntu.sh
```

Notes:
- The script uses sudo to install dependencies. When prompted, your password input is not echoed (no stars) — just type and press Enter.
- If you prefer to install packages yourself:

```bash
sudo apt install -y build-essential make pkg-config libgtk-3-dev libcairo2-dev libgdk-pixbuf2.0-dev
./scripts/install-ubuntu.sh --no-deps
```

To use a custom PNG icon:

```bash
ICON=assets/logo.png ./scripts/install-ubuntu.sh
```

## Shortcuts

- Ctrl+O: Import image
- Ctrl+V: Paste image
- Delete/Backspace: Delete selected image
- Ctrl+E: Export to PDF
- Ctrl+PageUp/PageDown: Prev/Next page
- Ctrl+Plus/Minus/0: Zoom in/out/reset
- C: Toggle crop mode
- Esc: Deselect / cancel

## License

MIT

```bash

## Run

## Install dependencies (Ubuntu)sudo apt-get update

```bash

make runsudo apt-get install -y \

# or directly:

./cheatsheet-maker```bash    libgtk-3-dev \

```

sudo apt update    libcairo2-dev \

## Usage Tips

sudo apt install -y build-essential libgtk-3-dev libcairo2-dev libgdk-pixbuf2.0-dev    libpoppler-glib-dev \

### Importing Images

- **Clipboard paste**: Copy an image in your browser or screenshot tool, then press Ctrl+V```    build-essential \

- **File import**: Ctrl+O opens a file dialog

- **Drag and drop**: Drag image files from your file manager onto the canvas    pkg-config



### Moving and Resizing## Build```

- **Move**: Click anywhere on the image and drag

- **Resize**: Look for the **white square handles** at the corners and edges - they have blue borders and are easy to grab. Click and drag to resize.

- **Handles not clickable?** Make sure you're clicking directly on the white square. The handle hit area is generous (20x20 points).

```bash## Building

### Cropping (Like Google Docs)

1. Select an image by clicking on itmake

2. Press **C** or click the **Crop** button in the toolbar

3. You'll see:``````bash

   - A **yellow border** around the crop area

   - **Grayed out area** outside the crop (50% dark overlay)make

   - **White square handles** with yellow borders at corners and edges

4. **To crop**:## Run```

   - Drag the **yellow handles** at the corners/edges to resize the crop area

   - Drag **inside the yellow box** to move the crop area within the image

5. Press **C** again or click **Crop** to exit crop mode

```bash## Running

### Multi-Page

- **Next page**: Click "Next ▶" or Ctrl+PageDown (creates new page if at end)make run

- **Previous page**: Click "◀ Prev" or Ctrl+PageUp

- Page counter shows "Page X / Y" in the toolbar``````bash



### Export./cheatsheet-maker

- Press **Ctrl+E** or click "Export PDF"

- Choose filename and location## Shortcuts```

- Opens a multi-page PDF with A4 pages at 595×842 points (210×297mm)



## Shortcuts

- Ctrl+O: Import image## Usage

| Key | Action |

|-----|--------|- Ctrl+V: Paste image

| Ctrl+O | Import image from file |

| Ctrl+V | Paste image from clipboard |- Delete/Backspace: Delete selected image- **New Page**: Click "New Page" to add a new A4 page

| Ctrl+E | Export to PDF |

| Delete / Backspace | Delete selected image |- Ctrl+E: Export to PDF- **Add Image**: Click "Add Image" to load an image from file

| Ctrl+PageUp | Previous page |

| Ctrl+PageDown | Next page |- Ctrl+N: New document- **Paste**: Use Ctrl+V to paste image from clipboard

| Ctrl+Plus | Zoom in |

| Ctrl+Minus | Zoom out |- Ctrl+PageUp/PageDown: Prev/Next page- **Move**: Click and drag images to move them

| Ctrl+0 | Reset zoom |

| C | Toggle crop mode |- Ctrl+Plus/Minus/0: Zoom in/out/reset- **Resize**: Click and drag image corners/edges to resize

| Mouse wheel | Zoom in/out |

| Esc | Deselect / cancel |- C: Toggle crop mode- **Crop**: Select image, click "Crop Mode", then drag to select crop area



## Performance- Esc: Cancel interaction / deselect- **Delete**: Select image and press Delete key



- Uses GTK3 + Cairo for minimal overhead and GPU-backed rendering- **Save PDF**: Click "Save PDF" to export your cheat sheet

- Stores layout in points (1/72") for precise, DPI-independent rendering

- Only converts to pixels for display at runtime## Notes

- Cropping uses sub-pixbufs and Cairo scaling for efficient draws

- Minimal allocations in draw loop; front-to-back hit-testing for quick selection## Keyboard Shortcuts

- Typical memory: <30MB for multi-page document with dozens of images

- Units are stored in typographic points (1/72") for precise PDF export. A4 page = 595 x 842 points.

## Technical Notes

- Rendering is GPU-backed in GTK, final PDF is vector-backed with efficiently embedded images via Cairo.- `Ctrl+N`: New page

- Units are stored in typographic points (1/72") for precise PDF export

- A4 page = 595.275 × 841.890 points (210 × 297 mm)- `Ctrl+O`: Open image

- Rendering is GPU-backed via GTK, final PDF is vector with embedded rasters

- Wayland/HiDPI: Rendering is DPI-independent; on-screen zoom adapts to monitor DPI## Troubleshooting- `Ctrl+V`: Paste image from clipboard



## Troubleshooting- `Ctrl+S`: Save to PDF



**Build fails with missing headers:**- If the build fails due to missing headers, ensure the dependencies are installed.- `Delete`: Delete selected image

```bash

sudo apt install -y build-essential libgtk-3-dev libcairo2-dev libgdk-pixbuf2.0-dev- Wayland/HiDPI: Rendering is DPI-independent since the model uses points; on-screen zoom adapts to monitor DPI.- `Ctrl+Z`: Undo

```

- `Ctrl+Y`: Redo

**Can't click resize handles:**

- Handles are the white squares at corners/edges with blue borders## License

- Make sure the image is selected (blue border around entire image)

- Try zooming in (Ctrl+Plus or mouse wheel) for easier clicking## License



**Crop mode not working:**MIT.

- Select an image first by clicking on it

- Press C or click "Crop" buttonMIT License

- Look for yellow handles on the crop box (white squares with yellow borders)
- The crop box starts at the full image size - drag handles inward to crop

**App crashes or won't start:**
- Make sure you have a display server (X11 or Wayland)
- Check `echo $DISPLAY` returns something like `:0` or `:1`

## License

MIT
