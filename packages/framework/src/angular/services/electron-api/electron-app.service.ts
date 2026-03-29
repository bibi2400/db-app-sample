import { Injectable } from '@angular/core';
import { IpcResponse } from '../../types/global';

export interface AppInfo {
  name: string;
  productName: string;
  version: string;
}

export interface AppDetails {
  name: string;
  version: string;
  dbPath: string;
  appDataPath: string;
  installPath: string;
  electron: string;
  node: string;
  chrome: string;
}

@Injectable({
  providedIn: 'root'
})
export class ElectronAppService {

  async getInfo(): Promise<AppInfo | null> {
    const response = await window.electronAPI.invoke<IpcResponse<AppInfo>>('app:info');
    return response.success && response.data ? response.data : null;
  }

  async reload(): Promise<void> {
    await window.electronAPI.invoke<IpcResponse<null>>('app:reload');
  }

  async openAppData(): Promise<void> {
    await window.electronAPI.invoke<IpcResponse<null>>('app:open-appdata');
  }

  async openDbFolder(): Promise<void> {
    await window.electronAPI.invoke<IpcResponse<null>>('app:open-db-folder');
  }

  async openInstallFolder(): Promise<void> {
    await window.electronAPI.invoke<IpcResponse<null>>('app:open-install-folder');
  }

  async getDetails(): Promise<AppDetails | null> {
    const response = await window.electronAPI.invoke<IpcResponse<AppDetails>>('app:details');
    return response.success && response.data ? response.data : null;
  }

  async changeDbPath(): Promise<{ dbPath: string; restartRequired: boolean } | null> {
    const response = await window.electronAPI.invoke<IpcResponse<{ dbPath: string; restartRequired: boolean } | null>>('app:change-db-path');
    if (!response.success) {
      throw new Error(response.error ?? 'Errore sconosciuto');
    }
    return response.data ?? null;
  }
}
