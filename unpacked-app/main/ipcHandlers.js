const { ipcMain } = require('electron');
const Store = require('electron-store');
const path = require('path');

const configStore = new Store({ name: 'config' });
const historyStore = new Store({ name: 'history' });
const profileStore = new Store({ name: 'customProfiles' });
const tourStore = new Store({ name: 'tourFlags' });
const businessBranchStore = new Store({ name: 'businessBranch' });

function setupIpcHandlers(mainWindow) {
    ipcMain.removeHandler('get-config');
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

    ipcMain.removeHandler('set-config');
    ipcMain.handle('set-config', (event, config) => {
        try {
            if (!config.ALLOY_SDK_KEY || !config.ALLOY_JOURNEY_TOKEN || !config.ALLOY_TOKEN || !config.ALLOY_SECRET || !config.ALLOY_BASE_URL) {
                throw new Error('Missing required configuration values');
            }
            if (!config.THEME) config.THEME = 'default';
            configStore.set('config', config);
            // Reload the window to apply new configuration
            if (mainWindow) {
                mainWindow.loadFile(path.join(__dirname, '../public', 'index.html'));
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.removeHandler('save-application-history');
    ipcMain.handle('save-application-history', async (event, history) => {
        try {
            historyStore.set('applicationLinks', history);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.removeHandler('get-application-history');
    ipcMain.handle('get-application-history', async () => {
        try {
            return historyStore.get('applicationLinks', []);
        } catch (error) {
            return [];
        }
    });

    ipcMain.removeHandler('clear-all-storage');
    ipcMain.handle('clear-all-storage', async () => {
        try {
            configStore.clear();
            historyStore.clear();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.removeHandler('clear-history');
    ipcMain.handle('clear-history', async () => {
        try {
            historyStore.clear();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.removeHandler('clear-config');
    ipcMain.handle('clear-config', async () => {
        try {
            configStore.clear();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.removeHandler('get-custom-profiles');
    ipcMain.handle('get-custom-profiles', () => {
        return profileStore.get('profiles', []);
    });

    ipcMain.removeHandler('save-custom-profiles');
    ipcMain.handle('save-custom-profiles', (event, profiles) => {
        profileStore.set('profiles', profiles);
        return true;
    });

    ipcMain.removeHandler('get-tour-flag');
    ipcMain.handle('get-tour-flag', () => {
        return tourStore.get('shepherdTourShown', false);
    });

    ipcMain.removeHandler('set-tour-flag');
    ipcMain.handle('set-tour-flag', (event, value) => {
        tourStore.set('shepherdTourShown', value);
        return true;
    });

    ipcMain.removeHandler('get-business-branch');
    ipcMain.handle('get-business-branch', () => {
        const value = businessBranchStore.get('hasBusinessesBranch', false);
        console.log('[IPC] get-business-branch called, returning:', value);
        return value;
    });

    ipcMain.removeHandler('set-business-branch');
    ipcMain.handle('set-business-branch', (event, value) => {
        businessBranchStore.set('hasBusinessesBranch', value);
        console.log('[IPC] set-business-branch called, set to:', value);
        return true;
    });
}

module.exports = { setupIpcHandlers }; 