const { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut } = require('electron');
const path = require('path');
const { configStore, historyStore, profileStore, tourStore } = require('./main/stores');
const fs = require('fs');
const axios = require('axios');
const isDev = require('electron-is-dev');
const { logger, log } = require('./main/logger');
const { loadConfig, checkConfig } = require('./main/config');
const { startServer } = require('./main/server');
const { createWindow, handleAppActivate } = require('./main/windowManager');
const { setupIpcHandlers } = require('./main/ipcHandlers');
const { checkForUpdates } = require('./main/updateChecker');

// Import the Express server from main/server.js
const { server, publicPath } = require('./main/server');

// Add error logging for uncaught exceptions
process.on('uncaughtException', (error) => {
    log(`[${new Date().toISOString()}] UNCAUGHT EXCEPTION: ${error.message}`);
    log(`[${new Date().toISOString()}] Stack trace: ${error.stack}`);
});

process.on('unhandledRejection', (error) => {
    log(`[${new Date().toISOString()}] UNHANDLED REJECTION: ${error.message}`);
    log(`[${new Date().toISOString()}] Stack trace: ${error.stack}`);
});

// Start the server
const config = loadConfig();
const serverInstance = startServer(config);
app.disableHardwareAcceleration();

// App lifecycle events
app.whenReady().then(async () => {
    try {
        // Create the window first so we can pass it to checkForUpdates
        const port = serverInstance.address().port;
        // Fix publicPath for fs.existsSync check
        const publicPath = isDev 
            ? path.join(__dirname, 'public')
            : path.join(process.resourcesPath, 'public');
        console.log('Resolved publicPath:', publicPath);
        console.log('index.html exists:', fs.existsSync(path.join(publicPath, 'index.html')));
        await createWindow(port, (mainWindow) => {
            setupIpcHandlers(mainWindow || global.mainWindow);
            // checkForUpdates will be called after renderer-ready
        });
        if (process.platform === 'darwin') {
            app.setName('Alloy Journey Application Demo App');
        }
    } catch (error) {
        console.error('Error in app.whenReady():', error);
        dialog.showErrorBox(
            'Error Starting Application',
            `Failed to start the application: ${error.message}`
        );
        app.quit();
    }
});

// Listen for renderer-ready and then check for updates
ipcMain.on('renderer-ready', () => {
    checkForUpdates(global.mainWindow);
});

app.on('window-all-closed', () => {
    if (serverInstance) {
        serverInstance.close();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', async () => {
    await handleAppActivate(serverInstance);
});

app.on('before-quit', () => {
    if (serverInstance) {
        serverInstance.close();
    }
});

// Add cleanup on app quit
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
}); 