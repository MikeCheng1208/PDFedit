<p align="center">
  <img src="../assets/banner.svg" alt="PDFedit Banner" width="100%">
</p>

<h1 align="center">PDFedit</h1>

<p align="center">
  極簡優雅的 PDF 編輯器，使用 Electron 建構。<br>
  完全本地處理，無需網路連線，保障您的隱私。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/平台-macOS%20%7C%20Windows-blue" alt="Platform">
  <img src="https://img.shields.io/badge/授權-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/Electron-28.0.0-blue" alt="Electron">
  <img src="https://img.shields.io/badge/語言-EN%20%7C%20繁中-orange" alt="Language">
</p>

<p align="center">
  <a href="../README.md">English Documentation</a>
</p>

---

## 功能特色

- **完全本地處理** — 資料不會上傳至雲端，永遠留在您的裝置上。
- **明暗主題** — 自動偵測系統主題，可手動切換。
- **雙語介面** — 支援繁體中文與英文。
- **電子簽名** — 手繪簽名、上傳圖片、儲存與管理簽名。
- **編輯工具** — 文字、圖片、手繪、形狀（直線、矩形、圓形、箭頭）、螢光筆、橡皮擦。
- **頁面管理** — 旋轉、刪除、複製、插入空白頁、拖放排序。
- **多檔操作** — 合併與分割 PDF。
- **多分頁編輯** — 同時編輯多個 PDF，各分頁狀態獨立。

---

## 支援系統

| 平台 | 架構 | 檔案格式 | 最低版本 |
|---|---|---|---|
| **macOS** | Apple Silicon (arm64) | `.dmg` / `.zip` | macOS 10.15 (Catalina)+ |
| **Windows** | x64 (Intel / AMD) | `.exe` 安裝程式 | Windows 10+ |

> **注意**：macOS 版本未經程式碼簽署，首次開啟時需至「系統偏好設定 > 安全性與隱私」中手動允許。

---

## 安裝

### 前置需求

- **Node.js** 18.0.0+
- **npm** 9.0.0+

### 設定

```bash
# 複製專案
git clone https://github.com/MikeCheng1208/PDFedit.git
cd PDFedit

# 安裝依賴
npm install

# 啟動開發模式
npm start
```

### 建置

```bash
# 建置 macOS 版本
npm run build:mac

# 建置 Windows 版本 (x64)
npm run build:win

# 建置所有平台
npm run build
```

建置產物在 `dist/` 目錄中。

---

## 使用指南

### 開啟檔案
- 點擊標題列的「開啟」按鈕
- 拖放 PDF 檔案至應用程式視窗
- 快捷鍵 `Cmd/Ctrl + O`

### 編輯工具

| 工具 | 說明 |
|---|---|
| 選取 | 選取、移動、調整物件大小 |
| 文字 | 新增文字，支援字型、大小、顏色調整 |
| 圖片 | 插入圖片（PNG、JPG、GIF、WebP） |
| 繪圖 | 自由繪製、直線、矩形、圓形、箭頭 |
| 螢光筆 | 半透明螢光標記 |
| 簽名 | 手繪或上傳電子簽名 |
| 橡皮擦 | 刪除註釋 |

### 頁面管理
- **旋轉** — 順時針或逆時針旋轉 90°
- **刪除** — 刪除當前頁面（至少保留 1 頁）
- **複製** — 複製當前頁面
- **插入空白頁** — 在當前頁之後插入空白頁
- **合併** — 合併多個 PDF 檔案
- **分割** — 擷取指定頁面範圍（例如：`1-3, 5, 7-10`）
- **拖放排序** — 拖放縮圖重新排序頁面

### 儲存
- `Cmd/Ctrl + S` — 儲存
- `Cmd/Ctrl + Shift + S` — 另存新檔

---

## 鍵盤快捷鍵

| 快捷鍵 | 動作 |
|---|---|
| `Cmd/Ctrl + O` | 開啟檔案 |
| `Cmd/Ctrl + S` | 儲存 |
| `Cmd/Ctrl + Shift + S` | 另存新檔 |
| `Cmd/Ctrl + W` | 關閉當前分頁 |
| `Cmd/Ctrl + +` | 放大 |
| `Cmd/Ctrl + -` | 縮小 |
| `Cmd/Ctrl + 0` | 適合寬度 |
| `←` / `PageUp` | 上一頁 |
| `→` / `PageDown` | 下一頁 |
| `Delete` / `Backspace` | 刪除選取物件 |
| `Escape` | 取消選取 / 關閉對話框 |

---

## 技術棧

| 函式庫 | 用途 |
|---|---|
| [Electron](https://www.electronjs.org/) | 桌面應用框架 |
| [PDF.js](https://mozilla.github.io/pdf.js/) | PDF 渲染顯示 |
| [pdf-lib](https://pdf-lib.js.org/) | PDF 結構操作 |
| [Fabric.js](http://fabricjs.com/) | 畫布註釋層 |
| [pdf-merger-js](https://github.com/nbesli/pdf-merger-js) | PDF 合併 |

---

## 專案結構

```
PDFedit/
├── main.js                  # Electron 主進程
├── preload.js               # 預載腳本（IPC 橋接）
├── package.json             # 專案設定
├── SPEC.md                  # AI 可讀規格文件
├── src/
│   ├── index.html           # 應用程式入口
│   ├── js/
│   │   ├── app.js           # 主控制器
│   │   ├── pdf-renderer.js  # PDF 渲染（PDF.js）
│   │   ├── pdf-editor.js    # PDF 編輯（pdf-lib）
│   │   ├── canvas-layer.js  # 註釋層（Fabric.js）
│   │   ├── page-manager.js  # 縮圖與導覽
│   │   ├── tab-manager.js   # 多分頁管理
│   │   ├── signature.js     # 簽名系統
│   │   ├── ui-controller.js # UI 互動控制
│   │   ├── theme.js         # 主題管理
│   │   └── i18n.js          # 國際化
│   ├── css/
│   │   ├── style.css        # 主樣式
│   │   ├── themes.css       # 主題變數
│   │   └── signature.css    # 簽名面板樣式
│   ├── locales/
│   │   ├── zh-TW.json       # 繁體中文
│   │   └── en.json          # 英文
│   └── lib/                 # 第三方函式庫
└── assets/
    └── icons/               # 應用程式圖示
```

---

## AI 輔助開發

如果您打算使用 AI 工具（如 Claude、ChatGPT、Cursor 等）來修改或擴充本專案，**請先讓 AI 讀取 [`SPEC.md`](../SPEC.md)**，再進行任何修改。該規格文件包含完整的架構說明、模組關係、資料結構與關鍵實作細節，能有效降低 AI 修改時產生的錯誤。

**範例提示詞：**
> 請先閱讀 SPEC.md 了解專案架構，然後幫我 [你的需求]。

---

## 授權

本專案採用 [MIT 授權條款](../LICENSE)。
