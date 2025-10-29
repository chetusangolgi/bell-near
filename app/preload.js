
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getVideoPath: (args) => ipcRenderer.invoke('get-video-path', args),
  getDisplayName: () => ipcRenderer.invoke('get-display-name'),
  getAudioDevice: () => ipcRenderer.invoke('get-audio-device')
});
