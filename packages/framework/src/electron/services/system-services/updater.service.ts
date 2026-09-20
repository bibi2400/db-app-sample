import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { app, net } from 'electron';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { Injectable } from '../../helpers/mini-pie/decorators';
import { PushChannel, PushEvent } from '../../decorators/push-channel.decorator';
import { PushEmitter } from '../../helpers/push/push-emitter';
import { PushService } from './push.service';
import { DevModeService } from './dev-mode.service';
import { Logger } from '../../helpers/logger';
import { RuntimeConfigHolder } from '../../config/runtime-config';

export type UpdateStatusType = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

export interface UpdateStatus {
  status: UpdateStatusType;
  currentVersion: string;
  availableVersion?: string;
  releaseDate?: string;
  releaseNotes?: string;
  changelogs?: ChangelogEntry[];
  lastCheckedAt?: string;
  error?: string;
}


export interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  body: string;
}

@PushChannel('update')
@Injectable()
export class UpdaterService {
  @PushEvent('status-changed')
  readonly statusChanged = new PushEmitter<UpdateStatus>();

  @PushEvent('download-progress')
  readonly downloadProgress = new PushEmitter<DownloadProgress>();

  private static readonly CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
  private periodicCheckTimer: ReturnType<typeof setInterval> | null = null;
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
      token: RuntimeConfigHolder.get().GH_TOKEN,
    });
  }

  private registerEvents(): void {
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      const releaseNotes = this.extractReleaseNotes(info.releaseNotes);
      this.updateStatus({
        status: 'available',
        availableVersion: info.version,
        releaseDate: info.releaseDate,
        releaseNotes,
        lastCheckedAt: new Date().toISOString(),
      });
    });

    autoUpdater.on('update-not-available', () => {
      this.updateStatus({
        status: 'not-available',
        lastCheckedAt: new Date().toISOString(),
      });
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
      const lastCheckedAt = this.currentStatus.status === 'checking'
        ? new Date().toISOString()
        : this.currentStatus.lastCheckedAt;
      this.updateStatus({
        status: 'error',
        error: error.message,
        lastCheckedAt,
      });
    });
  }

  private extractReleaseNotes(notes: UpdateInfo['releaseNotes']): string | undefined {
    if (!notes) return undefined;
    if (typeof notes === 'string') return notes;
    return notes.map(n => n.note).filter(Boolean).join('\n\n') || undefined;
  }

  private statusListeners: ((status: UpdateStatus) => void)[] = [];

  onStatusChange(listener: (status: UpdateStatus) => void): void {
    this.statusListeners.push(listener);
  }

  private async updateStatus(partial: Partial<UpdateStatus>): Promise<void> {
    this.currentStatus = { ...this.currentStatus, ...partial };

    const status = { ...this.currentStatus };
    if (status.status === 'available' || status.status === 'downloading' || status.status === 'downloaded') {
      try {
        const all = await this.getChangelogs();
        status.changelogs = all.filter(e => this.isNewerVersion(e.version, status.currentVersion));
      } catch {
        status.changelogs = [];
      }
    }

    this.statusChanged.emit(status);
    this.statusListeners.forEach(fn => fn(status));
    Logger.info('[Updater] Status:', this.currentStatus.status);
  }

  startPeriodicCheck(): void {
    if (this.periodicCheckTimer) return;

    this.periodicCheckTimer = setInterval(() => {
      const skip: UpdateStatusType[] = ['checking', 'downloading', 'downloaded'];
      if (skip.includes(this.currentStatus.status)) {
        Logger.info('[Updater] Skipping periodic check (current status:', this.currentStatus.status + ')');
        return;
      }
      Logger.info('[Updater] Running periodic update check');
      this.checkForUpdates().catch(err => Logger.error('[Updater] Periodic check failed:', err));
    }, UpdaterService.CHECK_INTERVAL_MS);

    Logger.info('[Updater] Periodic update check started (every 30 min)');
  }

  stopPeriodicCheck(): void {
    if (this.periodicCheckTimer) {
      clearInterval(this.periodicCheckTimer);
      this.periodicCheckTimer = null;
      Logger.info('[Updater] Periodic update check stopped');
    }
  }

  async checkForUpdates(): Promise<void> {
    this.updateStatus({ status: 'checking', error: undefined, availableVersion: undefined, releaseNotes: undefined, releaseDate: undefined });

    if (this.devModeService.isDev) {
      await this.mockCheckForUpdates();
      return;
    }

    await autoUpdater.checkForUpdates();
  }

  async getStatus(): Promise<UpdateStatus> {
    const status = { ...this.currentStatus };
    if (status.status === 'available' || status.status === 'downloading' || status.status === 'downloaded') {
      try {
        const all = await this.getChangelogs();
        status.changelogs = all.filter(e => this.isNewerVersion(e.version, status.currentVersion));
      } catch {
        status.changelogs = [];
      }
    }
    return status;
  }

  private isNewerVersion(a: string, b: string): boolean {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] ?? 0;
      const nb = pb[i] ?? 0;
      if (na > nb) return true;
      if (na < nb) return false;
    }
    return false;
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
      this.updateStatus({
        status: 'not-available',
        currentVersion: this.currentStatus.availableVersion ?? this.currentStatus.currentVersion,
        availableVersion: undefined,
        releaseDate: undefined,
        releaseNotes: undefined,
        error: undefined,
        lastCheckedAt: new Date().toISOString(),
      });
      return;
    }

    autoUpdater.quitAndInstall(true, true);
  }

  async repairInstallation(): Promise<void> {
    if (this.devModeService.isDev) {
      Logger.info('[Updater] Mock repair - would re-run installer in production');
      return;
    }

    const version = this.currentStatus.currentVersion;
    const { owner, repo } = this.feedConfig;
    const tag = `v${version}`;

    Logger.info(`[Updater] Fetching installer for repair (${tag})...`);

    const releaseUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'electron-updater',
    };
    if (RuntimeConfigHolder.get().GH_TOKEN) {
      headers['Authorization'] = `token ${RuntimeConfigHolder.get().GH_TOKEN}`;
    }

    const releaseBody = await this.httpGet(releaseUrl, headers);
    const release = JSON.parse(releaseBody) as {
      assets: Array<{ name: string; url: string }>;
    };

    const installerAsset = release.assets.find(a => a.name.endsWith('.exe') && /setup/i.test(a.name));
    if (!installerAsset) {
      throw new Error(`Installer non trovato per la versione ${version}`);
    }

    const tmpDir = app.getPath('temp');
    const installerPath = path.join(tmpDir, installerAsset.name);

    Logger.info(`[Updater] Downloading installer to ${installerPath}...`);
    await this.downloadFile(installerAsset.url, installerPath, headers);

    Logger.info('[Updater] Launching installer in interactive mode...');
    spawn(installerPath, [], { detached: true, stdio: 'ignore' }).unref();

    setTimeout(() => app.quit(), 500);
  }

  private httpGet(url: string, headers: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = net.request({ url, method: 'GET' });
      for (const [key, value] of Object.entries(headers)) {
        request.setHeader(key, value);
      }
      let data = '';
      request.on('response', (response) => {
        response.on('data', (chunk) => { data += chunk.toString(); });
        response.on('end', () => resolve(data));
        response.on('error', reject);
      });
      request.on('error', reject);
      request.end();
    });
  }

  private downloadFile(assetUrl: string, dest: string, baseHeaders: Record<string, string>): Promise<void> {
    return new Promise((resolve, reject) => {
      const headers = {
        ...baseHeaders,
        'Accept': 'application/octet-stream',
      };
      const request = net.request({ url: assetUrl, method: 'GET' });
      for (const [key, value] of Object.entries(headers)) {
        request.setHeader(key, value);
      }
      const fileStream = fs.createWriteStream(dest);
      request.on('response', (response) => {
        response.on('data', (chunk) => fileStream.write(chunk));
        response.on('end', () => { fileStream.end(); resolve(); });
        response.on('error', (err) => { fileStream.destroy(); reject(err); });
      });
      request.on('error', (err) => { fileStream.destroy(); reject(err); });
      request.end();
    });
  }

  async getChangelogs(): Promise<ChangelogEntry[]> {
    if (this.devModeService.isDev) {
      return this.mockGetChangelogs();
    }

    try {
      const { owner, repo } = this.feedConfig;
      const url = `https://api.github.com/repos/${owner}/${repo}/releases`;
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'electron-updater',
      };
      if (RuntimeConfigHolder.get().GH_TOKEN) {
        headers['Authorization'] = `token ${RuntimeConfigHolder.get().GH_TOKEN}`;
      }

      const body = await new Promise<string>((resolve, reject) => {
        const request = net.request({ url, method: 'GET' });
        for (const [key, value] of Object.entries(headers)) {
          request.setHeader(key, value);
        }
        let data = '';
        request.on('response', (response) => {
          response.on('data', (chunk) => { data += chunk.toString(); });
          response.on('end', () => resolve(data));
          response.on('error', reject);
        });
        request.on('error', reject);
        request.end();
      });

      const releases = JSON.parse(body) as Array<{ tag_name: string; published_at: string; body: string; draft: boolean; prerelease: boolean }>;
      const isBetaChannel = this.currentStatus.currentVersion.includes('-beta');

      return releases
        .filter(r => !r.draft)
        .filter(r => isBetaChannel ? r.prerelease : !r.prerelease)
        .map(r => ({
          version: r.tag_name.replace(/^v/, ''),
          date: r.published_at,
          body: this.normalizeChangelogBody(r.body ?? ''),
        }));
    } catch (error) {
      Logger.error('[Updater] Failed to fetch changelogs:', error);
      return [];
    }
  }

  private normalizeChangelogBody(body: string): string {
    return body
      .split('\n')
      .map(line => {
        if (/^(\s*-\s*)/.test(line)) {
          const match = line.match(/^(\s*-\s*)/);
          const prefix = match![1];
          const content = line.slice(prefix.length);
          return content
            .split(/[;\n]/)
            .map(s => s.trim())
            .filter(Boolean)
            .map(s => `${prefix}${s}`)
            .join('\n');
        }
        return line;
      })
      .join('\n');
  }

  // ==================== DEV MOCK METHODS ====================

  private async mockCheckForUpdates(): Promise<void> {
    Logger.info('[Updater] Using mock update check (dev mode)');

    // Simula delay di rete
    await this.delay(1500);

    // Simula un aggiornamento disponibile
    const mockVersion = this.incrementVersion(this.incrementVersion(this.currentStatus.currentVersion));
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
      lastCheckedAt: new Date().toISOString(),
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

  private mockGetChangelogs(): ChangelogEntry[] {
    const current = this.currentStatus.currentVersion;
    const next = this.incrementVersion(current);
    const next2 = this.incrementVersion(next);
    const now = new Date();
    return [
      {
        version: next2,
        date: now.toISOString(),
        body: this.normalizeChangelogBody(`## Novità in v${next2}\n\n### 🚀 Nuove funzionalità\n- Aggiunta funzione di esportazione dati in formato CSV; Nuovo tema scuro per l'interfaccia\n- Migliorata la ricerca con filtri avanzati\n\n### 🐛 Bug fix\n- Risolto problema di sincronizzazione database; Corretti errori di visualizzazione su schermi retina\n\n### ⚡ Miglioramenti\n- Performance di caricamento migliorate del 40%\n- Ridotto consumo di memoria`),
      },
      {
        version: next,
        date: new Date(now.getTime() - 15 * 86400000).toISOString(),
        body: this.normalizeChangelogBody(`## Novità in v${next}\n\n### 🚀 Nuove funzionalità\n- Supporto notifiche push in tempo reale\n- Nuova pagina di gestione aggiornamenti\n\n### 🐛 Bug fix\n- Corretta gestione errori di rete; Fix nella paginazione delle tabelle`),
      },
      {
        version: current,
        date: new Date(now.getTime() - 30 * 86400000).toISOString(),
        body: this.normalizeChangelogBody(`## Novità in v${current}\n\n### 🚀 Nuove funzionalità\n- Aggiunta gestione backup automatici\n- Nuovo pannello notifiche\n\n### 🐛 Bug fix\n- Corretta gestione errori di rete\n- Fix nella paginazione delle tabelle`),
      },
      {
        version: this.decrementVersion(current, 1),
        date: new Date(now.getTime() - 75 * 86400000).toISOString(),
        body: this.normalizeChangelogBody(`## Novità in v${this.decrementVersion(current, 1)}\n\n### 🚀 Nuove funzionalità\n- Prima release con supporto aggiornamenti automatici\n- Dashboard iniziale\n\n### 🐛 Bug fix\n- Varie correzioni di stabilità`),
      },
    ];
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1; // Incrementa patch
    return parts.join('.');
  }

  private decrementVersion(version: string, step: number): string {
    const parts = version.split('.').map(Number);
    parts[2] = Math.max(0, (parts[2] || 0) - step);
    return parts.join('.');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
