import { contextBridge, ipcRenderer } from 'electron';

/**
 * Generic Electron API exposed to the renderer process.
 * This API is designed to be controller-agnostic:
 * - Use `invoke(channel, ...args)` to call any IPC handler
 * - Use `on/off` for push events from main to renderer
 * 
 * Angular services should wrap these generic methods with type-safe interfaces.
 */
const electronAPI = {
  /**
   * Invokes an IPC handler by channel name.
   * @param channel - The full channel name (e.g., 'backup:create', 'update:check')
   * @param args - Arguments to pass to the handler
   */
  invoke: <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
    return ipcRenderer.invoke(channel, ...args);
  },

  /**
   * Subscribes to push events from the main process.
   * Only channels starting with 'push:' are allowed.
   */
  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    if (!channel.startsWith('push:')) return;
    ipcRenderer.on(channel, callback);
  },

  /**
   * Unsubscribes from push events.
   * Only channels starting with 'push:' are allowed.
   */
  off: (channel: string, callback: (...args: unknown[]) => void): void => {
    if (!channel.startsWith('push:')) return;
    ipcRenderer.off(channel, callback);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type definitions for Angular
export type ElectronAPI = typeof electronAPI;
