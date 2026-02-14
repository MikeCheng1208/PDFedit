# PDFedit — Project Specification for AI / 專案規格文件

> **Purpose / 用途**: This document is designed for AI tools to read before modifying the codebase. It describes the complete architecture, module relationships, data flows, and critical implementation details.
>
> 本文件供 AI 工具在修改程式碼前閱讀，涵蓋完整架構、模組關係、資料流程與關鍵實作細節。

---

## Table of Contents / 目錄

1. [Overview / 概述](#1-overview--概述)
2. [Tech Stack / 技術棧](#2-tech-stack--技術棧)
3. [Project Structure / 專案結構](#3-project-structure--專案結構)
4. [Architecture / 架構設計](#4-architecture--架構設計)
5. [Module Details / 模組詳解](#5-module-details--模組詳解)
6. [Electron IPC / 主進程通信](#6-electron-ipc--主進程通信)
7. [Preload API / 預載 API](#7-preload-api--預載-api)
8. [Data Structures / 資料結構](#8-data-structures--資料結構)
9. [Core Workflows / 核心工作流程](#9-core-workflows--核心工作流程)
10. [Critical Notes & Workarounds / 重要注意事項](#10-critical-notes--workarounds--重要注意事項)
11. [CSS Architecture / CSS 架構](#11-css-architecture--css-架構)
12. [Internationalization / 國際化](#12-internationalization--國際化)

---

## 1. Overview / 概述

PDFedit is a desktop PDF editor built with Electron. All processing happens locally — no data is sent to any server.

PDFedit 是一個使用 Electron 建構的桌面 PDF 編輯器，所有處理皆在本地完成。

### Core Design Principles / 核心設計原則

1. **Privacy First / 隱私優先** — No network requests, all data stays on device.（無網路請求，資料不離開裝置。）
2. **Modular Architecture / 模組化架構** — Each module has a single responsibility. Modules communicate through the `App` controller.（每個模組職責單一，透過 `App` 控制器溝通。）
3. **Dual Rendering / 雙重渲染** — PDF.js renders for display; pdf-lib handles structural edits. Both operate on separate copies of the same buffer.（PDF.js 負責顯示渲染，pdf-lib 負責結構編輯，兩者各自操作 buffer 的副本。）
4. **Annotation as Overlay / 註釋疊加層** — Fabric.js canvas sits on top of PDF.js canvas. On save, annotations are flattened into the PDF as embedded PNG images.（Fabric.js 畫布疊在 PDF.js 畫布上方，儲存時將註釋扁平化為 PNG 嵌入 PDF。）

---

## 2. Tech Stack / 技術棧

| Library | Version | Role / 角色 |
|---|---|---|
| **Electron** | ^28.0.0 | Desktop app framework. Main process handles file I/O, dialogs, signatures.（桌面應用框架，主進程處理檔案 I/O、對話框、簽名。） |
| **PDF.js** (pdfjs-dist) | ^4.0.379 | Renders PDF pages to `<canvas>`. Runs rendering in a Web Worker.（將 PDF 頁面渲染至 canvas，於 Web Worker 中執行。） |
| **pdf-lib** | ^1.17.1 | Modifies PDF structure: rotate, delete, duplicate, insert, merge pages. Embeds annotation images on save.（修改 PDF 結構：旋轉、刪除、複製、插入、合併頁面。儲存時嵌入註釋圖片。） |
| **Fabric.js** | ^5.3.0 | Interactive canvas for annotations: text, drawing, shapes, images, signatures.（互動式畫布用於註釋：文字、繪圖、形狀、圖片、簽名。） |
| **pdf-merger-js** | ^5.1.1 | Merges multiple PDF files.（合併多個 PDF 檔案。） |

### Library Loading / 函式庫載入方式

Libraries are **vendored** (copied to `src/lib/`) via the `postinstall` script, NOT loaded from `node_modules` at runtime. This is critical because `node_modules` is excluded from the build.

函式庫透過 `postinstall` 腳本複製到 `src/lib/`，執行時不從 `node_modules` 載入，因為 `node_modules` 在建置時被排除。

```
src/lib/
├── fabric.min.js        # Fabric.js
├── pdf-lib.min.js       # pdf-lib
└── pdfjs/
    ├── pdf.mjs          # PDF.js main
    ├── pdf.worker.mjs   # PDF.js worker (patched)
    ├── cmaps/           # Character maps for CJK fonts
    └── standard_fonts/  # Standard PDF fonts
```

> **IMPORTANT**: The `postinstall` script patches `pdf.worker.mjs` to fix a CJK composite font rendering issue. The patch changes `properties.composite && (properties.cidToGidMap?.length > 0 || !(properties.cMap instanceof IdentityCMap))` to `properties.composite`. Do NOT overwrite this file without re-applying the patch.
>
> **重要**：`postinstall` 腳本會修補 `pdf.worker.mjs` 以修復 CJK 複合字型渲染問題。請勿覆寫此檔案而未重新套用修補。

---

## 3. Project Structure / 專案結構

```
PDFedit/
├── main.js                    # [MAIN PROCESS] Window management, IPC handlers, file I/O, menus
│                              # [主進程] 視窗管理、IPC 處理、檔案 I/O、選單
├── preload.js                 # [PRELOAD] contextBridge API (renderer ↔ main)
│                              # [預載] contextBridge API（渲染進程 ↔ 主進程）
├── package.json               # Dependencies, build config, scripts
├── entitlements.mac.plist     # macOS sandbox entitlements
│
├── src/
│   ├── index.html             # Single HTML file — entire UI structure
│   │                          # 單一 HTML 檔案 — 完整 UI 結構
│   ├── js/
│   │   ├── app.js             # [CONTROLLER] Coordinates all modules, keyboard shortcuts, drag-drop
│   │   │                      # [控制器] 協調所有模組、鍵盤快捷鍵、拖放
│   │   ├── pdf-renderer.js    # [VIEW] PDF.js rendering, zoom, page rotation tracking
│   │   │                      # [視圖] PDF.js 渲染、縮放、頁面旋轉追蹤
│   │   ├── pdf-editor.js      # [MODEL] pdf-lib operations, annotation embedding
│   │   │                      # [模型] pdf-lib 操作、註釋嵌入
│   │   ├── canvas-layer.js    # [VIEW] Fabric.js canvas, tools (draw/text/image/shape/highlight/signature/eraser)
│   │   │                      # [視圖] Fabric.js 畫布、工具（繪圖/文字/圖片/形狀/螢光筆/簽名/橡皮擦）
│   │   ├── page-manager.js    # [VIEW] Thumbnail sidebar, page navigation, drag-to-reorder
│   │   │                      # [視圖] 縮圖側邊欄、頁面導覽、拖放排序
│   │   ├── tab-manager.js     # [CONTROLLER] Multi-tab state isolation and switching
│   │   │                      # [控制器] 多分頁狀態隔離與切換
│   │   ├── signature.js       # [VIEW] Signature panel: draw, upload, saved signatures
│   │   │                      # [視圖] 簽名面板：手繪、上傳、已儲存簽名
│   │   ├── ui-controller.js   # [VIEW] Tool switching, modals, color/shape pickers
│   │   │                      # [視圖] 工具切換、對話框、顏色/形狀選擇器
│   │   ├── theme.js           # [UTIL] Light/dark theme via CSS variables
│   │   │                      # [工具] 透過 CSS 變數切換明暗主題
│   │   └── i18n.js            # [UTIL] i18n via data-i18n attributes
│   │                          # [工具] 透過 data-i18n 屬性實現國際化
│   ├── css/
│   │   ├── style.css          # Main layout, components (~1024 lines)
│   │   ├── themes.css         # CSS custom properties for light/dark themes
│   │   └── signature.css      # Signature panel styles
│   ├── locales/
│   │   ├── zh-TW.json         # Traditional Chinese translations
│   │   └── en.json            # English translations
│   └── lib/                   # Vendored third-party libraries (see §2)
│
├── assets/
│   ├── banner.svg             # README banner image
│   └── icons/
│       ├── icon.svg           # Source icon
│       ├── icon.png           # PNG icon (Windows)
│       ├── icon.icns          # macOS icon
│       └── icon.ico.png       # ICO source
│
└── tests/                     # Jest test files
```

---

## 4. Architecture / 架構設計

### Module Relationship Diagram / 模組關係圖

```
┌─────────────────────────────────────────────────────────┐
│                    main.js (Main Process)                │
│    File I/O, Dialogs, Signatures, Theme, Menu, IPC      │
└──────────────────────┬──────────────────────────────────┘
                       │ IPC (contextBridge)
                       │
┌──────────────────────┴──────────────────────────────────┐
│                   preload.js                            │
│              window.electronAPI = { ... }               │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│                 Renderer Process                        │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              app.js (App Controller)             │   │
│  │  Coordinates all modules, handles user actions   │   │
│  └──┬──────┬───────┬───────┬───────┬───────┬──────┘   │
│     │      │       │       │       │       │           │
│  ┌──┴──┐┌──┴───┐┌──┴───┐┌─┴──┐┌───┴──┐┌───┴────┐     │
│  │PDF  ││PDF   ││Canvas││Page││Tab   ││UI      │     │
│  │Rend.││Edit. ││Layer ││Mgr.││Mgr.  ││Control.│     │
│  └─────┘└──────┘└──────┘└────┘└──────┘└────────┘     │
│     │      │       │                                    │
│  PDF.js  pdf-lib  Fabric.js                            │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐      │
│  │theme.js  │  │ i18n.js  │  │ signature.js     │      │
│  └──────────┘  └──────────┘  └──────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

### Key Architectural Rules / 關鍵架構規則

1. **App is the coordinator / App 是協調者** — All cross-module operations go through `app.js`. Modules should NOT directly call each other.（所有跨模組操作經由 `app.js`，模組不應直接互相呼叫。）

2. **Global window references / 全域 window 參考** — Module instances are attached to `window` for inter-module access:（模組實例掛載在 `window` 上：）
   ```javascript
   window.app          // App controller
   window.pdfRenderer  // PDFRenderer
   window.pdfEditor    // PDFEditor
   window.canvasLayer  // CanvasLayer
   window.pageManager  // PageManager
   window.tabManager   // TabManager
   window.uiController // UIController
   window.themeManager // ThemeManager
   window.i18n         // I18nManager
   ```

3. **TabManager owns state / TabManager 擁有狀態** — When switching tabs, TabManager saves/restores the complete state of PDFRenderer, PDFEditor, CanvasLayer, and scroll position.（切換分頁時，TabManager 儲存/還原完整狀態。）

4. **Annotations are per-page / 註釋按頁儲存** — `canvasLayer.pageAnnotations` stores Fabric.js JSON keyed by page number. On page switch, current annotations are serialized and stored, then target page annotations are deserialized.（`canvasLayer.pageAnnotations` 以頁碼為鍵儲存 Fabric.js JSON，頁面切換時序列化/反序列化。）

---

## 5. Module Details / 模組詳解

### 5.1 App (`src/js/app.js`) — Main Controller / 主控制器

**Responsibilities / 職責**: Coordinates all modules, handles file operations, keyboard shortcuts, drag-drop, toast notifications.

**Key Methods / 關鍵方法**:

| Method | Description / 說明 |
|---|---|
| `init()` | Initializes all modules in order: Theme → i18n → PDFRenderer → PDFEditor → CanvasLayer → UIController → PageManager → TabManager → SignatureManager.（依序初始化所有模組。） |
| `openFile()` | Opens PDF via Electron dialog. Calls `loadPDF()`.（透過 Electron 對話框開啟 PDF。） |
| `loadPDF(buffer, fileName, filePath)` | **Critical**: Copies buffer with `slice(0)` for both PDF.js and pdf-lib. Creates a new tab.（**關鍵**：使用 `slice(0)` 複製 buffer 給 PDF.js 和 pdf-lib。） |
| `saveFile()` / `saveFileAs()` | Saves current annotations then calls `pdfEditor.save()`.（儲存當前註釋後呼叫 `pdfEditor.save()`。） |
| `rotatePage(direction)` | Rotates in both PDFRenderer (display) and PDFEditor (data). Direction: `1` = CW, `-1` = CCW.（同時旋轉 PDFRenderer（顯示）和 PDFEditor（資料）。） |
| `deletePage()` | Deletes from PDFEditor, reloads PDF from saved bytes, adjusts page number.（從 PDFEditor 刪除，從已儲存的位元組重新載入 PDF。） |
| `duplicatePage()` | Duplicates in PDFEditor, reloads PDF.（在 PDFEditor 中複製，重新載入 PDF。） |
| `insertBlankPage()` | Inserts blank page after current in PDFEditor, reloads PDF.（在 PDFEditor 中於當前頁之後插入空白頁。） |
| `mergePDF()` | Opens multiple files, merges with PDFEditor, reloads.（開啟多個檔案，用 PDFEditor 合併。） |
| `movePage(from, to)` | Moves page in PDFEditor, remaps annotations in CanvasLayer.（移動 PDFEditor 中的頁面，重新映射 CanvasLayer 中的註釋。） |

### 5.2 PDFRenderer (`src/js/pdf-renderer.js`) — PDF Display / PDF 顯示

**Responsibilities / 職責**: Renders PDF pages using PDF.js, manages zoom and rotation display state.

| Method | Description / 說明 |
|---|---|
| `loadPDF(buffer)` | Loads PDF document with PDF.js. Configures worker and CMap paths.（使用 PDF.js 載入 PDF 文件。） |
| `renderPage(pageNum)` | Renders page to the main canvas. Handles rotation (original + user). Uses pending render mechanism to avoid over-rendering.（渲染頁面至主畫布，處理旋轉，使用 pending render 機制避免過度渲染。） |
| `renderThumbnail(pageNum, canvas)` | Renders page thumbnail (max width 120px).（渲染頁面縮圖，最大寬度 120px。） |
| `zoomIn() / zoomOut()` | Scale range: 0.25 to 4.0. Step: 0.15.（縮放範圍：0.25 到 4.0，步長 0.15。） |
| `fitWidth()` | Calculates scale to fit viewport width.（計算適配視口寬度的縮放比例。） |
| `rotatePage(pageNum, degrees)` | Stores user rotation in `pageRotations` map.（將使用者旋轉存入 `pageRotations` 映射。） |

**State / 狀態**: `pdfJsDoc`, `currentPage`, `totalPages`, `scale`, `pageRotations`

### 5.3 PDFEditor (`src/js/pdf-editor.js`) — PDF Manipulation / PDF 操作

**Responsibilities / 職責**: Structural PDF modifications using pdf-lib, annotation embedding on save.

| Method | Description / 說明 |
|---|---|
| `loadPDF(buffer)` | Loads PDF with pdf-lib. Stores `originalBuffer`.（使用 pdf-lib 載入 PDF，儲存 `originalBuffer`。） |
| `rotatePage(pageNum, degrees)` | Modifies actual PDF page rotation attribute.（修改實際的 PDF 頁面旋轉屬性。） |
| `deletePage(pageNum)` | Removes page from PDF (1-indexed).（從 PDF 移除頁面，1 索引。） |
| `duplicatePage(pageNum)` | Copies page within the same PDF.（在同一 PDF 中複製頁面。） |
| `insertBlankPage(afterPage)` | Inserts blank page matching the size of the reference page.（插入與參考頁面相同尺寸的空白頁。） |
| `movePage(from, to)` | Reorders page (0-indexed internally).（重新排序頁面，內部使用 0 索引。） |
| `mergePDFs(buffers)` | Merges multiple PDF buffers into current document.（將多個 PDF buffer 合併至當前文件。） |
| `splitPDF(ranges)` | Extracts pages by range string (e.g., "1-3, 5").（依範圍字串擷取頁面。） |
| `save()` | **Critical**: Calls `applyAnnotations()` then returns PDF bytes.（**關鍵**：呼叫 `applyAnnotations()` 後回傳 PDF 位元組。） |
| `applyAnnotations()` | Iterates all pages. For each page with annotations, creates a temporary Fabric canvas, loads annotation JSON, exports as PNG, embeds as full-page-size image in PDF.（遍歷所有頁面，將有註釋的頁面透過 Fabric 畫布匯出為 PNG，以全頁尺寸嵌入 PDF。） |

**State / 狀態**: `pdfLibDoc`, `originalBuffer`, `currentFilePath`, `modified`

### 5.4 CanvasLayer (`src/js/canvas-layer.js`) — Annotation Layer / 註釋層

**Responsibilities / 職責**: Manages Fabric.js canvas overlay for all annotation tools.

**Supported Tools / 支援工具**:

| Tool | Mode | Behavior / 行為 |
|---|---|---|
| `select` | Selection mode | Select, move, resize, delete objects.（選取、移動、調整大小、刪除物件。） |
| `draw` | Drawing mode | Freehand (`isDrawingMode`), or shapes via mouse events.（自由繪製或透過滑鼠事件繪製形狀。） |
| `text` | Click to add | Creates `IText` object at click position. Shows floating toolbar for font/size/color.（在點擊位置建立 `IText` 物件，顯示浮動工具列。） |
| `image` | Dialog | Opens file dialog, inserts image centered on canvas.（開啟檔案對話框，將圖片置中於畫布。） |
| `highlight` | Drawing mode | Semi-transparent yellow brush (`opacity: 0.3`, `width: 20`).（半透明黃色筆刷。） |
| `signature` | Panel | Opens signature panel, inserts signature image on canvas.（開啟簽名面板，在畫布上插入簽名圖片。） |
| `eraser` | Click to delete | Removes clicked object from canvas.（移除點擊的物件。） |

**Shape Drawing Sub-modes / 形狀繪製子模式**: `freehand`, `line`, `rectangle`, `circle`, `arrow`

**Key Methods / 關鍵方法**:

| Method | Description / 說明 |
|---|---|
| `initCanvas()` | Creates Fabric.js canvas, sets up event listeners.（建立 Fabric.js 畫布，設定事件監聽器。） |
| `setTool(tool)` | Switches tool mode, updates canvas interactivity.（切換工具模式，更新畫布互動性。） |
| `savePageAnnotations()` | Serializes current Fabric canvas to JSON, stores in `pageAnnotations[pageNum]`.（將當前 Fabric 畫布序列化為 JSON，儲存在 `pageAnnotations[pageNum]`。） |
| `loadPageAnnotations(pageNum)` | Clears canvas, deserializes stored JSON for the page.（清除畫布，反序列化該頁面已儲存的 JSON。） |
| `resizeCanvas()` | Syncs Fabric canvas size with PDF canvas dimensions.（同步 Fabric 畫布尺寸與 PDF 畫布尺寸。） |
| `remapAnnotations(from, to)` | Remaps `pageAnnotations` keys when pages are reordered.（頁面重新排序時重新映射 `pageAnnotations` 的鍵。） |

**Text Floating Toolbar / 文字浮動工具列**:
- Appears when editing text objects. Contains font family, font size, bold toggle, color picker.
- Uses `_toolbarInteracting` flag to prevent canvas blur when clicking toolbar controls.
- 編輯文字物件時出現，包含字型、大小、粗體、顏色選擇器。使用 `_toolbarInteracting` 旗標防止點擊工具列時畫布失焦。

**Fabric.js Patch / Fabric.js 修補**:
- Overrides `fabric.Text.prototype._measureLine` to fix text measurement in Fabric.js v5 under Electron.
- 覆寫 `fabric.Text.prototype._measureLine` 以修復 Electron 下 Fabric.js v5 的文字測量問題。

**State / 狀態**: `fabricCanvas`, `pageAnnotations`, `currentTool`, `currentColor`, `currentShape`, `drawingObject`

### 5.5 PageManager (`src/js/page-manager.js`) — Thumbnails & Navigation / 縮圖與導覽

**Responsibilities / 職責**: Renders thumbnail sidebar, handles page navigation and drag-to-reorder.

| Method | Description / 說明 |
|---|---|
| `renderThumbnails()` | Generates thumbnails for all pages. Highlights current page.（為所有頁面產生縮圖，標亮當前頁面。） |
| `goToPage(pageNum)` | Saves current annotations, navigates to target page, loads annotations.（儲存當前註釋，導覽至目標頁面，載入註釋。） |
| `prevPage() / nextPage()` | Navigate with boundary checks.（含邊界檢查的頁面導覽。） |
| `updatePageInfo()` | Updates status bar text "Page X / Y".（更新狀態列文字。） |

**Drag-to-Reorder / 拖放排序**:
- Uses pointer events with 5px movement threshold to distinguish click vs drag.（使用指標事件，5px 移動閾值區分點擊與拖放。）
- Creates a ghost element (thumbnail clone) that follows the cursor.（建立跟隨游標的幽靈元素。）
- Auto-scrolls sidebar when dragging near edges (40px zone, 8px speed).（拖放至邊緣時自動捲動側邊欄。）
- Calls `app.movePage(from, to)` on drop.（放下時呼叫 `app.movePage(from, to)`。）

### 5.6 TabManager (`src/js/tab-manager.js`) — Multi-tab / 多分頁管理

**Responsibilities / 職責**: Manages multiple open PDFs with independent state isolation.

| Method | Description / 說明 |
|---|---|
| `createTab(fileName, filePath)` | Creates new tab, assigns unique ID (`tab-{timestamp}-{random}`).（建立新分頁，指派唯一 ID。） |
| `switchTab(tabId)` | Saves current tab state → restores target tab state → re-renders.（儲存當前分頁狀態 → 還原目標分頁狀態 → 重新渲染。） |
| `closeTab(tabId)` | Checks for unsaved changes, prompts user, removes tab.（檢查未儲存變更，提示使用者，移除分頁。） |
| `markModified() / markSaved()` | Updates tab title with "*" indicator.（更新分頁標題的「*」標記。） |
| `confirmCloseAll()` | Called before app quit. Iterates all tabs to check unsaved changes.（應用程式關閉前呼叫，遍歷所有分頁檢查未儲存變更。） |

**State saved per tab / 每個分頁儲存的狀態**:
```javascript
{
  // PDFRenderer state
  pdfJsDoc, currentPage, totalPages, scale, pageRotations,

  // PDFEditor state
  pdfLibDoc, originalBuffer, currentFilePath, modified,

  // CanvasLayer state
  pageAnnotations,  // { [pageNum]: fabricJSON }

  // UI state
  scrollTop, scrollLeft
}
```

**Tab UI / 分頁 UI**:
- Left-click to switch tab.（左鍵切換分頁。）
- Middle-click or click close button to close.（中鍵或點擊關閉按鈕關閉分頁。）
- Tab bar only visible when 2+ tabs are open.（2 個以上分頁時才顯示分頁列。）

### 5.7 SignatureManager (`src/js/signature.js`) — Signatures / 簽名系統

**Responsibilities / 職責**: Manages signature creation (draw/upload), storage, and application.

**Three tabs / 三個標籤**:
1. **Draw / 手繪** — Canvas-based freehand drawing with adjustable stroke width and color.
2. **Upload / 上傳** — Drag-drop or file dialog for signature images.
3. **Saved / 已儲存** — Gallery of saved signatures with delete option.

**Storage / 儲存**:
- Signatures saved as PNG files in `userData/signatures/` directory via IPC.（簽名以 PNG 格式儲存在 `userData/signatures/` 目錄。）
- File naming: `{UUID}.png`.
- Loaded on app startup via `signature:loadAll` IPC.（應用程式啟動時透過 IPC 載入。）

**Image Processing / 圖片處理**:
- Auto-crops whitespace around signature (boundary detection).（自動裁剪簽名周圍的空白。）
- Converts background color to transparent (alpha = 0).（將背景色轉換為透明。）
- Stores stroke data for re-rendering with original colors/widths.（儲存筆觸資料以保持原始顏色/寬度重繪。）

### 5.8 UIController (`src/js/ui-controller.js`) — UI Interactions / UI 互動

**Responsibilities / 職責**: Tool switching, modals, toolbar state management.

| Method | Description / 說明 |
|---|---|
| `setActiveTool(tool)` | Updates toolbar button styles, calls `canvasLayer.setTool()`.（更新工具列按鈕樣式，呼叫 `canvasLayer.setTool()`。） |
| `showTextModal() / hideTextModal()` | Text input dialog for adding text annotations.（文字輸入對話框。） |
| `showSplitModal() / hideSplitModal()` | Split PDF dialog with page range input.（PDF 分割對話框。） |
| `handleImageTool()` | Opens file dialog for image insertion.（開啟檔案對話框插入圖片。） |

### 5.9 ThemeManager (`src/js/theme.js`) — Themes / 主題

- Detects system theme via Electron `nativeTheme`.（透過 Electron `nativeTheme` 偵測系統主題。）
- Toggles between light/dark by setting `data-theme` attribute on `<html>`.（透過設定 `<html>` 的 `data-theme` 屬性切換明暗主題。）
- Persists choice in `localStorage` (key: `pdfedit-theme`).（持久化選擇至 `localStorage`。）
- Listens for system theme changes via IPC.（透過 IPC 監聽系統主題變更。）

### 5.10 I18nManager (`src/js/i18n.js`) — Internationalization / 國際化

- Supports `zh-TW` (Traditional Chinese) and `en` (English).
- Translation files loaded from `src/locales/` via IPC.（翻譯檔案透過 IPC 從 `src/locales/` 載入。）
- UI elements use `data-i18n` attribute for text content, `data-i18n-title` for tooltips, `data-i18n-placeholder` for input placeholders.（UI 元素使用 `data-i18n` 屬性。）
- `toggleLanguage()` switches between the two languages.（`toggleLanguage()` 在兩種語言間切換。）
- `t(key)` returns the translated string.（`t(key)` 回傳翻譯後的字串。）

---

## 6. Electron IPC / 主進程通信

All IPC communication uses `ipcMain.handle()` (main) / `ipcRenderer.invoke()` (renderer) pattern via the preload bridge.

所有 IPC 通信使用 `ipcMain.handle()` / `ipcRenderer.invoke()` 模式，透過預載橋接。

### File Operations / 檔案操作

| Channel | Direction | Payload → Return / 參數 → 回傳 |
|---|---|---|
| `dialog:openFile` | Renderer → Main | `void` → `{ path, name, buffer }` or `null` |
| `dialog:openFiles` | Renderer → Main | `void` → `[{ path, name, buffer }, ...]` or `null` |
| `dialog:openImage` | Renderer → Main | `void` → `{ name, dataUrl }` or `null` |
| `dialog:saveFile` | Renderer → Main | `{ data: Uint8Array, defaultName: string }` → `filePath` or `null` |
| `file:save` | Renderer → Main | `{ filePath, data: Uint8Array }` → `boolean` |
| `file:read` | Renderer → Main | `filePath` → `buffer` |

### Signature / 簽名

| Channel | Direction | Payload → Return |
|---|---|---|
| `signature:save` | Renderer → Main | `{ id, dataUrl }` → `boolean` |
| `signature:loadAll` | Renderer → Main | `void` → `[{ id, dataUrl }, ...]` |
| `signature:delete` | Renderer → Main | `id` → `boolean` |

### Theme & i18n / 主題與國際化

| Channel | Direction | Payload → Return |
|---|---|---|
| `theme:getSystem` | Renderer → Main | `void` → `"light"` or `"dark"` |
| `theme:changed` | Main → Renderer | `callback(isDark)` — fired on system theme change |
| `i18n:loadTranslations` | Renderer → Main | `lang` → `{ key: value, ... }` |

### Menu Events / 選單事件

| Channel | Direction | Description |
|---|---|---|
| `menu:open-file` | Main → Renderer | User clicked File > Open |
| `menu:save-file` | Main → Renderer | User clicked File > Save |
| `menu:save-file-as` | Main → Renderer | User clicked File > Save As |
| `menu:select-all` | Main → Renderer | User clicked Edit > Select All |

---

## 7. Preload API / 預載 API

The preload script exposes `window.electronAPI` with these methods:

預載腳本透過 `window.electronAPI` 暴露以下方法：

```javascript
window.electronAPI = {
  // File operations / 檔案操作
  openFile(),                    // → { path, name, buffer } | null
  openFiles(),                   // → [{ path, name, buffer }] | null
  openImage(),                   // → { name, dataUrl } | null
  saveFile(data),                // data: { data, defaultName } → filePath | null
  saveFileDirect(data),          // data: { filePath, data } → boolean
  readFile(path),                // → buffer

  // Theme / 主題
  getSystemTheme(),              // → "light" | "dark"
  onSystemThemeChanged(cb),      // cb(isDark: boolean)

  // Menu events / 選單事件
  onMenuOpenFile(cb),
  onMenuSaveFile(cb),
  onMenuSaveFileAs(cb),
  onMenuSelectAll(cb),

  // Signatures / 簽名
  saveSignature(data),           // data: { id, dataUrl } → boolean
  loadAllSignatures(),           // → [{ id, dataUrl }]
  deleteSignature(id),           // → boolean

  // App / 應用
  getUserDataPath(),             // → string
  onBeforeClose(cb),             // cb() — called before window close
  confirmClose()                 // Signals main process to proceed with close
}
```

### Security Configuration / 安全性設定

```javascript
webPreferences: {
  contextIsolation: true,    // Renderer cannot access Node.js
  nodeIntegration: false,    // No require() in renderer
  sandbox: false,            // Allows preload script file access
  preload: 'preload.js'
}
```

---

## 8. Data Structures / 資料結構

### Tab State Object / 分頁狀態物件

```javascript
{
  id: 'tab-1707932400000-abc123',  // Unique tab ID / 唯一分頁 ID
  fileName: 'document.pdf',        // Display name / 顯示名稱
  filePath: '/path/to/file.pdf',   // Full file path / 完整檔案路徑
  modified: false,                  // Has unsaved changes / 是否有未儲存變更

  // PDFRenderer state / PDF 渲染器狀態
  pdfJsDoc: PDFDocumentProxy,      // PDF.js document object
  currentPage: 1,                   // Current page number (1-indexed)
  totalPages: 10,                   // Total page count
  scale: 1.2,                       // Zoom level
  pageRotations: { 1: 90, 3: -90 }, // User-applied rotations (degrees)

  // PDFEditor state / PDF 編輯器狀態
  pdfLibDoc: PDFDocument,           // pdf-lib document object
  originalBuffer: ArrayBuffer,      // Original file buffer

  // CanvasLayer state / 畫布層狀態
  pageAnnotations: {
    1: { version: '5.3.0', objects: [...] },  // Fabric.js serialized JSON
    2: { version: '5.3.0', objects: [...] },
    // ...
  },

  // UI state / UI 狀態
  scrollTop: 0,
  scrollLeft: 0
}
```

### Fabric.js Annotation Objects / Fabric.js 註釋物件

```javascript
// Freehand drawing / 自由繪製
{ type: 'path', path: [...], stroke: '#E07A2F', strokeWidth: 2, fill: '' }

// Text / 文字
{ type: 'i-text', text: 'Hello', fontSize: 16, fontFamily: 'Arial',
  fill: '#E07A2F', fontWeight: 'normal', left: 100, top: 200 }

// Image / 圖片
{ type: 'image', src: 'data:image/png;base64,...', left: 0, top: 0,
  scaleX: 0.5, scaleY: 0.5 }

// Rectangle / 矩形
{ type: 'rect', left: 10, top: 10, width: 100, height: 50,
  stroke: '#E07A2F', strokeWidth: 2, fill: 'transparent' }

// Circle / 圓形
{ type: 'circle', left: 10, top: 10, radius: 50,
  stroke: '#E07A2F', strokeWidth: 2, fill: 'transparent' }

// Line / 直線
{ type: 'line', x1: 0, y1: 0, x2: 100, y2: 100,
  stroke: '#E07A2F', strokeWidth: 2 }

// Arrow / 箭頭 (Group object / 群組物件)
{ type: 'group', objects: [line, triangle], ... }

// Highlight / 螢光筆
{ type: 'path', stroke: '#FFEB3B', strokeWidth: 20, opacity: 0.3 }
```

### Page Rotation / 頁面旋轉

Rotation is tracked in two places:（旋轉在兩處追蹤：）

1. **PDFRenderer** (`pageRotations`): Display-only rotation for rendering. Degrees relative to user actions.（僅用於顯示渲染的旋轉。）
2. **PDFEditor** (pdf-lib): Actual PDF page rotation attribute. Modified via `page.setRotation()`.（實際的 PDF 頁面旋轉屬性。）

Both must be updated together via `app.rotatePage()`.（兩者必須透過 `app.rotatePage()` 同時更新。）

---

## 9. Core Workflows / 核心工作流程

### 9.1 Open PDF / 開啟 PDF

```
User action: Click Open / Drag file / Cmd+O
    │
    ▼
app.openFile()
    │
    ├─ electronAPI.openFile()  →  main.js dialog:openFile
    │                              │
    │                              ▼
    │                          showOpenDialog({ filters: [PDF] })
    │                              │
    │                              ▼
    │                          Read file → return { path, name, buffer }
    │
    ▼
app.loadPDF(buffer, fileName, filePath)
    │
    ├─ buffer.slice(0) → pdfRenderer.loadPDF(copy1)
    ├─ buffer.slice(0) → pdfEditor.loadPDF(copy2)
    ├─ tabManager.createTab(fileName, filePath)
    ├─ pdfRenderer.renderPage(1)
    ├─ canvasLayer.resizeCanvas()
    ├─ canvasLayer.loadPageAnnotations(1)
    └─ pageManager.renderThumbnails()
```

### 9.2 Save PDF / 儲存 PDF

```
User action: Cmd+S / Click Save
    │
    ▼
app.saveFile()
    │
    ├─ canvasLayer.savePageAnnotations()     // Save current page
    ├─ pdfEditor.save()                       // Returns Uint8Array
    │     │
    │     ├─ applyAnnotations()               // For each page:
    │     │     ├─ Create temp Fabric canvas
    │     │     ├─ Load pageAnnotations[i]
    │     │     ├─ Export canvas → PNG dataURL
    │     │     ├─ Embed PNG in PDF page (full page size)
    │     │     └─ Clean up temp canvas
    │     │
    │     └─ pdfLibDoc.save() → Uint8Array
    │
    ├─ If has filePath: electronAPI.saveFileDirect({ filePath, data })
    └─ If new file:     electronAPI.saveFile({ data, defaultName })
```

### 9.3 Switch Tab / 切換分頁

```
User clicks tab
    │
    ▼
tabManager.switchTab(tabId)
    │
    ├─ _saveCurrentState()
    │     ├─ canvasLayer.savePageAnnotations()
    │     ├─ Store pdfRenderer refs: pdfJsDoc, currentPage, scale, pageRotations
    │     ├─ Store pdfEditor refs: pdfLibDoc, originalBuffer, filePath, modified
    │     ├─ Store canvasLayer.pageAnnotations
    │     └─ Store scrollTop, scrollLeft
    │
    ├─ _restoreState(targetTab)
    │     ├─ Restore pdfRenderer refs
    │     ├─ Restore pdfEditor refs
    │     ├─ Restore canvasLayer.pageAnnotations
    │     ├─ pdfRenderer.renderPage(savedPage)
    │     ├─ canvasLayer.resizeCanvas()
    │     ├─ canvasLayer.loadPageAnnotations(savedPage)
    │     ├─ pageManager.renderThumbnails()
    │     └─ Restore scroll position
    │
    └─ Update tab bar UI (active state)
```

### 9.4 Page Reorder (Drag) / 頁面重新排序（拖放）

```
User drags thumbnail
    │
    ├─ pageManager: Create ghost element, track pointer
    ├─ pageManager: Calculate drop target based on thumbnail centers
    ├─ pageManager: Show drop indicator line
    │
    ▼ (on drop)
app.movePage(fromIndex, toIndex)    // 0-indexed
    │
    ├─ canvasLayer.savePageAnnotations()
    ├─ pdfEditor.movePage(from, to)
    ├─ canvasLayer.remapAnnotations(from, to)
    ├─ Reload PDF from pdfEditor.save() bytes
    ├─ Recalculate current page number
    ├─ Render new current page
    └─ Render thumbnails
```

---

## 10. Critical Notes & Workarounds / 重要注意事項

### Buffer Handling / Buffer 處理

**PDF.js transfers (detaches) the ArrayBuffer to its Web Worker**, making the original buffer unusable. Therefore, `app.loadPDF()` must always use `buffer.slice(0)` to create separate copies for PDF.js and pdf-lib.

**PDF.js 會將 ArrayBuffer 轉移（detach）至其 Web Worker**，使原始 buffer 不可用。因此 `app.loadPDF()` 必須使用 `buffer.slice(0)` 為 PDF.js 和 pdf-lib 建立各自的副本。

### PDF.js Worker Patch / PDF.js Worker 修補

The `postinstall` script patches `pdf.worker.mjs` to fix CJK font rendering. The original condition `properties.composite && (properties.cidToGidMap?.length > 0 || !(properties.cMap instanceof IdentityCMap))` is replaced with just `properties.composite`. Without this patch, many Chinese/Japanese/Korean PDF files will render with missing or garbled characters.

`postinstall` 腳本修補 `pdf.worker.mjs` 以修復 CJK 字型渲染。若未套用修補，許多中日韓 PDF 檔案會出現缺字或亂碼。

### Fabric.js Text Measurement / Fabric.js 文字測量

`canvas-layer.js` overrides `fabric.Text.prototype._measureLine` to fix incorrect text width measurement in Fabric.js v5 under Electron's Chromium. Without this fix, text objects may have wrong bounding boxes.

`canvas-layer.js` 覆寫 `fabric.Text.prototype._measureLine` 以修復 Electron 的 Chromium 下 Fabric.js v5 不正確的文字寬度測量。

### Annotation Embedding / 註釋嵌入

Annotations are embedded as **full-page-size PNG images** in the PDF. This means:
- Annotations become part of the PDF and are visible in any PDF viewer.
- Original PDF text beneath annotations remains intact and selectable.
- Each page with annotations adds one PNG image to the file size.

註釋以**全頁尺寸 PNG 圖片**嵌入 PDF。這意味著註釋成為 PDF 的一部分，在任何 PDF 檢視器中可見，原始文字保持完整可選取。

### Page Index Conventions / 頁面索引慣例

- **User-facing**: 1-indexed (Page 1, 2, 3...).（使用者介面：1 索引。）
- **PDFRenderer** (`renderPage`): 1-indexed.
- **PDFEditor** (`deletePage`, `duplicatePage`): 1-indexed.
- **PDFEditor** (`movePage`): 0-indexed.
- **pdf-lib** (`getPages()`): 0-indexed array.
- **pageAnnotations** keys: 1-indexed (string).

> **WARNING**: Be extremely careful with index conversion. Mixing up 0-indexed and 1-indexed is a common source of bugs.
>
> **警告**：請極度小心索引轉換。混淆 0 索引和 1 索引是常見的錯誤來源。

### Memory Management / 記憶體管理

- On tab close, call `pdfJsDoc.destroy()` to release PDF.js resources.（關閉分頁時呼叫 `pdfJsDoc.destroy()` 釋放資源。）
- Each tab holds complete PDF document objects in memory.（每個分頁在記憶體中保存完整的 PDF 文件物件。）

---

## 11. CSS Architecture / CSS 架構

### Theme System / 主題系統

Themes use CSS custom properties defined in `themes.css`:

主題使用 `themes.css` 中定義的 CSS 自訂屬性：

```css
[data-theme="light"] {
  --bg-primary: #FFFFFF;
  --bg-secondary: #F5F5F5;
  --text-primary: #1A1A1A;
  --accent: #E07A2F;
  /* ... */
}

[data-theme="dark"] {
  --bg-primary: #1A1A1E;
  --bg-secondary: #252528;
  --text-primary: #E8E8E8;
  --accent: #E07A2F;
  /* ... */
}
```

The accent color `#E07A2F` is consistent across both themes.（強調色 `#E07A2F` 在兩個主題中一致。）

### Layout Structure / 佈局結構

```
html[data-theme]
└── body
    ├── .title-bar          (52px height, -webkit-app-region: drag)
    ├── .tab-bar            (visible when 2+ tabs)
    ├── .toolbar
    ├── .main-content
    │   ├── .sidebar        (thumbnails, togglable)
    │   └── .pdf-container
    │       ├── #pdf-canvas     (PDF.js rendering)
    │       ├── #fabric-canvas  (Fabric.js overlay)
    │       └── .text-toolbar   (floating, position: absolute)
    ├── .status-bar
    ├── .modal-overlay      (text input, split, unsaved changes)
    └── .signature-panel    (slide-in panel)
```

### Important CSS Notes / 重要 CSS 注意事項

- Title bar uses `-webkit-app-region: drag` for native window dragging on macOS.（標題列使用 `-webkit-app-region: drag` 實現 macOS 原生視窗拖放。）
- Buttons in title bar must have `-webkit-app-region: no-drag`.（標題列中的按鈕必須設定 `no-drag`。）
- The Fabric canvas is positioned absolutely over the PDF canvas with `pointer-events` toggled based on active tool.（Fabric 畫布以絕對定位覆蓋在 PDF 畫布上方。）

---

## 12. Internationalization / 國際化

### Adding a New Language / 新增語言

1. Create a new JSON file in `src/locales/` (e.g., `ja.json`).
2. Copy the structure from `en.json` and translate all values.
3. Update `i18n.js` to include the new language in the toggle cycle.
4. Add the language option to the UI.

### Translation Key Usage / 翻譯鍵使用方式

```html
<!-- Text content / 文字內容 -->
<span data-i18n="open">Open</span>

<!-- Tooltip / 提示文字 -->
<button data-i18n-title="rotateCW" title="Rotate 90° CW">↻</button>

<!-- Placeholder / 佔位文字 -->
<input data-i18n-placeholder="enterText" placeholder="Enter text...">
```

### Interpolation / 插值

The `t()` method supports simple placeholder replacement:

```javascript
i18n.t('pageInfo', { current: 3, total: 10 })
// "第 3 頁 / 共 10 頁" or "Page 3 / 10"
```

Translation string format: `"第 {current} 頁 / 共 {total} 頁"`

---

## Quick Reference for Common Tasks / 常見任務快速參考

| Task / 任務 | Files to Modify / 需修改的檔案 |
|---|---|
| Add a new editing tool / 新增編輯工具 | `canvas-layer.js`, `ui-controller.js`, `index.html`, `style.css`, locale JSONs |
| Add a new page operation / 新增頁面操作 | `pdf-editor.js`, `app.js`, `index.html`, `style.css`, locale JSONs |
| Add a new language / 新增語言 | `src/locales/new-lang.json`, `i18n.js` |
| Modify save behavior / 修改儲存行為 | `pdf-editor.js` (`save()`, `applyAnnotations()`), `app.js` |
| Add new IPC channel / 新增 IPC 通道 | `main.js`, `preload.js`, then call via `window.electronAPI` |
| Modify theme colors / 修改主題顏色 | `src/css/themes.css` |
| Change window config / 修改視窗設定 | `main.js` (`createWindow()`) |
| Add keyboard shortcut / 新增快捷鍵 | `app.js` (`setupKeyboardShortcuts()`) |
