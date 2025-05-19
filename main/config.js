const Store = require('electron-store');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();
const configStore = new Store({ name: 'config' });

function loadConfig() {
    // Try electron-store first
    let config = configStore.get('config');
    if (config && config.ALLOY_SDK_KEY && config.ALLOY_JOURNEY_TOKEN && config.ALLOY_TOKEN && config.ALLOY_SECRET && config.ALLOY_BASE_URL) {
        if (!config.THEME) config.THEME = 'default';
        return config;
    }
    // Fallback to .env
    if (fs.existsSync('.env')) {
        config = {
            ALLOY_SDK_KEY: process.env.ALLOY_SDK_KEY,
            ALLOY_JOURNEY_TOKEN: process.env.ALLOY_JOURNEY_TOKEN,
            ALLOY_TOKEN: process.env.ALLOY_TOKEN,
            ALLOY_SECRET: process.env.ALLOY_SECRET,
            ALLOY_BASE_URL: process.env.ALLOY_BASE_URL,
            THEME: process.env.THEME || 'default'
        };
        if (config.ALLOY_SDK_KEY && config.ALLOY_JOURNEY_TOKEN && config.ALLOY_TOKEN && config.ALLOY_SECRET && config.ALLOY_BASE_URL) {
            configStore.set('config', config);
            return config;
        }
    }
    return null;
}

function checkConfig() {
    return !!loadConfig();
}

module.exports = { loadConfig, checkConfig }; 