const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

function getResourcePath(relativePath) {
    if (isDev && relativePath === 'icon.png') {
        return path.join(__dirname, '../build', relativePath);
    }
    return isDev
        ? path.join(__dirname, '../', relativePath)
        : path.join(process.resourcesPath, relativePath);
}

async function createWindow(port, beforeLoadCallback) {
    try {
        global.mainWindow = new BrowserWindow({
            width: 2000,
            height: 1600,
            show: false,
            icon: getResourcePath('icon.png'),
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../preload.js'),
                webSecurity: true,
                allowRunningInsecureContent: false,
                enableRemoteModule: false,
                sandbox: false
            }
        });

        if (process.platform === 'darwin') {
            app.dock.setIcon(getResourcePath('icon.png'));
        }

        global.mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
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

        if (typeof beforeLoadCallback === 'function') {
            beforeLoadCallback(global.mainWindow);
        }

        const startUrl = `http://127.0.0.1:${port}/`;

        global.mainWindow.once('ready-to-show', () => {
            global.mainWindow.show();
        });

        global.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            console.error('Failed to load:', errorCode, errorDescription);
            dialog.showErrorBox(
                'Error Loading Application',
                `Failed to load the application: ${errorDescription}`
            );
        });

        await global.mainWindow.loadURL(startUrl);

        global.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
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

module.exports = { createWindow }; 