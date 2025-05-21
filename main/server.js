const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');
const { log } = require('./logger');
const { checkConfig } = require('./config');
const axios = require('axios');
const Store = require('electron-store');
const configStore = new Store({ name: 'config' });
const validationStore = new Store({ name: 'branchValidation' });
const { ipcMain, BrowserWindow } = require('electron');

console.log('isDev:', isDev);
console.log('process.resourcesPath:', process.resourcesPath);
console.log('__dirname:', __dirname);

function getIndexPath() {
    if (isDev) {
        return path.join(__dirname, '../public', 'index.html');
    } else {
        return path.join(process.resourcesPath, 'app.asar', 'public', 'index.html');
    }
}

function startServer(config) {
    const server = express();
    // Middleware
    server.use(cors());
    server.use(bodyParser.json());
    server.use(express.urlencoded({ extended: true }));
    server.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : []),
                    "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://scripts.alloy.com", "https://kit.fontawesome.com", "https://sdk.onfido.com", "https://assets.onfido.com", "https://*.datadog.com", "https://*.sentry.io", "https://esm.sh"
                ],
                styleSrc: [
                    "'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://sdk.onfido.com"
                ],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "https://*.alloy.co", "data:"],
                imgSrc: ["'self'", "data:", "https:", "blob:"],
                connectSrc: [
                    "'self'", "https://api.alloy.com", "https://sandbox.alloy.com", "https://scripts.alloy.com", "https://docv.alloy.co", "https://docv-prod-api.alloy.co", "https://alloysdk.alloy.co", "https://*.sentry.io", "https://*.alloy.co", "https://*.onfido.com", "https://assets.onfido.com", "https://*.datadog.com", "https://*.datadoghq.com", "https://sdk.onfido.com", "wss://*.onfido.com"
                ],
                frameSrc: [
                    "'self'", "https://scripts.alloy.com", "https://alloysdk.alloy.co", "https://*.alloy.co", "https://*.onfido.com", "https://sdk.onfido.com"
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
    // Request logging
    server.use((req, res, next) => {
        log(`Incoming request: ${req.method} ${req.url}`);
        next();
    });
    // Root route
    server.get('/', (req, res) => {
        log('Root route hit, checking config status');
        const hasConfig = checkConfig();
        log(`Has valid config: ${hasConfig}`);
        if (!hasConfig) {
            log('No valid config, redirecting to /config.html');
            res.redirect('/config.html');
        } else {
            log('Valid config found, redirecting to /index.html');
            res.redirect('/index.html');
        }
    });
    // Explicit route for config.html (fix for asar static serving)
    server.get('/config.html', (req, res) => {
        const configPath = isDev 
            ? path.join(__dirname, '../public', 'config.html')
            : path.join(process.resourcesPath, 'public', 'config.html');
        log(`Serving config.html from: ${configPath}`);
        res.sendFile(configPath, (err) => {
            if (err) {
                log(`Error serving config.html: ${err.message}`);
                res.status(500).send('Error loading configuration page');
            }
        });
    });
    // Explicit route for index.html (fix for asar static serving)
    server.get('/index.html', (req, res) => {
        const indexPath = getIndexPath();
        log(`Serving index.html from: ${indexPath}`);
        res.sendFile(indexPath, (err) => {
            if (err) {
                log(`Error serving index.html: ${err.message}`);
                res.status(500).send('Error loading index.html');
            }
        });
    });
    // Static files
    const publicPath = isDev 
        ? path.join(__dirname, '../public')
        : path.join(process.resourcesPath, 'public');
    log(`Setting up static file serving from: ${publicPath}`);
    server.use(express.static(publicPath));
    // Catch-all route for SPA
    server.get('*', (req, res, next) => {
        if (req.url.startsWith('/api/') || req.url.includes('.')) {
            return next();
        }
        // For all other routes, serve index.html (SPA fallback)
        res.sendFile(getIndexPath());
    });
    // API ROUTES
    server.get('/api/config', async (req, res) => {
        try {
            log(`API config route hit, checking config`);
            const config = configStore.get('config');
            if (config && config.ALLOY_SDK_KEY && config.ALLOY_JOURNEY_TOKEN && config.ALLOY_TOKEN && config.ALLOY_SECRET && config.ALLOY_BASE_URL) {
                if (!config.THEME) config.THEME = 'default';
                log(`Valid config found, returning config`);
                return res.json(config);
            }
            log(`No valid config found, returning 404`);
            res.status(404).json({ error: 'Please set up your Alloy credentials first' });
        } catch (error) {
            log(`Error in /api/config: ${error.message}`);
            res.status(500).json({ error: error.message });
        }
    });

    server.post('/api/save-config', async (req, res) => {
        try {
            const config = req.body;
            if (!config.ALLOY_SDK_KEY || !config.ALLOY_JOURNEY_TOKEN || !config.ALLOY_TOKEN || !config.ALLOY_SECRET || !config.ALLOY_BASE_URL) {
                throw new Error('Missing required configuration values');
            }
            if (!config.THEME) config.THEME = 'default';
            configStore.set('config', config);
            if (isDev) {
                const fs = require('fs');
                const envLines = [
                    `ALLOY_SDK_KEY=${config.ALLOY_SDK_KEY}`,
                    `ALLOY_JOURNEY_TOKEN=${config.ALLOY_JOURNEY_TOKEN}`,
                    `ALLOY_TOKEN=${config.ALLOY_TOKEN}`,
                    `ALLOY_SECRET=${config.ALLOY_SECRET}`,
                    `ALLOY_BASE_URL=${config.ALLOY_BASE_URL}`,
                    `THEME=${config.THEME}`
                ];
                fs.writeFileSync('.env', envLines.join('\n'));
            }
            res.json({ success: true });
        } catch (error) {
            log(`Error saving configuration: ${error.message}`);
            res.status(500).json({ error: 'Failed to save configuration', message: error.message });
        }
    });

    server.post('/api/test-alloy-config', async (req, res) => {
        log('API /api/test-alloy-config called');
        log('Request body:', JSON.stringify(req.body));
        const { baseUrl, journeyToken, apiToken, apiSecret } = req.body;
        if (!baseUrl || !journeyToken || !apiToken || !apiSecret) {
            log('Missing required fields in /api/test-alloy-config');
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const url = `${baseUrl.replace(/\/$/, '')}/v1/journeys/${journeyToken}/schema`;
        const credentials = Buffer.from(`${apiToken}:${apiSecret}`).toString('base64');
        try {
            const response = await axios.get(url, {
                headers: { Authorization: `Basic ${credentials}` }
            });
            log('Alloy API response status:', response.status);
            log('Alloy API response body:', JSON.stringify(response.data));
            const schema = response.data;
            // If Alloy API returns an error field, treat as error
            if (schema.error || schema.message) {
                log('Alloy API returned error:', JSON.stringify(schema));
                return res.status(400).json({ error: schema.error || schema.message });
            }
            // Branch validation logic
            const allowedBranches = ['businesses', 'persons'];
            const branches = (schema.branches || []).map(b => b.branch_name);
            const invalidBranches = branches.filter(b => !allowedBranches.includes(b));
            const hasBusinessesBranch = branches.includes('businesses');
            if (invalidBranches.length > 0) {
                log('Invalid branches found:', JSON.stringify(invalidBranches));
                return res.status(400).json({
                    error: 'Unsupported branch(es) found in journey schema',
                    invalidBranches
                });
            }
            // Set the value in the businessBranchStore via IPC
            const windows = BrowserWindow.getAllWindows();
            if (windows.length > 0) {
                windows[0].webContents.send('set-business-branch', hasBusinessesBranch);
            }
            res.status(response.status).json({
                ...schema,
                hasBusinessesBranch
            });
        } catch (err) {
            log('Error in /api/test-alloy-config:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
            if (err.response) {
                log('Alloy API error response status:', err.response.status);
                log('Alloy API error response body:', JSON.stringify(err.response.data));
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
            const endpoint = `${baseUrl}/v1/journeys/${journeyToken}/applications`;
            const response = await axios.post(endpoint, req.body, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${config.ALLOY_TOKEN}:${config.ALLOY_SECRET}`).toString('base64')}`,
                    'Content-Type': 'application/json'
                }
            });
            res.json(response.data);
        } catch (error) {
            log(`Error submitting application: ${error.message}`);
            res.status(error.response?.status || 500).json({
                error: error.response?.data?.message || error.message
            });
        }
    });

    server.get('/api/alloy-sdk', async (req, res) => {
        try {
            const publicPath = isDev 
                ? path.join(__dirname, '../public')
                : path.join(process.resourcesPath, 'public');
            res.sendFile(path.join(publicPath, 'vendor', 'alloy.min.js'));
        } catch (error) {
            log(`Error serving Alloy SDK: ${error.message}`);
            res.status(500).json({ error: error.message, stack: error.stack });
        }
    });
    // Error handling middleware
    server.use((err, req, res, next) => {
        log(`Error: ${err.message}`);
        res.status(500).send('Internal Server Error');
    });
    // Start server
    let serverInstance = null;
    try {
        serverInstance = server.listen(0, '127.0.0.1', () => {
            const actualPort = serverInstance.address().port;
            log(`Server started successfully on port ${actualPort}`);
            log(`Server URL: http://127.0.0.1:${actualPort}`);
        });
        serverInstance.on('error', (error) => {
            log(`Server error: ${error.message}`);
            log(`Stack trace: ${error.stack}`);
        });
    } catch (error) {
        log(`Failed to start server: ${error.message}`);
        log(`Stack trace: ${error.stack}`);
    }
    return serverInstance;
}

module.exports = { startServer }; 