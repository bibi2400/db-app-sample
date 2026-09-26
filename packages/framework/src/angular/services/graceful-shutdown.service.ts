import { inject, Injectable } from '@angular/core';
import { DialogService } from './dialog.service';
import { ElectronAppService } from './electron-api/electron-app.service';
import { ElectronBackupService } from './electron-api/electron-backup.service';
import { DatabaseUiService } from './database-ui.service';

@Injectable({ providedIn: 'root' })
export class GracefulShutdownService {
  private readonly dialogService = inject(DialogService);
  private readonly appService = inject(ElectronAppService);
  private readonly backupService = inject(ElectronBackupService);
  private readonly databaseUi = inject(DatabaseUiService);

  async quit(): Promise<void> {
    const confirmed = await this.dialogService.confirm(
      'Chiudi applicazione',
      this.databaseUi.enabled
        ? 'Vuoi chiudere l\'applicazione?\n\nSe non esiste già un backup valido di oggi, ' +
          'verrà creato un backup automatico del database e degli allegati.'
        : 'Vuoi chiudere l’applicazione?',
    );

    if (!confirmed) return;

    const result = await this.backupService.autoBackup();
    if (!result.success) {
      const quitWithoutBackup = await this.dialogService.confirm(
        this.databaseUi.enabled ? 'Backup automatico non riuscito' : 'Protezione dei dati non riuscita',
        (this.databaseUi.enabled
          ? 'Non è stato possibile verificare o creare il backup di oggi.\n\n'
          : 'Non è stato possibile completare la protezione dei dati.\n\n') +
            'Vuoi chiudere comunque l’applicazione?',
      );
      if (!quitWithoutBackup) return;
    }

    await this.appService.quit();
  }
}
