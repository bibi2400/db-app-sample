import { inject, Injectable } from '@angular/core';
import { DialogService } from './dialog.service';
import { ElectronAppService } from './electron-api/electron-app.service';
import { ElectronBackupService } from './electron-api/electron-backup.service';

@Injectable({ providedIn: 'root' })
export class GracefulShutdownService {
  private readonly dialogService = inject(DialogService);
  private readonly appService = inject(ElectronAppService);
  private readonly backupService = inject(ElectronBackupService);

  async quit(): Promise<void> {
    const confirmed = await this.dialogService.confirm(
      'Chiudi applicazione',
      'Vuoi chiudere l\'applicazione?\n\nVerrà eseguito un backup automatico del database prima della chiusura.',
    );

    if (!confirmed) return;

    try {
      await this.backupService.autoBackup();
    } catch (error) {
      console.warn('[GracefulShutdown] Backup automatico fallito, procedo con la chiusura:', error);
    }

    await this.appService.quit();
  }
}
