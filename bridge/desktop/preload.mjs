import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('babyLinkBridge', {
  getConfig: () => ipcRenderer.invoke('bridge:get-config'),
  start: (config) => ipcRenderer.invoke('bridge:start', config),
  stop: () => ipcRenderer.invoke('bridge:stop'),
  openDashboard: () => ipcRenderer.invoke('bridge:open-dashboard'),
  diagnostics: () => ipcRenderer.invoke('bridge:diagnostics'),
  audit: () => ipcRenderer.invoke('bridge:audit'),
  openExternal: (url) => ipcRenderer.invoke('bridge:open-external', url),
  onState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on('bridge-state', handler);
    return () => ipcRenderer.removeListener('bridge-state', handler);
  }
});
