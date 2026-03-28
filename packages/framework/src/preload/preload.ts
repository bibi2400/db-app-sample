import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  invoke: <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
    return ipcRenderer.invoke(channel, ...args);
  },

  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    if (!channel.startsWith('push:')) return;
    ipcRenderer.on(channel, callback);
  },

  off: (channel: string, callback: (...args: unknown[]) => void): void => {
    if (!channel.startsWith('push:')) return;
    ipcRenderer.off(channel, callback);
  },
};

export function setupPreload(): void {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
}

export type ElectronAPI = typeof electronAPI;

// Auto-setup when imported as a side effect
setupPreload();
