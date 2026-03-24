import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { Injectable } from '../helpers/mini-pie/decorators';
import { PushChannel, PushEvent } from '../decorators/push-channel.decorator';
import { PushEmitter } from '../helpers/push/push-emitter';
import { PushService } from './push.service';
import { DevModeService } from './dev-mode.service';
import { Logger } from '../helpers/logger';
import { RUNTIME_CONFIG } from '../config/runtime-config';

export type UpdateStatusType = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

export interface UpdateStatus {
  status: UpdateStatusType;
  currentVersion: string;
  availableVersion?: string;
  releaseDate?: string;
  releaseNotes?: string;
  error?: string;
}

export interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

@PushChannel('update')
@Injectable()
export class UpdaterService {
  @PushEvent('status-changed')
  readonly statusChanged = new PushEmitter<UpdateStatus>();

  @PushEvent('download-progress')
  readonly downloadProgress = new PushEmitter<DownloadProgress>();

  private currentStatus: UpdateStatus;

  constructor(
    private pushService: PushService,
    private devModeService: DevModeService,
  ) {
    this.currentStatus = {
      status: 'idle',
      currentVersion: app.getVersion(),
    };

    this.pushService.initializeChannel(this);
    this.configure();
    this.registerEvents();
  }

  private feedConfig!: { owner: string; repo: string };

  private configure(): void {
    autoUpdater.autoDownload = false;

    const pkg = JSON.parse(
      fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf-8')
    );

    this.feedConfig = {
      owner: pkg.publish?.owner ?? '',
      repo: pkg.publish?.repo ?? pkg.name,
    };

    autoUpdater.setFeedURL({
      provider: 'github',
      ...this.feedConfig,
      private: true,
      token: RUNTIME_CONFIG.GH_TOKEN,
    });
  }

  private registerEvents(): void {
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      const releaseNotes = this.extractReleaseNotes(info.releaseNotes);
      this.updateStatus({ status: 'available', availableVersion: info.version, releaseDate: info.releaseDate, releaseNotes });
    });

    autoUpdater.on('update-not-available', () => {
      this.updateStatus({ status: 'not-available' });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.updateStatus({ status: 'downloading' });
      this.downloadProgress.emit({
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    });

    autoUpdater.on('update-downloaded', () => {
      this.updateStatus({ status: 'downloaded' });
    });

    autoUpdater.on('error', (error: Error) => {
      this.updateStatus({ status: 'error', error: error.message });
    });
  }

  private extractReleaseNotes(notes: UpdateInfo['releaseNotes']): string | undefined {
    if (!notes) return undefined;
    if (typeof notes === 'string') return notes;
    return notes.map(n => n.note).filter(Boolean).join('\n\n') || undefined;
  }

  private updateStatus(partial: Partial<UpdateStatus>): void {
    this.currentStatus = { ...this.currentStatus, ...partial };
    this.statusChanged.emit(this.currentStatus);
    Logger.info('[Updater] Status:', this.currentStatus.status);
  }

  async checkForUpdates(): Promise<void> {
    this.updateStatus({ status: 'checking', error: undefined, availableVersion: undefined, releaseNotes: undefined, releaseDate: undefined });

    if (this.devModeService.isDev) {
      await this.mockCheckForUpdates();
      return;
    }

    await autoUpdater.checkForUpdates();
  }

  getStatus(): UpdateStatus {
    return { ...this.currentStatus };
  }

  async download(): Promise<void> {
    if (this.currentStatus.status !== 'available') {
      throw new Error('No update available to download');
    }

    if (this.devModeService.isDev) {
      await this.mockDownload();
      return;
    }

    await autoUpdater.downloadUpdate();
  }

  install(): void {
    if (this.currentStatus.status !== 'downloaded') {
      throw new Error('No update downloaded to install');
    }

    if (this.devModeService.isDev) {
      Logger.info('[Updater] Mock install - would restart app in production');
      this.updateStatus({ status: 'idle' });
      return;
    }

    autoUpdater.quitAndInstall(true, true);
  }

  // ==================== DEV MOCK METHODS ====================

  private async mockCheckForUpdates(): Promise<void> {
    Logger.info('[Updater] Using mock update check (dev mode)');

    // Simula delay di rete
    await this.delay(1500);

    // Simula un aggiornamento disponibile
    const mockVersion = this.incrementVersion(this.currentStatus.currentVersion);
    const mockReleaseNotes = `## Novità in v${mockVersion}

### 🚀 Nuove funzionalità
- Aggiunta funzione di esportazione dati in formato CSV
- Nuovo tema scuro per l'interfaccia
- Migliorata la ricerca con filtri avanzati

### 🐛 Bug fix
- Risolto problema di sincronizzazione database
- Corretti errori di visualizzazione su schermi retina
- Fix crash durante l'importazione di file grandi

### ⚡ Miglioramenti
- Performance di caricamento migliorate del 40%
- Ridotto consumo di memoria
- Ottimizzata gestione connessioni`;

    this.updateStatus({
      status: 'available',
      availableVersion: mockVersion,
      releaseDate: new Date().toISOString(),
      releaseNotes: mockReleaseNotes,
    });
  }

  private async mockDownload(): Promise<void> {
    Logger.info('[Updater] Using mock download (dev mode)');

    const totalSize = 85 * 1024 * 1024; // 85MB simulati
    const steps = 20;
    const stepSize = totalSize / steps;

    for (let i = 1; i <= steps; i++) {
      await this.delay(300 + Math.random() * 200); // 300-500ms per step

      const transferred = stepSize * i;
      const percent = (i / steps) * 100;
      const bytesPerSecond = 2 * 1024 * 1024 + Math.random() * 1024 * 1024; // 2-3 MB/s

      this.updateStatus({ status: 'downloading' });
      this.downloadProgress.emit({
        percent,
        bytesPerSecond,
        transferred,
        total: totalSize,
      });
    }

    await this.delay(500);
    this.updateStatus({ status: 'downloaded' });
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1; // Incrementa patch
    return parts.join('.');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
