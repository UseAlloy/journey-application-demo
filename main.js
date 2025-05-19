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

// Start the server
const config = loadConfig();
const serverInstance = startServer(config);

// App lifecycle events
app.whenReady().then(async () => {
    try {
        await checkForUpdates();
        const port = serverInstance.address().port;
        await createWindow(port, (mainWindow) => {
            setupIpcHandlers(mainWindow || global.mainWindow);
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