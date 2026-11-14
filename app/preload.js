const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('vmNative', {
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file) || '';
    } catch (_) {
      return (file && file.path) || '';
    }
  },
  ensureProxy: (filePath) => ipcRenderer.invoke('vm:ensure-proxy', filePath),
  onProxyProgress: (cb) => {
    const fn = (_ev, data) => cb(data);
    ipcRenderer.on('vm:proxy-progress', fn);
    return () => ipcRenderer.removeListener('vm:proxy-progress', fn);
  },
});
