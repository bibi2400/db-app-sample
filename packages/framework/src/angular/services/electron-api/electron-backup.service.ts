import { Injectable } from '@angular/core';
import { BackupInfo, BackupOptions, RestoreResult, BackupStats } from '../../types/backup';
import { IpcResponse } from '../../types/global';

@Injectable({
  providedIn: 'root',
})
export class ElectronBackupService {
  async createBackup(options: BackupOptions = {}): Promise<IpcResponse<BackupInfo>> {
    return this.invoke('backup:create', options);
  }

  async autoBackup(): Promise<IpcResponse<BackupInfo | null>> {
    return this.invoke('backup:auto');
  }

  async listBackups(): Promise<IpcResponse<BackupInfo[]>> {
    const result = await this.invoke<BackupInfo[]>('backup:list');
    if (result.success && result.data) {
      result.data = result.data.map(backup => ({ ...backup, date: new Date(backup.date) }));
    }
    return result;
  }

  async restoreBackup(backupPath: string): Promise<IpcResponse<RestoreResult>> {
    return this.invoke('backup:restore', backupPath);
  }

  async deleteBackup(backupPath: string): Promise<IpcResponse<boolean>> {
    return this.invoke('backup:delete', backupPath);
  }

  async getStats(): Promise<IpcResponse<BackupStats>> {
    return this.invoke('backup:stats');
  }

  private async invoke<T>(channel: string, payload?: unknown): Promise<IpcResponse<T>> {
    try {
      return await window.electronAPI.invoke<IpcResponse<T>>(channel, payload);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Operazione backup non riuscita.',
      };
    }
  }
}
