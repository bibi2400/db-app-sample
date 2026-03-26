import { Injectable } from '@angular/core';
import { BackupInfo, BackupOptions, RestoreResult, BackupStats } from '../../../types/backup';
import { IpcResponse } from '../../../types/global';

@Injectable({
  providedIn: 'root'
})
export class ElectronBackupService {

  async createBackup(options: BackupOptions = {}): Promise<{ success: boolean; data?: BackupInfo; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<BackupInfo>>('backup:create', options);
      if (response.success && response.data) {
        console.log('Backup created:', response.data);
        return { success: true, data: response.data };
      } else {
        return { success: false, error: response.error ?? 'Unknown error' };
      }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async autoBackup(): Promise<{ success: boolean; data?: BackupInfo | null; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<BackupInfo | null>>('backup:auto');
      if (response.success) {
        console.log('Auto backup:', response.data);
        return { success: true, data: response.data ?? null };
      }
      return { success: false, error: response.error ?? 'Unknown error' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async listBackups(): Promise<{ success: boolean; data?: BackupInfo[]; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<BackupInfo[]>>('backup:list');
      if (response.success && response.data) {
        console.log('Loaded backups:', response.data);
        return { success: true, data: response.data };
      } else {
        return { success: false, error: response.error ?? 'Unknown error' };
      }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async restoreBackup(backupPath: string): Promise<{ success: boolean; data?: RestoreResult; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<RestoreResult>>('backup:restore', backupPath);
      if (response.success) {
        console.log('Restore result:', response.data);
        return { success: true, data: response.data };
      }
      return { success: false, error: response.error ?? 'Unknown error' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async deleteBackup(backupPath: string): Promise<{ success: boolean; data?: boolean; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<boolean>>('backup:delete', backupPath);
      if (response.success) {
        console.log('Delete result:', response.data);
        return { success: true, data: response.data };
      }
      return { success: false, error: response.error ?? 'Unknown error' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async getStats(): Promise<{ success: boolean; data?: BackupStats; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<BackupStats>>('backup:stats');
      if (response.success && response.data) {
        console.log('Backup stats:', response.data);
        return { success: true, data: response.data };
      } else {
        return { success: false, error: response.error ?? 'Unknown error' };
      }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}
