<p align="center">
  <img src="../assets/banner.svg" alt="PDFedit Banner" width="100%">
</p>

<h1 align="center">PDFedit</h1>

<p align="center">
  一款簡約優雅的 PDF 編輯器，使用 Electron 建構。<br>
  在本地編輯 PDF，完全離線運作，保護您的隱私。
</p>

![Platform](https://img.shields.io/badge/平台-macOS%20%7C%20Windows-blue)
![License](https://img.shields.io/badge/授權-MIT-green)
![Electron](https://img.shields.io/badge/electron-28.0.0-blue)

## 功能特色

- 🔓 **完全本地處理** - 無需網路連線，資料不外傳，保護隱私
- 🎨 **亮色/暗色主題** - 自動偵測系統主題，可手動切換
- 🌐 **雙語介面** - 支援繁體中文與英文
- ✍️ **電子簽名** - 手寫簽名、上傳圖片、儲存與管理簽名
- 📝 **編輯工具** - 文字、圖片、手繪、形狀、螢光筆
- 📄 **頁面管理** - 旋轉、刪除、複製、插入空白頁
- 🔀 **多檔操作** - PDF 合併與分割

## 截圖展示

<!-- 在此處新增截圖 -->

## 系統需求

- **Node.js**: 18.0.0 或更高版本
- **npm**: 9.0.0 或更高版本
- **作業系統**: macOS 10.15+ 或 Windows 10+

## 安裝說明

```bash
# 複製專案
git clone https://github.com/yourusername/pdfedit.git

# 進入專案目錄
cd pdfedit

# 安裝相依套件
npm install

# 啟動應用程式
npm start
```

## 建置應用程式

```bash
# 建置 macOS 版本
npm run build:mac

# 建置 Windows 版本
npm run build:win

# 建置所有平台
npm run build
```

## 使用指南

### 開啟檔案
- 點擊標題列的「開啟」按鈕
- 將 PDF 檔案拖放至應用程式視窗
- 使用快捷鍵 `Cmd/Ctrl + O`

### 編輯工具
| 工具 | 說明 |
|------|------|
| 選取 | 選擇並移動畫布上的物件 |
| 文字 | 新增文字註解 |
| 圖片 | 插入圖片 |
| 繪圖 | 手繪、直線、矩形、圓形、箭頭 |
| 螢光筆 | 以透明色彩標記文字 |
| 簽名 | 新增電子簽名 |
| 橡皮擦 | 移除註解 |

### 頁面管理
- **旋轉**: 順時針或逆時針旋轉頁面 90°
- **刪除**: 移除目前頁面
- **複製**: 建立目前頁面的副本
- **插入空白頁**: 在目前頁面後新增空白頁
- **合併**: 將多個 PDF 檔案合併為一
- **分割**: 擷取特定頁面至新的 PDF

### 儲存檔案
- 點擊「儲存」或使用 `Cmd/Ctrl + S` 儲存
- 使用 `Cmd/Ctrl + Shift + S` 另存新檔

## 技術架構

| 函式庫 | 用途 |
|--------|------|
| [Electron](https://www.electronjs.org/) | 桌面應用程式框架 |
| [PDF.js](https://mozilla.github.io/pdf.js/) | PDF 渲染引擎 |
| [pdf-lib](https://pdf-lib.js.org/) | PDF 編輯操作 |
| [Fabric.js](http://fabricjs.com/) | 畫布註解圖層 |
| [pdf-merger-js](https://github.com/nbesli/pdf-merger-js) | PDF 合併功能 |

## 專案結構

```
PDFedit/
├── main.js              # Electron 主程序
├── preload.js           # IPC 預載腳本
├── package.json
├── src/
│   ├── index.html       # 主應用程式視窗
│   ├── css/
│   │   ├── style.css    # 主要樣式
│   │   ├── themes.css   # 主題變數
│   │   └── signature.css
│   ├── js/
│   │   ├── app.js       # 應用程式進入點
│   │   ├── pdf-editor.js
│   │   ├── canvas-layer.js
│   │   ├── page-manager.js
│   │   ├── signature.js
│   │   ├── ui-controller.js
│   │   ├── theme.js
│   │   └── i18n.js
│   └── locales/
│       ├── en.json      # 英文翻譯
│       └── zh-TW.json   # 繁體中文翻譯
└── assets/
    └── icons/           # 應用程式圖示
```

## 鍵盤快捷鍵

| 快捷鍵 | 功能 |
|--------|------|
| `Cmd/Ctrl + O` | 開啟檔案 |
| `Cmd/Ctrl + S` | 儲存檔案 |
| `Cmd/Ctrl + Shift + S` | 另存新檔 |
| `Cmd/Ctrl + +` | 放大 |
| `Cmd/Ctrl + -` | 縮小 |
| `Cmd/Ctrl + 0` | 適合寬度 |
| `←` / `PageUp` | 上一頁 |
| `→` / `PageDown` | 下一頁 |
| `Delete` / `Backspace` | 刪除選取物件 |
| `Escape` | 取消選取 / 關閉對話框 |

## 授權條款

本專案採用 MIT 授權條款 - 詳見 [LICENSE](../LICENSE) 檔案。

---

**[English Documentation](../README.md)**
