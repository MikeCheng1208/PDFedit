const { app, BrowserWindow, ipcMain, dialog, nativeTheme, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 18 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1A1A1E' : '#FEFBF6',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile('src/index.html');

  // Disable default pinch-to-zoom so we can handle it in the renderer
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1);

  // Intercept window close to check for unsaved changes
  mainWindow.on('close', (e) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      e.preventDefault();
      mainWindow.webContents.send('app-before-close');
    }
  });

  // Open DevTools in development or with --devtools flag
  if (process.argv.includes('--dev') || process.argv.includes('--devtools')) {
    mainWindow.webContents.openDevTools();
  }

  // Log any renderer errors
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2) { // Warning or Error
      console.log(`[Renderer] ${message}`);
    }
  });
}

// Create application menu
function createMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('menu-open-file')
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu-save-file')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow.webContents.send('menu-save-file-as')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: () => mainWindow?.webContents.send('menu-select-all')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' }
        ] : [
          { role: 'close' }
        ])
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

// IPC Handlers

// Confirm close (all unsaved changes handled by renderer)
ipcMain.on('app-confirm-close', () => {
  if (mainWindow) {
    mainWindow.destroy();
    mainWindow = null;
  }
  if (isQuitting) {
    app.quit();
  }
});

// Open file dialog
ipcMain.handle('dialog:openFile', async () => {
  console.log('[Main] dialog:openFile called');
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] }
      ]
    });

    console.log('[Main] dialog result:', result);

    if (result.canceled) {
      return null;
    }

    const filePath = result.filePaths[0];
    console.log('[Main] Reading file:', filePath);
    const fileBuffer = fs.readFileSync(filePath);
    console.log('[Main] File read successfully, size:', fileBuffer.length);
    return {
      path: filePath,
      name: path.basename(filePath),
      buffer: fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength)
    };
  } catch (error) {
    console.error('[Main] Error in dialog:openFile:', error);
    throw error;
  }
});

// Open multiple files dialog
ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'PDF Files', extensions: ['pdf'] }
    ]
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths.map(filePath => {
    const fileBuffer = fs.readFileSync(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      buffer: fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength)
    };
  });
});

// Open image dialog
ipcMain.handle('dialog:openImage', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }
    ]
  });

  if (result.canceled) {
    return null;
  }

  const filePath = result.filePaths[0];
  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase().slice(1);
  const base64 = fileBuffer.toString('base64');
  const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;

  return {
    path: filePath,
    name: path.basename(filePath),
    dataUrl: `data:${mimeType};base64,${base64}`
  };
});

// Save file dialog
ipcMain.handle('dialog:saveFile', async (event, { buffer, defaultPath }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultPath || 'document.pdf',
    filters: [
      { name: 'PDF Files', extensions: ['pdf'] }
    ]
  });

  if (result.canceled) {
    return null;
  }

  fs.writeFileSync(result.filePath, Buffer.from(buffer));
  return result.filePath;
});

// Save file directly (without dialog)
ipcMain.handle('file:save', async (event, { buffer, filePath }) => {
  try {
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Read file
ipcMain.handle('file:read', async (event, filePath) => {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return {
      buffer: fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength)
    };
  } catch (error) {
    return { error: error.message };
  }
});

// Get system theme
ipcMain.handle('theme:getSystem', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

// Watch for system theme changes
nativeTheme.on('updated', () => {
  mainWindow?.webContents.send('theme:systemChanged', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
});

// Get user data path for storing signatures
ipcMain.handle('app:getUserDataPath', () => {
  return app.getPath('userData');
});

// Save signature to user data
ipcMain.handle('signature:save', async (event, { id, dataUrl }) => {
  const signaturesDir = path.join(app.getPath('userData'), 'signatures');
  if (!fs.existsSync(signaturesDir)) {
    fs.mkdirSync(signaturesDir, { recursive: true });
  }

  const filePath = path.join(signaturesDir, `${id}.png`);
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

  return { success: true, path: filePath };
});

// Load all saved signatures
ipcMain.handle('signature:loadAll', async () => {
  const signaturesDir = path.join(app.getPath('userData'), 'signatures');
  if (!fs.existsSync(signaturesDir)) {
    return [];
  }

  const files = fs.readdirSync(signaturesDir).filter(f => f.endsWith('.png'));
  return files.map(file => {
    const filePath = path.join(signaturesDir, file);
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');
    return {
      id: path.basename(file, '.png'),
      dataUrl: `data:image/png;base64,${base64}`
    };
  });
});

// Delete signature
ipcMain.handle('signature:delete', async (event, id) => {
  const filePath = path.join(app.getPath('userData'), 'signatures', `${id}.png`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return { success: true };
  }
  return { success: false, error: 'File not found' };
});

// Load translations
ipcMain.handle('i18n:loadTranslations', async (event, lang) => {
  try {
    const filePath = path.join(__dirname, 'src', 'locales', `${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
});
