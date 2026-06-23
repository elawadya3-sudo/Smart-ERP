const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const WebSocket = require('ws');

let mainWindow = null;
let splashWindow = null;
let wsServer = null;

// WS Port configuration
const WS_PORT = 8085;

// Load or generate Device Configuration
const configPath = path.join(app.getPath('userData'), 'pos_config.json');
let posConfig = {
  deviceId: '',
  deviceName: ''
};

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      posConfig = JSON.parse(data);
    } else {
      posConfig.deviceId = 'DEV-' + generateUUID().slice(0, 8).toUpperCase();
      posConfig.deviceName = os.hostname() || 'Desktop POS Terminal';
      fs.writeFileSync(configPath, JSON.stringify(posConfig, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('Failed to load desktop POS configuration:', err);
    posConfig.deviceId = 'DEV-TEMP-999';
    posConfig.deviceName = 'Fallback POS Terminal';
  }
}

// Initialize Local WebSocket Server for hardware/sync integrations
function startWebSocketServer() {
  try {
    wsServer = new WebSocket.Server({ port: WS_PORT });
    console.log(`Local POS WebSocket Server running on port ${WS_PORT}`);
    
    wsServer.on('connection', (ws) => {
      console.log('Local hardware client connected to WebSocket.');
      
      // Send greeting
      ws.send(JSON.stringify({
        type: 'CONNECTION_ESTABLISHED',
        deviceId: posConfig.deviceId,
        deviceName: posConfig.deviceName,
        timestamp: new Date().toISOString()
      }));

      ws.on('message', (message) => {
        try {
          const parsed = JSON.parse(message);
          console.log('WS Message received:', parsed);
          // Broadcast to other connections or handle locally
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('ws-message', parsed);
          }
        } catch (e) {
          console.error('Failed to parse WS message:', e);
        }
      });

      ws.on('close', () => {
        console.log('Local hardware client disconnected.');
      });
    });
  } catch (err) {
    console.error('Failed to start WebSocket Server:', err);
  }
}

// Create Windows
function createWindows() {
  // 1. Create Splash/Loading Window
  splashWindow = new BrowserWindow({
    width: 500,
    height: 380,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  
  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });

  // 2. Create Main POS App Window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false, // Keep hidden until page loads
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load URL depending on dev/prod mode
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // When content finishes loading, hide splash and show main window
  mainWindow.webContents.once('did-finish-load', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Setup IPC Listeners
function setupIPC() {
  ipcMain.handle('get-system-info', () => {
    return {
      deviceId: posConfig.deviceId,
      deviceName: posConfig.deviceName,
      platform: process.platform,
      arch: process.arch,
      hostname: os.hostname(),
      cpuCount: os.cpus().length,
      freeMemoryGB: Math.round(os.freemem() / (1024 * 1024 * 1024))
    };
  });

  ipcMain.handle('get-app-version', () => {
    return app.isPackaged ? 'v' + app.getVersion() : 'v1.0.0-dev';
  });

  ipcMain.handle('get-ws-port', () => {
    return WS_PORT;
  });

  // Direct silent printing for thermal receipts
  ipcMain.handle('print-thermal', async (event, htmlContent, options = {}) => {
    return new Promise((resolve) => {
      let printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false
        }
      });

      printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

      printWindow.webContents.once('did-finish-load', () => {
        printWindow.webContents.print({
          silent: true,
          printBackground: true,
          deviceName: options.printerName || '', // empty prints to system default
          color: false,
          margins: { marginType: 'none' },
          pageSize: options.paperSize === '58mm' ? { width: 58000, height: 200000 } : { width: 80000, height: 250000 }
        }, (success, errorType) => {
          printWindow.destroy();
          if (success) {
            resolve({ success: true });
          } else {
            console.error('Silent printing failed:', errorType);
            resolve({ success: false, error: errorType });
          }
        });
      });
    });
  });
}

// App lifecycle
app.whenReady().then(() => {
  loadConfig();
  startWebSocketServer();
  setupIPC();
  createWindows();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindows();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
