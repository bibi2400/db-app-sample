import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationService } from '../../services/navigation.service';
import { AppDetails, ElectronAppService } from '../../services/electron-api/electron-app.service';
import { ElectronUploadService } from '../../services/electron-api/electron-upload.service';
import { DialogService } from '../../services/dialog.service';
import { DatabaseUiService } from '../../services/database-ui.service';

@Component({
  selector: 'app-info',
  imports: [
    MatCardModule,
    MatIcon,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './app-info.html',
  styleUrl: './app-info.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppInfo implements OnInit {
  readonly databaseUi = inject(DatabaseUiService);
  private navigationService = inject(NavigationService);
  private appService = inject(ElectronAppService);
  private uploadService = inject(ElectronUploadService);
  private dialogService = inject(DialogService);

  details = signal<AppDetails | null>(null);
  dbPathError = signal<string | null>(null);
  uploadRepoPath = signal<string | null>(null);
  uploadRepoError = signal<string | null>(null);

  ngOnInit(): void {
    this.navigationService.clearToolbarActions();
    this.loadDetails();
    this.loadUploadRepoPath();
  }

  private async loadDetails(): Promise<void> {
    const data = await this.appService.getDetails();
    if (data) {
      this.details.set(data);
    }
  }

  private async loadUploadRepoPath(): Promise<void> {
    const result = await this.uploadService.getRepositoryPath();
    if (result.success && result.data) {
      this.uploadRepoPath.set(result.data);
    }
  }

  openAppData(): void {
    this.appService.openAppData();
  }

  openDbFolder(): void {
    if (!this.databaseUi.enabled) return;
    this.appService.openDbFolder();
  }

  openInstallFolder(): void {
    this.appService.openInstallFolder();
  }

  async changeDbPath(): Promise<void> {
    if (!this.databaseUi.enabled) return;
    this.dbPathError.set(null);
    try {
      const result = await this.appService.changeDbPath();
      if (!result) return; // dialog cancelled

      this.details.update(d => d ? { ...d, dbPath: result.dbPath } : d);

      if (result.restartRequired) {
        const confirmed = await this.dialogService.confirm(
          'Riavvio necessario',
          'Il percorso del database è stato aggiornato.\nÈ necessario riavviare l\'applicazione per applicare la modifica.\n\nRiavviare ora?',
        );
        if (confirmed) {
          this.appService.reload();
        }
      }
    } catch (err) {
      this.dbPathError.set(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  }

  async changeUploadRepoPath(): Promise<void> {
    this.uploadRepoError.set(null);
    const result = await this.uploadService.selectRepositoryPath();
    if (!result.success) {
      this.uploadRepoError.set(result.error ?? 'Errore sconosciuto');
      return;
    }
    if (result.data) {
      this.uploadRepoPath.set(result.data);
    }
  }

  openUploadRepo(): void {
    void this.uploadService.openRepository();
  }
}
