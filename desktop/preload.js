const { contextBridge, ipcRenderer } = require('electron');

const isWidget = process.argv.includes('--widget');

const bridge = {
  isElectron: true,
  isWidget,

  getState: () => ipcRenderer.invoke('state:get'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  listSystemFonts: () => ipcRenderer.invoke('fonts:list'),
  setWidgetBounds: (bounds) => ipcRenderer.invoke('widget:set-bounds', bounds),
  resetBounds: () => ipcRenderer.invoke('widget:reset-bounds'),
  hideSettings: () => ipcRenderer.send('settings:hide'),
  quitApp: () => ipcRenderer.send('app:quit'),

  onWidgetVisibility: (callback) => {
    ipcRenderer.on('widget:visibility', (_event, visible) => callback(Boolean(visible)));
  },

  onWidgetState: (callback) => {
    ipcRenderer.on('widget:state', (_event, state) => callback(state));
  },

  widgetReady: () => ipcRenderer.send('widget:ready'),

  onGeometry: (callback) => {
    ipcRenderer.on('widget:geometry', (_event, geometry) => callback(geometry));
  }
};

contextBridge.exposeInMainWorld('desktopBridge', bridge);
