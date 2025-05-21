const { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut } = require('electron');
const path = require('path');
const Store = require('electron-store');
const configStore = new Store({ name: 'config' });
const historyStore = new Store({ name: 'history' });
const fs = require('fs');
const dotenv = require('dotenv');
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const isDev = require('electron-is-dev');
const { logger, log } = require('./main/logger');
const profileStore = new Store({ name: 'customProfiles' });
const tourStore = new Store({ name: 'tourFlags' });
const { loadConfig, checkConfig } = require('./main/config');
const { startServer } = require('./main/server');
const { createWindow } = require('./main/windowManager');
const { setupIpcHandlers } = require('./main/ipcHandlers');
const { checkForUpdates } = require('./main/updateChecker');

// Load environment variables
dotenv.config();

// Initialize Express app and middleware
const server = express();

// Add error logging for uncaught exceptions
process.on('uncaughtException', (error) => {
    log(`[${new Date().toISOString()}] UNCAUGHT EXCEPTION: ${error.message}`);
    log(`[${new Date().toISOString()}] Stack trace: ${error.stack}`);
});

process.on('unhandledRejection', (error) => {
    log(`[${new Date().toISOString()}] UNHANDLED REJECTION: ${error.message}`);
    log(`[${new Date().toISOString()}] Stack trace: ${error.stack}`);
});

// Essential middleware
server.use(cors());
server.use(bodyParser.json());
server.use(express.urlencoded({ extended: true }));

// Add security headers
server.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                ...(isDev ? ["'unsafe-eval'"] : []),
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com",
                "https://scripts.alloy.com",
                "https://kit.fontawesome.com",
                "https://sdk.onfido.com",
                "https://assets.onfido.com",
                "https://*.datadog.com",
                "https://*.sentry.io",
                "https://esm.sh"
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.jsdelivr.net",
                "https://fonts.googleapis.com",
                "https://cdnjs.cloudflare.com",
                "https://sdk.onfido.com"
            ],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "https://*.alloy.co", "data:"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: [
                "'self'",
                "https://api.alloy.com",
                "https://sandbox.alloy.com",
                "https://scripts.alloy.com",
                "https://docv.alloy.co",
                "https://docv-prod-api.alloy.co",
                "https://alloysdk.alloy.co",
                "https://*.sentry.io",
                "https://*.alloy.co",
                "https://*.onfido.com",
                "https://assets.onfido.com",
                "https://*.datadog.com",
                "https://*.datadoghq.com",
                "https://sdk.onfido.com",
                "wss://*.onfido.com"
            ],
            frameSrc: [
                "'self'",
                "https://scripts.alloy.com",
                "https://alloysdk.alloy.co",
                "https://*.alloy.co",
                "https://*.onfido.com",
                "https://sdk.onfido.com"
            ],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "blob:"],
            workerSrc: ["'self'", "blob:", "'unsafe-inline'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
}));

// Start the server
const config = loadConfig();
const serverInstance = startServer(config);
app.disableHardwareAcceleration();
// App lifecycle events
app.whenReady().then(async () => {
    try {
        // Create the window first so we can pass it to checkForUpdates
        const port = serverInstance.address().port;
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
    if (mainWindow === null) {
        try {
            const port = serverInstance.address().port;
            // console.log('Server started on port:', port);
            await createWindow(port);
        } catch (error) {
            console.error('Error in activate handler:', error);
            dialog.showErrorBox(
                'Error Restoring Window',
                `Failed to restore the application window: ${error.message}`
            );
        }
    }
});

app.on('before-quit', () => {
    if (serverInstance) {
        serverInstance.close();
    }
});

// Proxy endpoint for journey schema to avoid CORS issues
const base64 = (str) => Buffer.from(str).toString('base64');
server.post('/api/journey-schema', async (req, res) => {
    const { baseUrl, journeyToken, apiToken, apiSecret } = req.body;
    if (!baseUrl || !journeyToken || !apiToken || !apiSecret) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const url = `${baseUrl.replace(/\/$/, '')}/v1/journeys/${journeyToken}/schema`;
    console.log('[DEBUG] Fetching journey schema from URL:', url);
    try {
        const response = await axios.get(url, {
            headers: { Authorization: `Basic ${base64(`${apiToken}:${apiSecret}`)}` }
        });
        res.status(response.status).json(response.data);
    } catch (err) {
        if (err.response) {
            res.status(err.response.status).json(err.response.data);
        } else {
            res.status(500).json({ error: 'Failed to fetch journey schema', details: err.message });
        }
    }
});

// Add cleanup on app quit
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

ipcMain.handle('get-custom-profiles', () => {
  return profileStore.get('profiles', []);
});

ipcMain.handle('save-custom-profiles', (event, profiles) => {
  profileStore.set('profiles', profiles);
  return true;
});

ipcMain.handle('get-tour-flag', () => {
  return tourStore.get('shepherdTourShown', false);
});

ipcMain.handle('set-tour-flag', (event, value) => {
  tourStore.set('shepherdTourShown', value);
  return true;
});

ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url);
});

console.log('Resolved publicPath:', publicPath);
console.log('index.html exists:', fs.existsSync(path.join(publicPath, 'index.html')));

const publicPath = isDev 
    ? path.join(__dirname, '../public')
    : path.join(process.resourcesPath, 'public');
server.use(express.static(publicPath));

server.get('/test-index', (req, res) => {
  const publicPath = isDev 
    ? path.join(__dirname, '../public')
    : path.join(process.resourcesPath, 'public');
  const indexPath = path.join(publicPath, 'index.html');
  console.log('Test route indexPath:', indexPath);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.log('Error sending test index.html:', err);
      res.status(500).send('Error loading test index.html');
    }
  });
}); 