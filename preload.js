const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  openImage: () => ipcRenderer.invoke('dialog:openImage'),
  saveFile: (data) => ipcRenderer.invoke('dialog:saveFile', data),
  saveFileDirect: (data) => ipcRenderer.invoke('file:save', data),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),

  // Theme
  getSystemTheme: () => ipcRenderer.invoke('theme:getSystem'),
  onSystemThemeChanged: (callback) => {
    ipcRenderer.on('theme:systemChanged', (event, theme) => callback(theme));
  },

  // Menu events
  onMenuOpenFile: (callback) => {
    ipcRenderer.on('menu-open-file', () => callback());
  },
  onMenuSaveFile: (callback) => {
    ipcRenderer.on('menu-save-file', () => callback());
  },
  onMenuSaveFileAs: (callback) => {
    ipcRenderer.on('menu-save-file-as', () => callback());
  },
  onMenuSelectAll: (callback) => {
    ipcRenderer.on('menu-select-all', () => callback());
  },

  // App paths
  getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),

  // Signature management
  saveSignature: (data) => ipcRenderer.invoke('signature:save', data),
  loadAllSignatures: () => ipcRenderer.invoke('signature:loadAll'),
  deleteSignature: (id) => ipcRenderer.invoke('signature:delete', id),

  // i18n
  loadTranslations: (lang) => ipcRenderer.invoke('i18n:loadTranslations', lang),

  // Window close
  onBeforeClose: (callback) => {
    ipcRenderer.on('app-before-close', () => callback());
  },
  confirmClose: () => ipcRenderer.send('app-confirm-close')
});
