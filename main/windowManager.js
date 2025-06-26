const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

function getResourcePath(relativePath) {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, relativePath);
    }
    return path.join(__dirname, '../build', relativePath);
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
                        "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:; " +
                        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:; " +
                        "style-src 'self' 'unsafe-inline' https: data:; " +
                        "font-src 'self' https: data:; " +
                        "img-src 'self' https: data: blob:; " +
                        "media-src 'self' blob:; " +
                        "worker-src 'self' blob: 'unsafe-inline'; " +
                        "connect-src 'self' https: wss:; " +
                        "frame-src 'self' https:; " +
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

async function handleAppActivate(serverInstance) {
    if (global.mainWindow === null) {
        try {
            const port = serverInstance.address().port;
            await createWindow(port);
        } catch (error) {
            console.error('Error in activate handler:', error);
            dialog.showErrorBox(
                'Error Restoring Window',
                `Failed to restore the application window: ${error.message}`
            );
        }
    }
}

module.exports = { createWindow, handleAppActivate }; 