import { Component, ChangeDetectionStrategy, signal, inject, computed } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';
import { BackupInfo, BackupStats } from '../../types/backup';
import { NavigationService } from '../../services/navigation.service';
import { ElectronAppService } from '../../services/electron-api/electron-app.service';
import { ElectronBackupService } from '../../services/electron-api/electron-backup.service';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-backup-management',
  imports: [
    MatButtonModule,
    MatIcon,
    MatSnackBarModule,
    MatCardModule,
    MatProgressSpinnerModule,
    DatePipe
  ],
  templateUrl: './backup-management.html',
  styleUrl: './backup-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BackupManagement {
  private backupService = inject(ElectronBackupService);
  private appService = inject(ElectronAppService);
  private snackBar = inject(MatSnackBar);
  private dialogService = inject(DialogService);
  private navigationService = inject(NavigationService);

  backups = signal<BackupInfo[]>([]);
  stats = signal<BackupStats | null>(null);
  loading = signal(false);
  processing = signal(false);

  autoBackups = computed(() => this.backups().filter(b => b.type === 'auto'));
  manualBackups = computed(() => this.backups().filter(b => b.type === 'manual'));

  constructor() {
    this.loadBackups();
    this.loadStats();
  }

  async loadBackups(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await this.backupService.listBackups();
      if (response.success && response.data) {
        // Converti le date da stringa a Date
        const backupsWithDates = response.data.map(b => ({
          ...b,
          date: new Date(b.date)
        }));
        this.backups.set(backupsWithDates);
      } else {
        this.snackBar.open('Errore nel caricamento dei backup', 'Chiudi', { duration: 3000 });
      }
    } catch (error) {
      this.snackBar.open('Errore nel caricamento dei backup', 'Chiudi', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }

  async loadStats(): Promise<void> {
    try {
      const response = await this.backupService.getStats();
      if (response.success && response.data) {
        this.stats.set(response.data);
      }
    } catch (error) {
      console.error('Errore nel caricamento delle statistiche:', error);
    }
  }

  async createManualBackup(): Promise<void> {
    this.processing.set(true);
    try {
      const response = await this.backupService.createBackup({ type: 'manual' });
      if (response.success && response.data) {
        this.snackBar.open('Backup creato con successo', 'Chiudi', { duration: 3000 });
        await this.loadBackups();
        await this.loadStats();
      } else {
        this.snackBar.open(`Errore: ${response.error}`, 'Chiudi', { duration: 5000 });
      }
    } catch (error) {
      this.snackBar.open('Errore nella creazione del backup', 'Chiudi', { duration: 3000 });
    } finally {
      this.processing.set(false);
    }
  }

  async restoreBackup(backup: BackupInfo): Promise<void> {
    const confirmed = await this.dialogService.confirm(
      'Ripristinare il backup?',
      `Sei sicuro di voler ripristinare il backup "${backup.filename}"?\n\nData: ${backup.date.toLocaleString()}\nDimensione: ${this.formatSize(backup.size)}\n\nIl database corrente verrà sostituito (ma sarà creato un backup di sicurezza).`,
    );

    if (!confirmed) return;

    this.processing.set(true);
    try {
      const response = await this.backupService.restoreBackup(backup.path);
      if (response.success && response.data) {
        const result = response.data;
        if (result.success) {
          this.snackBar.open(
            result.backupCreated
              ? 'Ripristino completato! Backup di sicurezza creato.'
              : 'Ripristino completato!',
            'Chiudi',
            { duration: 5000 }
          );
          // Ricarica l'applicazione per applicare i cambiamenti
          setTimeout(() => {
            this.appService.reload();
          }, 2000);
        } else {
          this.snackBar.open(`Errore: ${result.message}`, 'Chiudi', { duration: 5000 });
        }
      } else {
        this.snackBar.open(`Errore: ${response.error}`, 'Chiudi', { duration: 5000 });
      }
    } catch (error) {
      this.snackBar.open('Errore nel ripristino del backup', 'Chiudi', { duration: 3000 });
    } finally {
      this.processing.set(false);
    }
  }

  async deleteBackup(backup: BackupInfo): Promise<void> {
    const confirmed = await this.dialogService.confirm(
      'Eliminare il backup?',
      `Sei sicuro di voler eliminare il backup "${backup.filename}"?\n\nQuesta operazione non può essere annullata.`,
    );

    if (!confirmed) return;

    this.processing.set(true);
    try {
      const response = await this.backupService.deleteBackup(backup.path);
      if (response.success && response.data) {
        this.snackBar.open('Backup eliminato', 'Chiudi', { duration: 3000 });
        await this.loadBackups();
        await this.loadStats();
      } else {
        this.snackBar.open(`Errore: ${response.error}`, 'Chiudi', { duration: 5000 });
      }
    } catch (error) {
      this.snackBar.open('Errore nell\'eliminazione del backup', 'Chiudi', { duration: 3000 });
    } finally {
      this.processing.set(false);
    }
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  getBackupIcon(type: 'auto' | 'manual'): string {
    return type === 'auto' ? 'schedule' : 'save';
  }
}
