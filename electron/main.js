const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { scrapeWfmuPlaylists } = require('./wfmuParserNode');

let mainWindow;
let mapWindow;

// Helper function to get stations file path
function getStationsPath() {
  return isDev ? 
    path.join(__dirname, '../stations_list.json') : 
    path.join(app.getPath('appData'), 'my_radio', 'stations_list.json');
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

  // if (isDev) {
  //   mainWindow.webContents.openDevTools();
  // }

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
ipcMain.handle('save-stations-data', async (event, data, filename) => {
  let filePath;
  if (filename) {
    filePath = isDev
      ? path.join(__dirname, '..', filename)
      : path.join(app.getPath('appData'), 'my_radio', filename);
  } else {
    filePath = getStationsPath();
  }
  console.log('Saving stations to:', filePath);
  try {
    // Ensure directory exists in production
    if (!isDev) {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    fs.writeFileSync(filePath, data, 'utf8');
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

// Add this function near the other IPC handlers
ipcMain.handle('fetch-stream-metadata', async (event, url) => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Icy-MetaData': '1',  // Request metadata updates
        'Accept': '*/*'
      }
    }, (res) => {
      // Get the metadata interval
      const metaInt = parseInt(res.headers['icy-metaint']);
      
      // Parse technical info from ice-audio-info
      const audioInfo = res.headers['ice-audio-info'];
      const audioInfoParts = audioInfo ? Object.fromEntries(
        audioInfo.split(';')
          .map(part => part.trim().split('='))
          .filter(([key]) => ['ice-samplerate', 'ice-bitrate', 'ice-channels'].includes(key))
      ) : {};

      const metadata = {
        name: res.headers['icy-name'],
        bitrate: res.headers['icy-br'] || audioInfoParts['ice-bitrate'],
        genre: res.headers['icy-genre'],
        description: res.headers['icy-description'],
        url: res.headers['icy-url'],
        currentSong: '',  // Will be updated from stream metadata
        format: res.headers['content-type'] || res.headers['icy-format'],
        channels: res.headers['ice-channels'] || audioInfoParts['ice-channels'],
        samplerate: audioInfoParts['ice-samplerate'],
        public: res.headers['icy-pub'],
        streamTitle: res.headers['icy-stream-title']
      };

      // If we have a metadata interval, set up metadata reading
      if (metaInt) {
        let buffer = Buffer.alloc(0);
        let bytesRead = 0;

        res.on('data', (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);
          
          while (buffer.length >= metaInt + 1) {
            // Get the metadata length byte
            const metaLength = buffer[metaInt] * 16;
            
            if (metaLength > 0 && buffer.length >= metaInt + 1 + metaLength) {
              // Extract metadata
              const metaData = buffer.slice(metaInt + 1, metaInt + 1 + metaLength).toString();
              
              // Parse StreamTitle
              const titleMatch = metaData.match(/StreamTitle='([^']*)'/);
              if (titleMatch) {
                metadata.currentSong = titleMatch[1];
                // Send metadata update to renderer
                if (mainWindow) {
                  mainWindow.webContents.send('metadata-update', metadata);
                }
              }
            }
            
            // Remove processed data from buffer
            buffer = buffer.slice(metaInt + 1 + (metaLength || 0));
          }
        });

        // Start reading a small amount of data to get initial metadata
        res.once('readable', () => {
          const chunk = res.read(metaInt * 2);
          if (chunk) {
            buffer = chunk;
          }
          // Destroy the connection after getting initial metadata
          setTimeout(() => {
            req.destroy();
            resolve(metadata);
          }, 1000);
        });
      } else {
        // No metadata interval, just return headers
        req.destroy();
        resolve(metadata);
      }
    });

    req.on('error', (error) => {
      reject(error);
    });
  });
});

// Handle scraping WFMU playlists in the main process
ipcMain.handle('scrape-wfmu-playlists', async (event, url) => {
  return await scrapeWfmuPlaylists(url);
});

// Handle scraping WFMU playlists with progress reporting
ipcMain.handle('scrape-wfmu-playlists-with-progress', async (event, url) => {
  const progressChannel = 'wfmu-scrape-progress';
  let lastCurrent = 0;
  let lastTotal = 0;
  function progressCallback(current, total) {
    lastCurrent = current;
    lastTotal = total;
    event.sender.send(progressChannel, current, total);
  }
  // Remove the 4 item limit by not passing maxEntries
  const result = await scrapeWfmuPlaylists(url, undefined, progressCallback);
  if (lastTotal > 0 && lastCurrent !== lastTotal) {
    event.sender.send(progressChannel, lastTotal, lastTotal);
  }
  return result;
}); 