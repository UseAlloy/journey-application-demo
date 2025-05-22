const Store = require('electron-store');

const configStore = new Store({ name: 'config' });
const historyStore = new Store({ name: 'history' });
const profileStore = new Store({ name: 'customProfiles' });
const tourStore = new Store({ name: 'tourFlags' });
const businessBranchStore = new Store({ name: 'businessBranch' });

module.exports = {
  configStore,
  historyStore,
  profileStore,
  tourStore,
  businessBranchStore
}; 