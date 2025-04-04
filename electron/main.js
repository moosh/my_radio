const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs');

// Helper function to get stations file path
function getStationsPath() {
  return isDev ? 
    path.join(__dirname, '../stations.txt') : 
    path.join(app.getPath('appData'), 'my_radio', 'stations.txt');
}

function createWindow() {
  console.log('Creating window...');
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the app
  if (isDev) {
    console.log('Loading development URL...');
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log('Loading production file from:', indexPath);
    console.log('File exists:', fs.existsSync(indexPath));
    win.loadFile(indexPath).catch(err => {
      console.error('Failed to load index.html:', err);
      win.webContents.openDevTools();
    });
  }

  // Log any errors
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // Log when the page is ready
  win.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully');
  });

  // Log any console messages from the renderer
  win.webContents.on('console-message', (event, level, message) => {
    console.log('Renderer console:', message);
  });
}

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

app.whenReady().then(() => {
  console.log('App is ready');
  createWindow();
});

app.on('window-all-closed', () => {
  console.log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 