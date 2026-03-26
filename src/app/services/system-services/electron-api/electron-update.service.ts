import { inject, Injectable } from '@angular/core';
import { ElectronPushService } from './electron-push.service';
import { DownloadProgress, UpdateStatus } from '../../../types/update';
import { IpcResponse } from '../../../types/global';

@Injectable({
  providedIn: 'root'
})
export class ElectronUpdateService {
  private pushService = inject(ElectronPushService);

  /** Observable of update status changes (push from main process) */
  readonly statusChanged$ = this.pushService.on<UpdateStatus>('push:update:status-changed');

  /** Observable of download progress updates (push from main process) */
  readonly downloadProgress$ = this.pushService.on<DownloadProgress>('push:update:download-progress');

  /** Trigger a check for updates */
  async checkForUpdates(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<void>>('update:check');
      return { success: response.success, error: response.error };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /** Get current update status */
  async getStatus(): Promise<{ success: boolean; data?: UpdateStatus; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<UpdateStatus>>('update:status');
      if (response.success && response.data) {
        return { success: true, data: response.data };
      }
      return { success: false, error: response.error ?? 'Unknown error' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /** Start downloading the available update */
  async downloadUpdate(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<null>>('update:download');
      return { success: response.success, error: response.error };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /** Quit the app and install the downloaded update */
  async installUpdate(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<null>>('update:install');
      return { success: response.success, error: response.error };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /** Re-run the current version's installer in interactive mode */
  async repairInstallation(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<null>>('update:repair');
      return { success: response.success, error: response.error };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

}
