const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  
  // System Metadata
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  
  // Printing APIs
  printThermal: (htmlContent, options) => ipcRenderer.invoke('print-thermal', htmlContent, options),
  
  // Local WebSocket Port
  getWSPort: () => ipcRenderer.invoke('get-ws-port'),

  // Version Check
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});
