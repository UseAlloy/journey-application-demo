const path = require('path');
const fs = require('fs');
const winston = require('winston');
require('winston-daily-rotate-file');

// Use Electron's app.getPath('userData') for logs if available
let logDir;
try {
    // Dynamically require electron only if available (main process)
    const electron = require('electron');
    // In packaged app, app may be in electron.app or electron.remote.app
    const app = electron.app || (electron.remote && electron.remote.app);
    if (app) {
        logDir = path.join(app.getPath('userData'), 'logs');
    } else {
        logDir = path.join(__dirname, '../logs');
    }
} catch (e) {
    // Fallback for non-Electron/test environments
    logDir = path.join(__dirname, '../logs');
}

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const transport = new winston.transports.DailyRotateFile({
    filename: path.join(logDir, 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: false,
    maxSize: '20m',
    maxFiles: '7d', // Keep logs for 7 days
    level: 'info',
});

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            let metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
            return `[${timestamp}] [${level.toUpperCase()}] ${message} ${metaString}`;
        })
    ),
    transports: [
        transport,
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

function log(...args) {
    logger.info(args.map(String).join(' '));
}

module.exports = {
    logger,
    log
}; 