import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import isDev from 'electron-is-dev';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let logWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Create log window (hidden by default)
  logWindow = new BrowserWindow({
    width: 800,
    height: 400,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (isDev) {
    logWindow.loadURL('http://localhost:5173/log.html');
  } else {
    logWindow.loadFile(path.join(__dirname, '../dist/log.html'));
  }

  // Create the application menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Stations',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [{ name: 'Text Files', extensions: ['txt'] }]
            });
            if (!result.canceled) {
              mainWindow.webContents.send('import-stations', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Log Window',
          click: () => {
            if (logWindow.isVisible()) {
              logWindow.hide();
            } else {
              logWindow.show();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.webContents.toggleDevTools();
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Add a console log to verify IPC is working
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Main window loaded');
    mainWindow.webContents.send('test-ipc', 'test');
  });
}

function sendLog(message, type = 'info') {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.webContents.send('log', message, type);
  }
}

ipcMain.on('log', (event, message, type) => {
  sendLog(message, type);
});

// Handle window title updates
ipcMain.on('update-window-title', (event, title) => {
  if (mainWindow) {
    mainWindow.setTitle(title ? `My Radio - ${title}` : 'My Radio');
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// ... rest of the existing code ... 