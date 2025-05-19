const fs = require('fs');
const logFile = fs.createWriteStream('electron-log.txt', { flags: 'a' });

function log(msg) {
    logFile.write(`[${new Date().toISOString()}] ${msg}\n`);
}

function setupLogging() {
    process.on('uncaughtException', (error) => {
        log(`UNCAUGHT EXCEPTION: ${error.message}`);
        log(`Stack trace: ${error.stack}`);
    });
    process.on('unhandledRejection', (error) => {
        log(`UNHANDLED REJECTION: ${error.message}`);
        log(`Stack trace: ${error.stack}`);
    });
}

module.exports = { log, setupLogging }; 