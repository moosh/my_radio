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
  },
  saveStationsData: (data) => {
    console.log('saveStationsData called');
    return ipcRenderer.invoke('save-stations-data', data);
  },
  openMapWindow: () => {
    console.log('openMapWindow called');
    return ipcRenderer.invoke('open-map-window');
  },
  addStationFromMap: (station) => {
    console.log('addStationFromMap called');
    return ipcRenderer.invoke('add-station-from-map', station);
  },
  on: (channel, callback) => {
    console.log('on called for channel:', channel);
    ipcRenderer.on(channel, callback);
  },
  off: (channel, callback) => {
    console.log('off called for channel:', channel);
    ipcRenderer.removeListener(channel, callback);
  }
});

console.log('Preload script finished'); 