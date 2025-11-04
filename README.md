# Cheatsheet Maker

> Paste. Plop. Crop. Draw. PDF. (C go brrr)

## Features

- Paste from clipboard (Ctrl+V) or drag & drop
- Move/resize with chunky, easy handles
- Crop like Google Docs (press C, drag the yellow box)
- **Draw freehand** on pages with customizable colors and stroke width
- Multi-page A4 (Prev/Next buttons)
- **Auto-save** - work is automatically saved every 30 seconds
- **Page Management** - delete pages and reorder them
- Export to PDF (Ctrl+E)

## Install on Ubuntu

```bash
# one-shot user install (builds, adds launcher + icon)
./scripts/install-or-update-ubuntu.sh
```

## Update

After making changes to the code, simply run the same script to rebuild and update:

```bash
# rebuild and update (skips dependency installation)
./scripts/install-or-update-ubuntu.sh
```

If you prefer to install deps yourself:

```bash
sudo apt install -y build-essential make pkg-config \
   libgtk-3-dev libcairo2-dev libgdk-pixbuf2.0-dev libjson-glib-dev
./scripts/install-or-update-ubuntu.sh --no-deps
```

## Keyboard Shortcuts

- `Ctrl+V` - Paste from clipboard
- `Ctrl+O` - Import image file
- `Ctrl+E` - Export to PDF
- `Delete/Backspace` - Delete selected item
- `C` - Toggle crop mode
- `D` - Toggle draw mode
- `Ctrl+Page Up/Down` - Previous/Next page
- `Ctrl+Shift+D` - Delete current page
- `Ctrl+Shift+Up/Down` - Move page up/down
- `Ctrl+Plus/Minus/0` - Zoom in/out/reset

## Drawing Mode

Press `D` or click the **Draw** button to enter drawing mode. In this mode:
- Click and drag to draw freehand strokes
- Use the color picker to change drawing color (supports transparency)
- Adjust stroke width with the spinner (0.5 to 20 points)
- Drawings are saved with your document and exported to PDF
- Press `D` again to exit drawing mode and return to image manipulation

That's it. Go make pretty PDFs 🤌
