import { contextBridge, ipcRenderer } from 'electron';

// Definisci l'API type-safe
const electronAPI = {
  // Tool API
  test: {
    test: () => ipcRenderer.invoke('test'),
  },
  // Backup API
  backup: {
    create: (options: any) => ipcRenderer.invoke('backup:create', options),
    auto: () => ipcRenderer.invoke('backup:auto'),
    list: () => ipcRenderer.invoke('backup:list'),
    restore: (backupPath: string) => ipcRenderer.invoke('backup:restore', backupPath),
    delete: (backupPath: string) => ipcRenderer.invoke('backup:delete', backupPath),
    stats: () => ipcRenderer.invoke('backup:stats')
  },
  // App API
  app: {
    reload: () => ipcRenderer.invoke('app:reload')
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type definitions per Angular
export type ElectronAPI = typeof electronAPI;
