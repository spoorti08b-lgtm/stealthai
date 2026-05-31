// Preload script to safely expose ipcRenderer to the renderer process
window.ipcRenderer = require('electron').ipcRenderer;
