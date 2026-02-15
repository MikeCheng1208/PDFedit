<p align="center">
  <img src="assets/banner.svg" alt="PDFedit Banner" width="100%">
</p>

<h1 align="center">PDFedit</h1>

<p align="center">
  A minimal and elegant PDF editor built with Electron.<br>
  Edit PDFs locally with full privacy — no internet required.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue" alt="Platform">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/electron-28.0.0-blue" alt="Electron">
  <img src="https://img.shields.io/badge/language-EN%20%7C%20繁中-orange" alt="Language">
</p>

<p align="center">
  <a href="doc/README.md">繁體中文說明文件</a>
</p>

<p align="center">
  <a href="https://github.com/MikeCheng1208/PDFedit/releases/tag/v1.0.0">Download for macOS</a> ·
  <a href="https://github.com/MikeCheng1208/PDFedit/releases/tag/v1.0.0">Download for Windows</a>
</p>

---

## Features

- **100% Local Processing** — Your data never leaves your device.
- **Light & Dark Theme** — Auto-detects system theme with manual toggle.
- **Bilingual Interface** — Traditional Chinese & English.
- **Digital Signatures** — Draw, upload images, save & manage signatures.
- **Editing Tools** — Text, images, freehand drawing, shapes (line, rectangle, circle, arrow), highlighter, eraser.
- **Page Management** — Rotate, delete, duplicate, insert blank pages, drag-to-reorder.
- **Multi-file Operations** — Merge and split PDFs.
- **Multi-tab Editing** — Edit multiple PDFs simultaneously with independent state.

---

## Supported Platforms

| Platform | Architecture | File | Minimum Version |
|---|---|---|---|
| **macOS** | Apple Silicon (arm64) | `.dmg` / `.zip` | macOS 10.15 (Catalina)+ |
| **macOS** | Intel (x64) | `.dmg` / `.zip` | macOS 10.15 (Catalina)+ |
| **Windows** | x64 (Intel / AMD) | `.exe` installer | Windows 10+ |

> **Note**: macOS builds are not code-signed. On first launch, go to **System Preferences > Security & Privacy** to allow the app.

---

## Installation

### Prerequisites

- **Node.js** 18.0.0+
- **npm** 9.0.0+

### Setup

```bash
# Clone the repository
git clone https://github.com/MikeCheng1208/PDFedit.git
cd PDFedit

# Install dependencies
npm install

# Start in development mode
npm start
```

### Build

```bash
# Build for macOS (Apple Silicon, arm64)
npm run build:mac

# Build for macOS (Intel, x64)
npm run build:mac:intel

# Build for macOS (Universal — runs on both Apple Silicon and Intel)
npm run build:mac:universal

# Build for Windows (x64)
npm run build:win

# Build for all platforms
npm run build
```

Build outputs are in the `dist/` directory.

---

## Usage Guide

### Opening Files
- Click **Open** in the title bar
- Drag & drop a PDF file onto the app
- Keyboard shortcut `Cmd/Ctrl + O`

### Editing Tools

| Tool | Description |
|---|---|
| Select | Select, move, and resize objects |
| Text | Add text with font, size, color options |
| Image | Insert images (PNG, JPG, GIF, WebP) |
| Draw | Freehand, line, rectangle, circle, arrow |
| Highlight | Semi-transparent highlighting |
| Signature | Draw or upload digital signatures |
| Eraser | Remove annotations |

### Page Management
- **Rotate** — 90° clockwise or counter-clockwise
- **Delete** — Remove the current page (minimum 1 page)
- **Duplicate** — Copy the current page
- **Insert Blank** — Add a blank page after current
- **Merge** — Combine multiple PDF files
- **Split** — Extract specific page ranges (e.g., `1-3, 5, 7-10`)
- **Drag to Reorder** — Drag thumbnails to rearrange pages

### Saving
- `Cmd/Ctrl + S` — Save
- `Cmd/Ctrl + Shift + S` — Save As

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + O` | Open file |
| `Cmd/Ctrl + S` | Save |
| `Cmd/Ctrl + Shift + S` | Save As |
| `Cmd/Ctrl + W` | Close current tab |
| `Cmd/Ctrl + +` | Zoom in |
| `Cmd/Ctrl + -` | Zoom out |
| `Cmd/Ctrl + 0` | Fit to width |
| `Left Arrow` / `PageUp` | Previous page |
| `Right Arrow` / `PageDown` | Next page |
| `Delete` / `Backspace` | Delete selected object |
| `Escape` | Deselect / Close modal |

---

## Tech Stack

| Library | Purpose |
|---|---|
| [Electron](https://www.electronjs.org/) | Desktop application framework |
| [PDF.js](https://mozilla.github.io/pdf.js/) | PDF rendering |
| [pdf-lib](https://pdf-lib.js.org/) | PDF manipulation |
| [Fabric.js](http://fabricjs.com/) | Canvas annotation layer |
| [pdf-merger-js](https://github.com/nbesli/pdf-merger-js) | PDF merging |

---

## Project Structure

```
PDFedit/
├── main.js                  # Electron main process
├── preload.js               # Preload script (IPC bridge)
├── package.json             # Project config
├── SPEC.md                  # AI-readable specification
├── src/
│   ├── index.html           # App entry
│   ├── js/
│   │   ├── app.js           # Main controller
│   │   ├── pdf-renderer.js  # PDF rendering (PDF.js)
│   │   ├── pdf-editor.js    # PDF editing (pdf-lib)
│   │   ├── canvas-layer.js  # Annotation layer (Fabric.js)
│   │   ├── page-manager.js  # Thumbnails & navigation
│   │   ├── tab-manager.js   # Multi-tab management
│   │   ├── signature.js     # Signature system
│   │   ├── ui-controller.js # UI interactions
│   │   ├── theme.js         # Theme management
│   │   └── i18n.js          # Internationalization
│   ├── css/
│   │   ├── style.css        # Main styles
│   │   ├── themes.css       # Theme variables
│   │   └── signature.css    # Signature panel
│   ├── locales/
│   │   ├── zh-TW.json       # Traditional Chinese
│   │   └── en.json          # English
│   └── lib/                 # Vendored libraries
└── assets/
    └── icons/               # App icons
```

---

## AI-Assisted Development

If you plan to use AI tools (such as Claude, ChatGPT, Cursor, etc.) to modify or extend this project, **please have the AI read [`SPEC.md`](SPEC.md) first** before making any changes. This specification document contains the complete architecture, module relationships, data structures, and critical implementation details that will significantly reduce errors caused by AI modifications.

**Example prompt:**
> Please read the SPEC.md file first to understand the project architecture, then help me [your task].

---

## License

This project is licensed under the [MIT License](LICENSE).
