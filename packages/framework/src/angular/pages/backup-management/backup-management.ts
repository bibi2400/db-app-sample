import { Component, ChangeDetectionStrategy, signal, inject, computed, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatePipe } from '@angular/common';
import { BackupInfo } from '../../types/backup';
import { NavigationService } from '../../services/navigation.service';
import { ElectronAppService } from '../../services/electron-api/electron-app.service';
import { ElectronBackupService } from '../../services/electron-api/electron-backup.service';
import { DialogService } from '../../services/dialog.service';
import { FullscreenLoaderComponent } from '../../components/fullscreen-loader/fullscreen-loader';

type BackupOperation = 'create' | 'restore' | 'delete' | 'reload';

@Component({
  selector: 'app-backup-management',
  imports: [
    MatButtonModule,
    MatIcon,
    MatSnackBarModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    FullscreenLoaderComponent,
    DatePipe,
  ],
  templateUrl: './backup-management.html',
  styleUrl: './backup-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackupManagement implements OnInit {
  private readonly backupService = inject(ElectronBackupService);
  private readonly appService = inject(ElectronAppService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogService = inject(DialogService);
  private readonly navigationService = inject(NavigationService);
  private retry?: () => Promise<void>;

  readonly backups = signal<BackupInfo[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly operation = signal<BackupOperation | null>(null);
  readonly confirming = signal(false);
  readonly error = signal<string | null>(null);
  readonly reloadRequired = signal(false);
  readonly busy = computed(() => this.loading() || this.operation() !== null || this.confirming());
  readonly stats = computed(() => ({
    count: this.backups().length,
    totalSize: this.backups().reduce((sum, backup) => sum + backup.size, 0),
  }));
  readonly groups = computed(() => [
    {
      title: 'Backup automatici',
      icon: 'schedule',
      backups: this.backups().filter(backup => backup.type === 'auto'),
    },
    {
      title: 'Backup manuali',
      icon: 'save',
      backups: this.backups().filter(backup => backup.type === 'manual'),
    },
  ]);
  readonly operationMessage = computed(() => {
    switch (this.operation()) {
      case 'create': return 'Creazione e verifica del backup e degli allegati…';
      case 'restore': return 'Ripristino del database e degli allegati…';
      case 'delete': return 'Eliminazione del backup…';
      case 'reload': return 'Ripristino completato. Ricaricamento dell’applicazione…';
      default: return '';
    }
  });

  ngOnInit(): void {
    this.navigationService.clearToolbarActions();
    void this.loadBackups();
  }

  async loadBackups(): Promise<void> {
    if (this.busy() || this.reloadRequired()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.refresh();
    } catch (error) {
      this.setError(error, () => this.loadBackups());
    } finally {
      this.loading.set(false);
    }
  }

  async createManualBackup(): Promise<void> {
    if (this.busy() || this.reloadRequired()) return;
    await this.run('create', async () => {
      const result = await this.backupService.createBackup({ type: 'manual' });
      if (!result.success || !result.data) throw new Error(result.error ?? 'Backup non creato.');
      this.snackBar.open('Backup e allegati salvati e verificati', 'Chiudi', { duration: 4000 });
    }, () => this.createManualBackup());
  }

  async restoreBackup(backup: BackupInfo): Promise<void> {
    if (this.busy() || this.reloadRequired()) return;
    this.confirming.set(true);
    try {
      const confirmed = await this.dialogService.confirm(
        'Ripristinare il backup?',
        [
          `Backup: ${backup.filename}`,
          `Data: ${backup.date.toLocaleString('it')}`,
          backup.includesAttachments
            ? 'Verranno ripristinati il database e gli allegati salvati.'
            : 'Questo backup contiene solo il database. ' +
              'Gli allegati saranno verificati nel repository attuale.',
          'Salva le attività in corso. Verrà creato un backup di sicurezza prima del ripristino.',
          'Al termine l’applicazione verrà ricaricata.',
        ].join('\n\n'),
      );
      if (!confirmed) return;
    } catch (error) {
      this.setError(error, () => this.restoreBackup(backup));
      return;
    } finally {
      this.confirming.set(false);
    }
    await this.run('restore', async () => {
      const result = await this.backupService.restoreBackup(backup.path);
      if (!result.success || !result.data?.success) {
        throw new Error(result.error ?? result.data?.message ?? 'Ripristino non riuscito.');
      }
      this.reloadRequired.set(true);
      await this.reload();
    }, () => this.restoreBackup(backup));
  }

  async deleteBackup(backup: BackupInfo): Promise<void> {
    if (this.busy() || this.reloadRequired()) return;
    this.confirming.set(true);
    try {
      const confirmed = await this.dialogService.confirm(
        'Eliminare il backup?',
        `Verranno eliminati "${backup.filename}" e i suoi allegati salvati.\n\n` +
          'Questa operazione non può essere annullata.',
      );
      if (!confirmed) return;
    } catch (error) {
      this.setError(error, () => this.deleteBackup(backup));
      return;
    } finally {
      this.confirming.set(false);
    }
    await this.run('delete', async () => {
      const result = await this.backupService.deleteBackup(backup.path);
      if (!result.success || result.data !== true) {
        throw new Error(result.error ?? 'Backup non eliminato.');
      }
      this.snackBar.open('Backup eliminato', 'Chiudi', { duration: 3000 });
    }, () => this.deleteBackup(backup));
  }

  async retryOperation(): Promise<void> {
    if (this.busy()) return;
    if (this.reloadRequired()) await this.reload();
    else await this.retry?.();
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  private async refresh(): Promise<void> {
    const result = await this.backupService.listBackups();
    if (!result.success || !result.data) throw new Error(result.error ?? 'Elenco backup non disponibile.');
    this.backups.set(result.data);
    this.loaded.set(true);
  }

  private async run(
    operation: BackupOperation,
    action: () => Promise<void>,
    retry: () => Promise<void>,
  ): Promise<void> {
    this.operation.set(operation);
    this.error.set(null);
    try {
      await action();
      if (!this.reloadRequired()) {
        try {
          await this.refresh();
        } catch (error) {
          this.setError(error, () => this.loadBackups());
        }
      }
    } catch (error) {
      this.setError(error, retry);
    } finally {
      if (!this.reloadRequired() || this.error()) this.operation.set(null);
    }
  }

  private async reload(): Promise<void> {
    this.operation.set('reload');
    this.error.set(null);
    try {
      await this.appService.reload();
      // Keep the loader active until the renderer is replaced.
    } catch (error) {
      this.operation.set(null);
      this.setError(error, () => this.reload());
    }
  }

  private setError(error: unknown, retry: () => Promise<void>): void {
    this.error.set(error instanceof Error ? error.message : 'Operazione non riuscita. Riprova.');
    this.retry = retry;
  }
}
