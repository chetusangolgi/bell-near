
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getVideoPath: (args) => ipcRenderer.invoke('get-video-path', args)
});
