import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { ChangelogEntry, DownloadProgress, UpdateStatus, UpdateStatusType } from '../../types/update';
import { ConfirmDialogComponent } from '../../components/dialogs/confirm-dialog/confirm-dialog';
import { FullscreenLoaderComponent } from '../../components/fullscreen-loader/fullscreen-loader';
import { ElectronUpdateService } from '../../services/electron-api/electron-update.service';
import { NavigationService } from '../../services/navigation.service';

@Component({
  selector: 'app-update-management',
  imports: [
    MatButtonModule,
    MatIcon,
    MatCardModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    DatePipe,
    FullscreenLoaderComponent,
  ],
  templateUrl: './update-management.html',
  styleUrl: './update-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpdateManagement implements OnInit, OnDestroy {
  private updateService = inject(ElectronUpdateService);
  private navigationService = inject(NavigationService);
  private dialog = inject(MatDialog);
  private subscriptions: Subscription[] = [];

  status = signal<UpdateStatusType>('idle');
  currentVersion = signal('');
  availableVersion = signal<string | undefined>(undefined);
  releaseDate = signal<string | undefined>(undefined);
  releaseNotes = signal<string | undefined>(undefined);
  errorMessage = signal<string | undefined>(undefined);
  downloadPercent = signal(0);
  isPreparingDownload = signal(false);
  changelogs = signal<ChangelogEntry[]>([]);

  hasUpdate = computed(() => this.status() === 'available');
  isChecking = computed(() => this.status() === 'checking');
  isDownloading = computed(() => this.status() === 'downloading');
  isDownloaded = computed(() => this.status() === 'downloaded');
  isError = computed(() => this.status() === 'error');

  repairing = signal(false);

  showChangelog = computed(() => this.changelogs().length > 0);

  statusLabel = computed(() => {
    switch (this.status()) {
      case 'idle': return 'Nessun controllo effettuato';
      case 'checking': return 'Controllo in corso...';
      case 'available': return 'Aggiornamento disponibile';
      case 'not-available': return 'Nessun aggiornamento disponibile';
      case 'downloading': return 'Download in corso...';
      case 'downloaded': return 'Aggiornamento pronto per l\'installazione';
      case 'error': return 'Errore durante il controllo';
    }
  });

  statusIcon = computed(() => {
    switch (this.status()) {
      case 'idle': return 'info';
      case 'checking': return 'sync';
      case 'available': return 'new_releases';
      case 'not-available': return 'check_circle';
      case 'downloading': return 'downloading';
      case 'downloaded': return 'download_done';
      case 'error': return 'error';
    }
  });

  constructor() { }

  ngOnInit(): void {
    this.subscriptions.push(
      this.updateService.statusChanged$.subscribe(status => this.applyStatus(status)),
      this.updateService.downloadProgress$.subscribe(progress => this.applyProgress(progress)),
    );

    this.loadInitialStatus();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private async loadInitialStatus(): Promise<void> {
    const result = await this.updateService.getStatus();
    if (result.success && result.data) {
      this.applyStatus(result.data);
    }
  }

  private applyStatus(status: UpdateStatus): void {
    this.status.set(status.status);
    this.currentVersion.set(status.currentVersion);
    this.availableVersion.set(status.availableVersion);
    this.releaseDate.set(status.releaseDate);
    this.releaseNotes.set(status.releaseNotes);
    this.errorMessage.set(status.error);
    if (status.status === 'downloading' || status.status === 'error') {
      this.isPreparingDownload.set(false);
    }
    this.changelogs.set(status.changelogs ?? []);
  }

  private applyProgress(progress: DownloadProgress): void {
    this.downloadPercent.set(Math.round(progress.percent));
  }

  async checkForUpdates(): Promise<void> {
    this.errorMessage.set(undefined);
    await this.updateService.checkForUpdates();
  }

  async downloadUpdate(): Promise<void> {
    this.downloadPercent.set(0);
    this.isPreparingDownload.set(true);
    await this.updateService.downloadUpdate();
  }

  installUpdate(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Aggiornamento applicazione',
        message: "L'applicazione verrà riavviata per effettuare l'aggiornamento.\nDurante l'aggiornamento, l'applicazione rimarrà chiusa per diversi minuti e si riaprirà da sola al termine.\nNon tentare di riaprire l'app manualmente! Continuare?",
      },
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.updateService.installUpdate();
      }
    });
  }

  repairInstallation(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Ripara installazione',
        message: "Verrà scaricato e avviato l'installer della versione attuale in modalità interattiva.\nL'applicazione verrà chiusa durante la procedura.\nContinuare?",
      },
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.repairing.set(true);
        this.updateService.repairInstallation();
      }
    });
  }
}
