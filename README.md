![Mfw I finally make a PDF](assets/logo.png)

# Cheatsheet Maker

> Paste. Plop. Crop. PDF. (C go brrr)

## Features

- Paste from clipboard (Ctrl+V) or drag & drop
- Move/resize with chunky, easy handles
- Crop like Google Docs (press C, drag the yellow box)
- Multi-page A4 (Prev/Next buttons)
- Export to PDF (Ctrl+E)

## Install on Ubuntu

```bash
# one-shot user install (builds, adds launcher + icon)
./scripts/install-ubuntu.sh
```

If you prefer to install deps yourself:

```bash
sudo apt install -y build-essential make pkg-config \
   libgtk-3-dev libcairo2-dev libgdk-pixbuf2.0-dev
./scripts/install-ubuntu.sh --no-deps
```

That’s it. Go make pretty PDFs 🤌

---
## License

MIT
