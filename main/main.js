const { app } = require('electron');
const { setupLogging } = require('./logger');
const { loadConfig } = require('./config');
const { startServer } = require('./server');
const { createMainWindow } = require('./windowManager');
const { checkForUpdates } = require('./updateChecker');
const { setupIpcHandlers } = require('./ipcHandlers');

// Initialize logging
setupLogging();

// Load config
const config = loadConfig();

// Start server
const serverInstance = startServer(config);

// App lifecycle events
app.whenReady().then(async () => {
    await checkForUpdates();
    await createMainWindow(serverInstance);
    setupIpcHandlers();
});

app.on('window-all-closed', () => {
    if (serverInstance) serverInstance.close();
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', async () => {
    if (global.mainWindow === null) {
        await createMainWindow(serverInstance);
    }
});

app.on('before-quit', () => {
    if (serverInstance) serverInstance.close();
}); 