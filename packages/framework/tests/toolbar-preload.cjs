const { contextBridge } = require('electron');

const listeners = new Map();
const calls = [];
let status = { status: 'downloaded', currentVersion: '1.0.0' };

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: async channel => {
    calls.push(channel);
    switch (channel) {
      case 'app:info':
        return { success: true, data: { version: 'test', productName: 'Toolbar test' } };
      case 'db-migration:run':
      case 'notification:enable':
        return { success: true };
      case 'update:status':
        return { success: true, data: status };
      default:
        throw new Error(`Unexpected fixture IPC: ${channel}`);
    }
  },
  on(channel, handler) {
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel).add(handler);
  },
  off(channel, handler) {
    listeners.get(channel)?.delete(handler);
  },
  setZoomLevel() {},
});

contextBridge.exposeInMainWorld('toolbarFixture', {
  push(value) {
    status = { ...status, status: value };
    for (const handler of listeners.get('push:update:status-changed') ?? []) {
      handler(null, status);
    }
  },
  calls: () => [...calls],
});
