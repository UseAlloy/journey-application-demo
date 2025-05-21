const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    send: (channel, data) => {
      // whitelist channels
      let validChannels = ['toMain', 'renderer-ready', 'open-external'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    receive: (channel, func) => {
      let validChannels = ['fromMain', 'update-available'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender` 
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    saveApplicationHistory: (history) => ipcRenderer.invoke('save-application-history', history),
    getApplicationHistory: () => ipcRenderer.invoke('get-application-history'),
    clearAllStorage: () => ipcRenderer.invoke('clear-all-storage'),
    clearHistory: () => ipcRenderer.invoke('clear-history'),
    clearConfig: () => ipcRenderer.invoke('clear-config'),
    getCustomProfiles: () => ipcRenderer.invoke('get-custom-profiles'),
    saveCustomProfiles: (profiles) => ipcRenderer.invoke('save-custom-profiles', profiles),
    getTourFlag: () => ipcRenderer.invoke('get-tour-flag'),
    setTourFlag: (value) => ipcRenderer.invoke('set-tour-flag', value),
    getBusinessBranch: () => ipcRenderer.invoke('get-business-branch'),
    setBusinessBranch: (value) => ipcRenderer.invoke('set-business-branch', value)
  }
); 