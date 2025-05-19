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
const logFile = require('fs').createWriteStream('electron-log.txt', { flags: 'a' });
const profileStore = new Store({ name: 'customProfiles' });
const tourStore = new Store({ name: 'tourFlags' });

function log(msg) {
    logFile.write(`[${new Date().toISOString()}] ${msg}\n`);
}

// Load environment variables
dotenv.config();

// Get the correct path for resources
const getResourcePath = (relativePath) => {
    if (isDev && relativePath === 'icon.png') {
        return path.join(__dirname, 'build', relativePath);
    }
    return isDev
        ? path.join(__dirname, relativePath)
        : path.join(process.resourcesPath, relativePath);
};

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

// Add request logging
server.use((req, res, next) => {
    log(`[${new Date().toISOString()}] Incoming request: ${req.method} ${req.url}`);
    next();
});

// Root route handler - MUST come before static file serving
server.get('/', (req, res) => {
    log(`[${new Date().toISOString()}] Root route hit, checking config status`);
    const hasConfig = checkConfig();
    log(`[${new Date().toISOString()}] Has valid config: ${hasConfig}`);
    
    if (!hasConfig) {
        log(`[${new Date().toISOString()}] No valid config, redirecting to /config.html`);
        res.redirect('/config.html');
    } else {
        log(`[${new Date().toISOString()}] Valid config found, redirecting to /index.html`);
        res.redirect('/index.html');
    }
});

// API Routes - MUST come before static file serving
server.get('/api/config', async (req, res) => {
    try {
        log(`[${new Date().toISOString()}] API config route hit, checking config`);
        const config = configStore.get('config');
        if (config && config.ALLOY_SDK_KEY && config.ALLOY_JOURNEY_TOKEN && config.ALLOY_TOKEN && config.ALLOY_SECRET && config.ALLOY_BASE_URL) {
            // Ensure THEME is always present
            if (!config.THEME) config.THEME = 'default';
            log(`[${new Date().toISOString()}] Valid config found, returning config`);
            return res.json(config);
        }
        log(`[${new Date().toISOString()}] No valid config found, returning 404`);
        res.status(404).json({ error: 'Please set up your Alloy credentials first' });
    } catch (error) {
        log(`[${new Date().toISOString()}] Error in /api/config: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

server.post('/api/save-config', async (req, res) => {
    try {
        const config = req.body;
        if (!config.ALLOY_SDK_KEY || !config.ALLOY_JOURNEY_TOKEN || !config.ALLOY_TOKEN || !config.ALLOY_SECRET || !config.ALLOY_BASE_URL) {
            throw new Error('Missing required configuration values');
        }
        // Ensure THEME is always present
        if (!config.THEME) config.THEME = 'default';
        configStore.set('config', config);
        // Only update .env in development mode
        if (isDev) {
            const envLines = [
                `ALLOY_SDK_KEY=${config.ALLOY_SDK_KEY}`,
                `ALLOY_JOURNEY_TOKEN=${config.ALLOY_JOURNEY_TOKEN}`,
                `ALLOY_TOKEN=${config.ALLOY_TOKEN}`,
                `ALLOY_SECRET=${config.ALLOY_SECRET}`,
                `ALLOY_BASE_URL=${config.ALLOY_BASE_URL}`,
                `THEME=${config.THEME}`
            ];
            fs.writeFileSync('.env', envLines.join('\n'));
            // console.log('Updated .env file content:', fs.readFileSync('.env', 'utf8'));
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving configuration:', error);
        res.status(500).json({ 
            error: 'Failed to save configuration',
            message: error.message
        });
    }
});

server.post('/api/test-alloy-config', async (req, res) => {
  const { baseUrl, journeyToken, apiToken, apiSecret } = req.body;
  if (!baseUrl || !journeyToken || !apiToken || !apiSecret) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const url = `${baseUrl.replace(/\/$/, '')}/v1/journeys/${journeyToken}/schema`;
  const credentials = Buffer.from(`${apiToken}:${apiSecret}`).toString('base64');
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Basic ${credentials}` }
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(500).json({ error: 'Failed to reach Alloy API', details: err.message });
    }
  }
});

server.post('/api/submit-application', async (req, res) => {
    try {
        const config = configStore.get('config');
        if (!config || !config.ALLOY_TOKEN || !config.ALLOY_SECRET || !config.ALLOY_BASE_URL || !config.ALLOY_JOURNEY_TOKEN) {
            throw new Error('Configuration not found. Please set up your Alloy credentials first.');
        }
        const baseUrl = config.ALLOY_BASE_URL;
        const journeyToken = config.ALLOY_JOURNEY_TOKEN;
        
        // Debug logging
        const endpoint = `${baseUrl}/v1/journeys/${journeyToken}/applications`;
        // console.log('Submitting to:', endpoint);
        // console.log('Headers:', {
        // console.log('Body:', req.body);
        
        const response = await axios.post(endpoint, req.body, {
            headers: {
                'Authorization': `Basic ${Buffer.from(`${config.ALLOY_TOKEN}:${config.ALLOY_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error submitting application:', error);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.message || error.message
        });
    }
});

server.get('/api/alloy-sdk', async (req, res) => {
    try {
        // console.log('Serving Alloy SDK from local file...');
        res.sendFile(path.join(__dirname, 'public', 'vendor', 'alloy.min.js'));
    } catch (error) {
        console.error('Error serving Alloy SDK:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

// Explicit route for config.html
server.get('/config.html', (req, res) => {
    const configPath = path.join(publicPath, 'config.html');
    log(`[${new Date().toISOString()}] Attempting to serve config.html from: ${configPath}`);
    
    if (fs.existsSync(configPath)) {
        log(`[${new Date().toISOString()}] Found config.html, serving file`);
        res.sendFile(configPath, (err) => {
            if (err) {
                log(`[${new Date().toISOString()}] Error serving config.html: ${err.message}`);
                res.status(500).send('Error loading configuration page');
            }
        });
    } else {
        log(`[${new Date().toISOString()}] config.html not found at: ${configPath}`);
        res.status(404).send('Configuration page not found');
    }
});

// Explicit route for index.html
server.get('/index.html', (req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    log(`[${new Date().toISOString()}] Attempting to serve index.html from: ${indexPath}`);
    
    if (fs.existsSync(indexPath)) {
        log(`[${new Date().toISOString()}] Found index.html, serving file`);
        res.sendFile(indexPath, (err) => {
            if (err) {
                log(`[${new Date().toISOString()}] Error serving index.html: ${err.message}`);
                res.status(500).send('Error loading application');
            }
        });
    } else {
        log(`[${new Date().toISOString()}] index.html not found at: ${indexPath}`);
        res.status(404).send('Application not found');
    }
});

// Serve static files AFTER route handlers
const publicPath = isDev 
    ? path.join(__dirname, 'public')
    : path.join(process.resourcesPath, 'public');

log(`[${new Date().toISOString()}] Setting up static file serving from: ${publicPath}`);
server.use(express.static(publicPath, {
    setHeaders: (res, filePath) => {
        log(`[${new Date().toISOString()}] Serving static file: ${filePath}`);
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

function checkConfig() {
    try {
        // First try to get config from Electron store
        const storeConfig = configStore.get('config');
        // console.log('Store config:', storeConfig);
        if (storeConfig && 
            storeConfig.ALLOY_SDK_KEY && 
            storeConfig.ALLOY_JOURNEY_TOKEN && 
            storeConfig.ALLOY_TOKEN && 
            storeConfig.ALLOY_SECRET &&
            storeConfig.ALLOY_BASE_URL) {
            // console.log('Using configuration from Electron store');
            return true;
        }

        // If no valid store config, check .env file
        if (fs.existsSync('.env')) {
            const envConfig = {
                ALLOY_SDK_KEY: process.env.ALLOY_SDK_KEY,
                ALLOY_JOURNEY_TOKEN: process.env.ALLOY_JOURNEY_TOKEN,
                ALLOY_TOKEN: process.env.ALLOY_TOKEN,
                ALLOY_SECRET: process.env.ALLOY_SECRET,
                ALLOY_BASE_URL: process.env.ALLOY_BASE_URL
            };
            // console.log('Env config:', envConfig);

            if (envConfig.ALLOY_SDK_KEY && 
                envConfig.ALLOY_JOURNEY_TOKEN && 
                envConfig.ALLOY_TOKEN && 
                envConfig.ALLOY_SECRET &&
                envConfig.ALLOY_BASE_URL) {
                // console.log('Using configuration from .env file');
                configStore.set('config', envConfig);
                return true;
            }
        }

        // console.log('No valid configuration found in store or .env file');
        return false;
    } catch (error) {
        console.error('Error checking config:', error);
        return false;
    }
}

// Start the server
let serverInstance = null;
try {
    serverInstance = server.listen(0, '127.0.0.1', () => {
        const actualPort = serverInstance.address().port;
        log(`[${new Date().toISOString()}] Server started successfully on port ${actualPort}`);
        log(`[${new Date().toISOString()}] Server URL: http://127.0.0.1:${actualPort}`);
    });

    serverInstance.on('error', (error) => {
        log(`[${new Date().toISOString()}] Server error: ${error.message}`);
        log(`[${new Date().toISOString()}] Stack trace: ${error.stack}`);
    });
} catch (error) {
    log(`[${new Date().toISOString()}] Failed to start server: ${error.message}`);
    log(`[${new Date().toISOString()}] Stack trace: ${error.stack}`);
}

async function createWindow(port) {
    try {
        mainWindow = new BrowserWindow({
            width: 2000,
            height: 1600,
            show: false,
            icon: getResourcePath('icon.png'),
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js'),
                webSecurity: true,
                allowRunningInsecureContent: false,
                enableRemoteModule: false,
                sandbox: true
            }
        });

        // Set dock icon on macOS
        if (process.platform === 'darwin') {
            app.dock.setIcon(getResourcePath('icon.png'));
        }

        // Set additional security headers
        mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': [
                        "default-src 'self'; " +
                        "script-src 'self' 'unsafe-inline' " + (isDev ? "'unsafe-eval'" : "") + " https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://scripts.alloy.com https://kit.fontawesome.com https://sdk.onfido.com https://assets.onfido.com https://*.datadog.com https://*.sentry.io https://esm.sh; " +
                        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com https://cdnjs.cloudflare.com https://sdk.onfido.com; " +
                        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com https://*.alloy.co data:; " +
                        "img-src 'self' data: https: blob:; " +
                        "media-src 'self' blob:; " +
                        "worker-src 'self' blob: 'unsafe-inline'; " +
                        "connect-src 'self' https://api.alloy.com https://sandbox.alloy.com https://scripts.alloy.com https://docv.alloy.co https://docv-prod-api.alloy.co https://alloysdk.alloy.co https://*.sentry.io https://*.alloy.co https://*.onfido.com https://assets.onfido.com https://*.datadog.com https://*.datadoghq.com https://sdk.onfido.com wss://*.onfido.com wss://docv.alloy.co; " +
                        "frame-src 'self' https://scripts.alloy.com https://alloysdk.alloy.co https://*.alloy.co https://*.onfido.com https://sdk.onfido.com; " +
                        "object-src 'none';"
                    ],
                    'Permissions-Policy': [
                        'screen-wake-lock=*',
                        'camera=(self)',
                        'microphone=(self)',
                        'fullscreen=(self)',
                        'geolocation=(self)',
                        'accelerometer=(self)',
                        'autoplay=(self)',
                        'payment=(self)'
                    ]
                }
            });
        });

        // Load the app
        const startUrl = `http://127.0.0.1:${port}`;
        
        // Handle window ready-to-show
        mainWindow.once('ready-to-show', () => {
            mainWindow.show();
        });

        // Handle load errors
        mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            console.error('Failed to load:', errorCode, errorDescription);
            dialog.showErrorBox(
                'Error Loading Application',
                `Failed to load the application: ${errorDescription}`
            );
        });

        // Load the URL
        await mainWindow.loadURL(startUrl);

        // Handle external links
        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            if (url.includes('app.alloy.co') || url.includes('app.alloy.com')) {
                shell.openExternal(url);
                return { action: 'deny' };
            }
            return { action: 'allow' };
        });

    } catch (error) {
        console.error('Error creating window:', error);
        dialog.showErrorBox(
            'Error Starting Application',
            `Failed to start the application: ${error.message}`
        );
        app.quit();
    }
}

// --- GitHub Release Checker ---
const DEFAULT_GITHUB_RELEASES_API = 'https://api.github.com/repos/UseAlloy/journey-application-demo/releases/latest';
const GITHUB_RELEASES_API = process.env.GITHUB_RELEASES_API || DEFAULT_GITHUB_RELEASES_API;

function compareVersions(a, b) {
    // Returns 1 if a > b, -1 if a < b, 0 if equal
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const na = pa[i] || 0, nb = pb[i] || 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}

async function checkForUpdates() {
    try {
        const currentVersion = app.getVersion();
        const response = await axios.get(GITHUB_RELEASES_API, {
            headers: { 'User-Agent': 'AlloyDemoApp' }
        });
        if (!response.data || !response.data.tag_name) return;
        const latestVersion = response.data.tag_name.replace(/^v/, '');
        if (compareVersions(latestVersion, currentVersion) > 0) {
            const result = dialog.showMessageBoxSync({
                type: 'info',
                buttons: ['Download', 'Later'],
                defaultId: 0,
                cancelId: 1,
                title: 'Update Available',
                message: `A new version (${latestVersion}) is available for download!`,
                detail: 'Would you like to download the latest version?'
            });
            if (result === 0) {
                shell.openExternal(response.data.html_url);
            }
        }
    } catch (err) {
        log(`[${new Date().toISOString()}] Update check failed: ${err.message}`);
    }
}

// App lifecycle events
app.whenReady().then(async () => {
    try {
        await checkForUpdates(); // <-- Check for updates before creating the window
        // Wait for server to start and get port
        const port = serverInstance.address().port;
        // console.log('Server started on port:', port);
        await createWindow(port);
    } catch (error) {
        console.error('Error in app.whenReady():', error);
        dialog.showErrorBox(
            'Error Starting Application',
            `Failed to start the application: ${error.message}`
        );
        app.quit();
    }
}).catch((error) => {
    console.error('Error in app.whenReady():', error);
    dialog.showErrorBox(
        'Error Starting Application',
        `Failed to start the application: ${error.message}`
    );
    app.quit();
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

// Handle configuration storage
ipcMain.handle('get-config', () => {
    const config = configStore.get('config');
    if (!config) {
        return {
            ALLOY_SDK_KEY: process.env.ALLOY_SDK_KEY || '',
            ALLOY_JOURNEY_TOKEN: process.env.ALLOY_JOURNEY_TOKEN || '',
            ALLOY_TOKEN: process.env.ALLOY_TOKEN || '',
            ALLOY_SECRET: process.env.ALLOY_SECRET || '',
            ALLOY_BASE_URL: process.env.ALLOY_BASE_URL || '',
            THEME: process.env.THEME || 'default'
        };
    }
    if (!config.THEME) config.THEME = 'default';
    return config;
});

ipcMain.handle('set-config', (event, config) => {
    try {
        if (!config.ALLOY_SDK_KEY || !config.ALLOY_JOURNEY_TOKEN || !config.ALLOY_TOKEN || !config.ALLOY_SECRET || !config.ALLOY_BASE_URL) {
            throw new Error('Missing required configuration values');
        }
        if (!config.THEME) config.THEME = 'default';
        configStore.set('config', config);
        // Reload the window to apply new configuration
        if (mainWindow) {
            mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Add these IPC handlers near your other ipcMain handlers
ipcMain.handle('save-application-history', async (event, history) => {
    try {
        historyStore.set('applicationLinks', history);
        return { success: true };
    } catch (error) {
        console.error('Error saving application history:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-application-history', async () => {
    try {
        return historyStore.get('applicationLinks', []);
    } catch (error) {
        console.error('Error getting application history:', error);
        return [];
    }
});

ipcMain.handle('clear-all-storage', async () => {
    try {
        configStore.clear();
        historyStore.clear();
        return { success: true };
    } catch (error) {
        console.error('Error clearing storage:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('clear-history', async () => {
    try {
        historyStore.clear();
        return { success: true };
    } catch (error) {
        console.error('Error clearing history:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('clear-config', async () => {
    try {
        configStore.clear();
        return { success: true };
    } catch (error) {
        console.error('Error clearing config:', error);
        return { success: false, error: error.message };
    }
});

// Add catch-all route for SPA
server.get('*', (req, res, next) => {
    // Skip if it's an API route or static file
    if (req.url.startsWith('/api/') || req.url.includes('.')) {
        log(`[${new Date().toISOString()}] Passing through request: ${req.url}`);
        return next();
    }

    log(`[${new Date().toISOString()}] Catch-all route hit: ${req.url}`);
    
    // Default to config check and redirect
    const hasConfig = checkConfig();
    log(`[${new Date().toISOString()}] Has valid config (catch-all): ${hasConfig}`);
    
    if (!hasConfig) {
        log(`[${new Date().toISOString()}] No valid config (catch-all), redirecting to /config.html`);
        res.redirect('/config.html');
    } else {
        log(`[${new Date().toISOString()}] Valid config found (catch-all), redirecting to /index.html`);
        res.redirect('/index.html');
    }
});

// Add error handling middleware
server.use((err, req, res, next) => {
    log(`[${new Date().toISOString()}] Error: ${err.message}`);
    res.status(500).send('Internal Server Error');
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