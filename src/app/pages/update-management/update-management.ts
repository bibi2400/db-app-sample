import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subscription } from 'rxjs';
import { ElectronUpdateService } from '../../services/electron-api/electron-update.service';
import { NavigationService } from '../../services/navigation.service';
import { DownloadProgress, UpdateStatus, UpdateStatusType } from '../../types/update';

@Component({
  selector: 'app-update-management',
  imports: [
    MatButtonModule,
    MatIcon,
    MatCardModule,
    MatProgressBarModule,
  ],
  templateUrl: './update-management.html',
  styleUrl: './update-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpdateManagement implements OnInit, OnDestroy {
  private updateService = inject(ElectronUpdateService);
  private navigationService = inject(NavigationService);
  private subscriptions: Subscription[] = [];

  status = signal<UpdateStatusType>('idle');
  currentVersion = signal('');
  availableVersion = signal<string | undefined>(undefined);
  errorMessage = signal<string | undefined>(undefined);
  downloadPercent = signal(0);

  hasUpdate = computed(() => this.status() === 'available');
  isChecking = computed(() => this.status() === 'checking');
  isDownloading = computed(() => this.status() === 'downloading');
  isDownloaded = computed(() => this.status() === 'downloaded');
  isError = computed(() => this.status() === 'error');

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

  constructor() {
    this.navigationService.setTitle('Aggiornamenti', 'system_update');
  }

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
    this.errorMessage.set(status.error);
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
    await this.updateService.downloadUpdate();
  }

  async installUpdate(): Promise<void> {
    await this.updateService.installUpdate();
  }
}
