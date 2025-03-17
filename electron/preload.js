const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script is running');

contextBridge.exposeInMainWorld('electron', {
  getStationsPath: () => {
    console.log('getStationsPath called');
    return ipcRenderer.invoke('get-stations-path');
  },
  getStationsData: () => {
    console.log('getStationsData called');
    return ipcRenderer.invoke('get-stations-data');
  }
});

console.log('Preload script finished'); 