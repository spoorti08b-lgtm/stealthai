const { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow = null;
let isClickThrough = false;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width: width,
    height: height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    maximizable: false,
    minimizable: true,
    hasShadow: false,
    skipTaskbar: false,
    title: "StealthAI",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  // Capture renderer console messages and print them to terminal
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER CONSOLE] ${message} (from ${sourceId}:${line})`);
  });

  // Let mouse events pass through transparent areas to background apps by default,
  // but forward hover events so we can detect when mouse enters the floating panel.
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent flash on loading
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}


let isStealthMode = false;

// Register global shortcuts after app is ready
function registerShortcuts() {
  // Ctrl+Shift+H to toggle Stealth Mode
  const stealthRegistered = globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (mainWindow) {
      isStealthMode = !isStealthMode;
      mainWindow.setContentProtection(isStealthMode);
      mainWindow.webContents.send('stealth-mode-toggled', isStealthMode);
    }
  });

  if (!stealthRegistered) {
    console.log('Stealth shortcut registration failed');
  }

  // Ctrl+Shift+Space to toggle Show/Hide window
  const hideShowRegistered = globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  if (!hideShowRegistered) {
    console.log('Hide/Show shortcut registration failed');
  }

  // Ctrl+Shift+K to toggle mouse click-through
  const clickThroughRegistered = globalShortcut.register('CommandOrControl+Shift+K', () => {
    if (mainWindow) {
      isClickThrough = !isClickThrough;
      mainWindow.setIgnoreMouseEvents(isClickThrough, { forward: true });
      mainWindow.webContents.send('click-through-toggled', isClickThrough);
    }
  });

  if (!clickThroughRegistered) {
    console.log('Click-through shortcut registration failed');
  }

  // Ctrl+Shift+, to toggle settings modal
  const settingsToggleRegistered = globalShortcut.register('CommandOrControl+Shift+,', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-settings-panel');
    }
  });

  if (!settingsToggleRegistered) {
    console.log('Settings toggle shortcut registration failed');
  }

  // Ctrl+Shift+C to clear conversation
  const clearRegistered = globalShortcut.register('CommandOrControl+Shift+C', () => {
    if (mainWindow) {
      mainWindow.webContents.send('clear-conversation');
    }
  });

  if (!clearRegistered) {
    console.log('Clear conversation shortcut registration failed');
  }

  // Ctrl+Shift+F to toggle compact/full mode
  const compactRegistered = globalShortcut.register('CommandOrControl+Shift+F', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-compact-mode');
    }
  });

  if (!compactRegistered) {
    console.log('Compact mode shortcut registration failed');
  }

  // Ctrl+Shift+O to toggle opacity popup
  const opacityRegistered = globalShortcut.register('CommandOrControl+Shift+O', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-opacity-popup');
    }
  });

  if (!opacityRegistered) {
    console.log('Opacity shortcut registration failed');
  }

  // Ctrl+Shift+S to trigger screen capture
  const captureRegistered = globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (mainWindow) {
      mainWindow.webContents.send('trigger-screen-capture');
    }
  });

  if (!captureRegistered) {
    console.log('Screen capture shortcut registration failed');
  }
}


app.whenReady().then(() => {
  // We can disable hardware acceleration if transparency glitches,
  // but usually it works fine. If you run into black background issues,
  // uncomment the next line:
  // app.disableHardwareAcceleration();

  createWindow();
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

// IPC communication channel handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('set-opacity', (event, opacity) => {
  if (mainWindow) {
    mainWindow.setOpacity(parseFloat(opacity));
  }
});

ipcMain.on('set-ignore-mouse', (event, ignore) => {
  if (mainWindow) {
    isClickThrough = ignore;
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

// Screen Capture handler
ipcMain.handle('capture-screen', async () => {
  const wasVisible = mainWindow && mainWindow.isVisible();
  if (mainWindow && wasVisible) {
    mainWindow.hide();
    // Give the OS 150ms to hide the window and redraw the screen completely
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height }
    });

    if (mainWindow && wasVisible) {
      mainWindow.show();
      mainWindow.focus();
    }

    if (sources.length > 0) {
      return sources[0].thumbnail.toDataURL();
    } else {
      throw new Error("No screen capture source detected.");
    }
  } catch (err) {
    if (mainWindow && wasVisible) {
      mainWindow.show();
      mainWindow.focus();
    }
    throw err;
  }
});



