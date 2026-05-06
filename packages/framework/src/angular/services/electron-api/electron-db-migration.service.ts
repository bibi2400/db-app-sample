import { Injectable } from '@angular/core';
import { IpcResponse } from '../../types/global';

@Injectable({
  providedIn: 'root'
})
export class ElectronDbMigrationService {
  /**
   * Run all pending runtime DB migrations.
   * Blocks until all migrations complete (or one fails).
   * Should be called once at Angular startup before navigating to the app.
   */
  async run(): Promise<IpcResponse<void>> {
    return window.electronAPI.invoke<IpcResponse<void>>('db-migration:run');
  }
}
