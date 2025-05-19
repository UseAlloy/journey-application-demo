const axios = require('axios');
const { dialog, shell, app } = require('electron');
const { log } = require('./logger');

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
        log(`Current: ${currentVersion}, Latest: ${latestVersion}`);
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

module.exports = { checkForUpdates }; 