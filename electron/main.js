const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs');

let mainWindow;
let mapWindow;

// Helper function to get stations file path
function getStationsPath() {
  return isDev ? 
    path.join(__dirname, '../stations.txt') : 
    path.join(app.getPath('appData'), 'my_radio', 'stations.txt');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,  // Matches Material-UI md breakpoint
    height: 800,
    minWidth: 900,  // Prevent resizing below card width
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadURL(
    isDev
      ? 'http://localhost:5173'
      : `file://${path.join(__dirname, '../dist/index.html')}`
  );

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMapWindow() {
  mapWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mapWindow.loadURL(
    isDev
      ? 'http://localhost:5173/map.html'
      : `file://${path.join(__dirname, '../dist/map.html')}`
  );

  if (isDev) {
    mapWindow.webContents.openDevTools();
  }

  mapWindow.on('closed', () => {
    mapWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle IPC calls
ipcMain.handle('get-stations-data', () => {
  const stationsPath = getStationsPath();
  console.log('Reading stations from:', stationsPath);
  console.log('File exists:', fs.existsSync(stationsPath));

  try {
    const data = fs.readFileSync(stationsPath, 'utf8');
    console.log('Successfully read stations file, length:', data.length);
    return data;
  } catch (error) {
    console.error('Error reading stations file:', error);
    return '';
  }
});

// Handle saving stations data
ipcMain.handle('save-stations-data', async (event, data) => {
  const stationsPath = getStationsPath();
  console.log('Saving stations to:', stationsPath);

  try {
    // Ensure directory exists in production
    if (!isDev) {
      const dir = path.dirname(stationsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // Write the data
    fs.writeFileSync(stationsPath, data, 'utf8');
    console.log('Successfully saved stations file');
    return true;
  } catch (error) {
    console.error('Error saving stations file:', error);
    return false;
  }
});

// Handle opening map window
ipcMain.handle('open-map-window', () => {
  if (!mapWindow) {
    createMapWindow();
  } else {
    mapWindow.focus();
  }
});

// Handle adding station from map to main window
ipcMain.handle('add-station-from-map', (event, station) => {
  if (mainWindow) {
    mainWindow.webContents.send('new-station-from-map', station);
  }
}); 