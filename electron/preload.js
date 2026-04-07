const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Start hosting - returns session ID and config
  startHost: () => ipcRenderer.invoke('start-host'),

  // Get available screen sources
  getScreenSources: () => ipcRenderer.invoke('get-sources'),

  // Execute input command on host machine
  executeInput: (data) => ipcRenderer.invoke('execute-input', data),

  // Get app configuration
  getConfig: () => ipcRenderer.invoke('get-config'),

  // Send log messages to main process
  log: (level, message) => ipcRenderer.send('log', level, message),

  // Listen for messages from main process
  onMessage: (channel, callback) => {
    const validChannels = ['input-received'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
});

console.log('[Preload] electronAPI exposed to renderer');
