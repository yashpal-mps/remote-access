const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');
const robot = require('robotjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

let mainWindow;
const isDevelopment = process.env.NODE_ENV !== 'production';

// Enable screen capture permissions on macOS
if (process.platform === 'darwin') {
  app.whenReady().then(() => {
    // Request screen recording permission on macOS
    const { systemPreferences } = require('electron');
    systemPreferences.getMediaAccessStatus('screen');
  });
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    minWidth: 800,
    minHeight: 600,
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
  });

  // Load the app
  if (isDevelopment) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load built files
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  console.log('[Electron Main] Window created');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// Generate session ID and return config
ipcMain.handle('start-host', async () => {
  const sessionId = Math.random().toString(36).substring(2, 10).toUpperCase();
  console.log('[Electron Main] Host started with session ID:', sessionId);
  return {
    sessionId,
    signalingUrl: process.env.SIGNALING_URL || 'ws://localhost:3000',
  };
});

// Get screen sources for capture
ipcMain.handle('get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    console.log('[Electron Main] Screen sources found:', sources.length);
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
    }));
  } catch (error) {
    console.error('[Electron Main] Error getting screen sources:', error);
    throw error;
  }
});

// Execute input commands using robotjs
ipcMain.handle('execute-input', async (event, data) => {
  try {
    switch (data.type) {
      case 'mousemove': {
        const screenSize = robot.getScreenSize();
        const x = Math.floor(data.x * screenSize.width);
        const y = Math.floor(data.y * screenSize.height);
        robot.moveMouse(x, y);
        break;
      }

      case 'mousedown': {
        const button = data.button === 'right' ? 'right' : 'left';
        robot.mouseToggle('down', button);
        break;
      }

      case 'mouseup': {
        const button = data.button === 'right' ? 'right' : 'left';
        robot.mouseToggle('up', button);
        break;
      }

      case 'click': {
        const button = data.button === 'right' ? 'right' : 'left';
        robot.mouseClick(button);
        break;
      }

      case 'scroll': {
        const direction = data.deltaY > 0 ? 'down' : 'up';
        robot.scrollMouse(1, direction);
        break;
      }

      case 'keydown': {
        const key = mapKey(data.key);
        const modifiers = data.modifiers || [];
        robot.keyTap(key, modifiers);
        break;
      }

      case 'double-click': {
        const button = data.button === 'right' ? 'right' : 'left';
        robot.mouseClick(button, true);
        break;
      }

      default:
        console.warn('[Electron Main] Unknown input type:', data.type);
    }
    return { success: true };
  } catch (error) {
    console.error('[Electron Main] Error executing input:', error);
    return { success: false, error: error.message };
  }
});

// Map browser keys to robotjs keys
function mapKey(key) {
  const keyMap = {
    'Enter': 'return',
    'Backspace': 'backspace',
    'Delete': 'delete',
    'Tab': 'tab',
    'Escape': 'escape',
    'ArrowUp': 'up',
    'ArrowDown': 'down',
    'ArrowLeft': 'left',
    'ArrowRight': 'right',
    ' ': 'space',
    'Control': 'control',
    'Alt': 'alt',
    'Meta': 'command',
    'Shift': 'shift',
  };
  return keyMap[key] || key.toLowerCase();
}

// Get signaling URL
ipcMain.handle('get-config', async () => {
  return {
    signalingUrl: process.env.SIGNALING_URL || 'ws://localhost:3000',
    stunServers: (process.env.STUN_SERVERS || 'stun:stun.l.google.com:19302').split(','),
    turnConfig: process.env.TURN_SERVER_IP
      ? {
          urls: `turn:${process.env.TURN_SERVER_IP}:${process.env.TURN_PORT}`,
          username: process.env.TURN_USERNAME,
          credential: process.env.TURN_PASSWORD,
        }
      : null,
    maxFps: parseInt(process.env.WEBRTC_MAX_FPS) || 30,
  };
});

// Log messages from renderer
ipcMain.on('log', (event, level, message) => {
  console.log(`[Renderer ${level}]`, message);
});

console.log('[Electron Main] Application initialized');
console.log('[Electron Main] Platform:', process.platform);
console.log('[Electron Main] Node env:', process.env.NODE_ENV || 'development');
