import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { Injectable } from '../helpers/mini-pie/decorators';
import { PushChannel, PushEvent } from '../decorators/push-channel.decorator';
import { PushEmitter } from '../helpers/push/push-emitter';
import { PushService } from './push.service';
import { Logger } from '../helpers/logger';
import { RUNTIME_CONFIG } from '../config/runtime-config';

export type UpdateStatusType = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

export interface UpdateStatus {
  status: UpdateStatusType;
  currentVersion: string;
  availableVersion?: string;
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
  ) {
    this.currentStatus = {
      status: 'idle',
      currentVersion: app.getVersion(),
    };

    this.pushService.initializeChannel(this);
    this.configure();
    this.registerEvents();
  }

  private configure(): void {
    autoUpdater.autoDownload = false;

    const pkg = JSON.parse(
      fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf-8')
    );

    autoUpdater.setFeedURL({
      provider: 'github',
      owner: pkg.publish?.owner ?? '',
      repo: pkg.publish?.repo ?? pkg.name,
      private: true,
      token: RUNTIME_CONFIG.GH_TOKEN,
    });
  }

  private registerEvents(): void {
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.updateStatus({ status: 'available', availableVersion: info.version });
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

  private updateStatus(partial: Partial<UpdateStatus>): void {
    this.currentStatus = { ...this.currentStatus, ...partial };
    this.statusChanged.emit(this.currentStatus);
    Logger.info('[Updater] Status:', this.currentStatus.status);
  }

  async checkForUpdates(): Promise<void> {
    this.updateStatus({ status: 'checking', error: undefined, availableVersion: undefined });
    await autoUpdater.checkForUpdates();
  }

  getStatus(): UpdateStatus {
    return { ...this.currentStatus };
  }

  async download(): Promise<void> {
    if (this.currentStatus.status !== 'available') {
      throw new Error('No update available to download');
    }
    await autoUpdater.downloadUpdate();
  }

  install(): void {
    if (this.currentStatus.status !== 'downloaded') {
      throw new Error('No update downloaded to install');
    }
    autoUpdater.quitAndInstall(false, true);
  }
}
