import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';
import {
  ChangelogEntry,
  DownloadProgress,
  UpdateStatus,
  UpdateStatusType,
} from '../../types/update';
import { FullscreenLoaderComponent } from '../../components/fullscreen-loader/fullscreen-loader';
import { DialogService } from '../../services/dialog.service';
import { ElectronUpdateService } from '../../services/electron-api/electron-update.service';

interface ChangelogBlock {
  type: 'heading' | 'list' | 'paragraph';
  text?: string;
  items?: string[];
}

interface ChangelogView extends ChangelogEntry {
  blocks: ChangelogBlock[];
}

@Component({
  selector: 'app-update-management',
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatExpansionModule,
    MatIcon,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    FullscreenLoaderComponent,
  ],
  templateUrl: './update-management.html',
  styleUrl: './update-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateManagement implements OnInit, OnDestroy {
  private readonly updateService = inject(ElectronUpdateService);
  private readonly dialogService = inject(DialogService);
  private readonly subscriptions: Subscription[] = [];

  readonly status = signal<UpdateStatusType>('idle');
  readonly currentVersion = signal('');
  readonly availableVersion = signal<string | undefined>(undefined);
  readonly releaseDate = signal<string | undefined>(undefined);
  readonly releaseNotes = signal<string | undefined>(undefined);
  readonly lastCheckedAt = signal<string | undefined>(undefined);
  readonly errorMessage = signal<string | undefined>(undefined);
  readonly downloadPercent = signal(0);
  readonly downloadTransferred = signal(0);
  readonly downloadTotal = signal(0);
  readonly downloadBytesPerSecond = signal(0);
  readonly isPreparingDownload = signal(false);
  readonly isInstalling = signal(false);
  readonly automaticInstallPending = signal(false);
  readonly repairing = signal(false);
  readonly changelogs = signal<ChangelogEntry[]>([]);

  readonly hasUpdate = computed(() => this.status() === 'available');
  readonly isChecking = computed(() => this.status() === 'checking');
  readonly isDownloading = computed(() => this.status() === 'downloading');
  readonly isDownloaded = computed(() => this.status() === 'downloaded');
  readonly isError = computed(() => this.status() === 'error');
  readonly isBusy = computed(
    () =>
      this.isChecking()
      || this.isDownloading()
      || this.isPreparingDownload()
      || this.isInstalling()
      || this.repairing(),
  );

  readonly statusLabel = computed(() => {
    if (this.isDownloaded() && (this.automaticInstallPending() || this.isInstalling())) {
      return 'Download completato';
    }

    switch (this.status()) {
      case 'idle':
        return 'Controlla gli aggiornamenti';
      case 'checking':
        return 'Ricerca aggiornamenti in corso';
      case 'available':
        return 'È disponibile un aggiornamento';
      case 'not-available':
        return "L'applicazione è aggiornata";
      case 'downloading':
        return "Download dell'aggiornamento";
      case 'downloaded':
        return "L'aggiornamento è pronto";
      case 'error':
        return 'Operazione non riuscita';
    }
  });

  readonly statusDescription = computed(() => {
    if (this.isDownloaded() && (this.automaticInstallPending() || this.isInstalling())) {
      return "L'applicazione verrà riavviata automaticamente tra pochi istanti.";
    }

    switch (this.status()) {
      case 'idle':
        return 'Verifica se è disponibile una versione più recente.';
      case 'checking':
        return 'Stiamo contattando il servizio di aggiornamento.';
      case 'available':
        return 'Scarica la nuova versione e installala con un solo passaggio.';
      case 'not-available':
        return 'Stai già utilizzando la versione più recente disponibile.';
      case 'downloading':
        return 'Puoi continuare a utilizzare l’app durante il download.';
      case 'downloaded':
        return "Riavvia l'applicazione per completare l'installazione.";
      case 'error':
        return 'Controlla la connessione e riprova. I dettagli tecnici sono disponibili qui sotto.';
    }
  });

  readonly statusIcon = computed(() => {
    if (this.isDownloaded() && (this.automaticInstallPending() || this.isInstalling())) {
      return 'restart_alt';
    }

    switch (this.status()) {
      case 'idle':
        return 'system_update';
      case 'checking':
        return 'sync';
      case 'available':
        return 'new_releases';
      case 'not-available':
        return 'check_circle';
      case 'downloading':
        return 'downloading';
      case 'downloaded':
        return 'download_done';
      case 'error':
        return 'error';
    }
  });

  readonly downloadDetails = computed(() => {
    const transferred = this.downloadTransferred();
    const total = this.downloadTotal();
    const speed = this.downloadBytesPerSecond();
    const details: string[] = [];

    if (total > 0) {
      details.push(`${this.formatBytes(transferred)} di ${this.formatBytes(total)}`);
    }
    if (speed > 0) {
      details.push(`${this.formatBytes(speed)}/s`);
      const remainingSeconds = Math.max(0, Math.ceil((total - transferred) / speed));
      if (remainingSeconds > 0) {
        details.push(`circa ${this.formatDuration(remainingSeconds)} rimanenti`);
      }
    }

    return details.join(' · ');
  });

  readonly changelogViews = computed<ChangelogView[]>(() => {
    let entries = this.changelogs();

    if (entries.length === 0 && this.releaseNotes()) {
      entries = [
        {
          version: this.availableVersion() ?? '',
          date: this.releaseDate() ?? '',
          body: this.releaseNotes() ?? '',
        },
      ];
    }

    return entries.map((entry) => ({
      ...entry,
      blocks: this.parseChangelogBody(entry.body),
    }));
  });

  readonly showChangelog = computed(() => this.changelogViews().length > 0);

  ngOnInit(): void {
    this.subscriptions.push(
      this.updateService.statusChanged$.subscribe((status) => this.applyStatus(status)),
      this.updateService.downloadProgress$.subscribe((progress) => this.applyProgress(progress)),
    );

    void this.loadInitialStatus();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  async checkForUpdates(): Promise<void> {
    if (this.isBusy() || this.isDownloaded()) {
      return;
    }

    this.errorMessage.set(undefined);
    this.status.set('checking');
    const result = await this.updateService.checkForUpdates();

    if (!result.success) {
      this.setOperationError(result.error);
    }
  }

  async startUpdateFlow(): Promise<void> {
    if (!this.hasUpdate() || this.isBusy()) {
      return;
    }

    const confirmed = await this.confirmDownloadAndInstall();
    if (!confirmed) {
      return;
    }

    this.errorMessage.set(undefined);
    this.downloadPercent.set(0);
    this.downloadTransferred.set(0);
    this.downloadTotal.set(0);
    this.downloadBytesPerSecond.set(0);
    this.isPreparingDownload.set(true);
    this.automaticInstallPending.set(true);

    const downloadResult = await this.updateService.downloadUpdate();
    this.isPreparingDownload.set(false);

    if (!downloadResult.success) {
      this.automaticInstallPending.set(false);
      this.setOperationError(downloadResult.error);
      return;
    }

    await this.installDownloadedUpdate(false);
  }

  async installDownloadedUpdate(requireConfirmation = true): Promise<void> {
    if (this.isInstalling()) {
      return;
    }

    if (requireConfirmation) {
      const confirmed = await this.confirmInstall();
      if (!confirmed) {
        return;
      }
    }

    this.errorMessage.set(undefined);
    this.isInstalling.set(true);
    this.automaticInstallPending.set(true);
    const result = await this.updateService.installUpdate();

    if (!result.success) {
      this.isInstalling.set(false);
      this.automaticInstallPending.set(false);
      this.errorMessage.set(result.error ?? "Impossibile avviare l'installazione.");
    }
  }

  async repairInstallation(): Promise<void> {
    if (this.isBusy()) {
      return;
    }

    const confirmed = await this.dialogService.open<boolean>(
      {
        title: 'Ripara installazione',
        titleIcon: 'build',
        titleIconColor: '#f57c00',
        message: [
          "Verrà scaricato l'installer della versione attuale.",
          "L'applicazione verrà chiusa e la procedura guidata verrà avviata automaticamente.",
        ],
        buttons: [
          { label: 'Annulla', value: false },
          {
            label: 'Avvia riparazione',
            value: true,
            variant: 'flat',
            color: 'primary',
            icon: 'build',
          },
        ],
      },
      { width: '520px' },
    );

    if (!confirmed) {
      return;
    }

    this.errorMessage.set(undefined);
    this.repairing.set(true);
    const result = await this.updateService.repairInstallation();

    if (!result.success) {
      this.repairing.set(false);
      this.errorMessage.set(result.error ?? 'Impossibile avviare la riparazione.');
      return;
    }

    this.repairing.set(false);
  }

  private async loadInitialStatus(): Promise<void> {
    const result = await this.updateService.getStatus();

    if (result.success && result.data) {
      this.applyStatus(result.data);
      return;
    }

    this.setOperationError(result.error);
  }

  private applyStatus(status: UpdateStatus): void {
    this.status.set(status.status);
    this.currentVersion.set(status.currentVersion);
    this.availableVersion.set(status.availableVersion);
    this.releaseDate.set(status.releaseDate);
    this.releaseNotes.set(status.releaseNotes);
    this.lastCheckedAt.set(status.lastCheckedAt);
    this.errorMessage.set(status.error);
    this.changelogs.set(status.changelogs ?? []);

    if (status.status === 'idle' && this.isInstalling()) {
      this.isInstalling.set(false);
      this.automaticInstallPending.set(false);
    }

    if (
      status.status === 'downloading'
      || status.status === 'downloaded'
      || status.status === 'error'
    ) {
      this.isPreparingDownload.set(false);
    }
  }

  private applyProgress(progress: DownloadProgress): void {
    this.downloadPercent.set(Math.round(progress.percent));
    this.downloadTransferred.set(progress.transferred);
    this.downloadTotal.set(progress.total);
    this.downloadBytesPerSecond.set(progress.bytesPerSecond);
  }

  private async confirmDownloadAndInstall(): Promise<boolean> {
    const version = this.availableVersion();
    const versionMessage = version
      ? `Verrà installata la versione ${version}.`
      : 'Verrà installata la nuova versione disponibile.';
    const result = await this.dialogService.open<boolean>(
      {
        title: 'Scarica e installa aggiornamento',
        titleIcon: 'system_update',
        titleIconColor: '#1976d2',
        message: [
          versionMessage,
          'Al termine del download, l’app si chiuderà e si riaprirà automaticamente.',
          'Salva prima eventuali attività in corso.',
        ],
        buttons: [
          { label: 'Annulla', value: false },
          {
            label: 'Scarica e installa',
            value: true,
            variant: 'flat',
            color: 'primary',
            icon: 'download',
          },
        ],
      },
      { width: '520px', disableClose: true },
    );

    return result === true;
  }

  private async confirmInstall(): Promise<boolean> {
    const result = await this.dialogService.open<boolean>(
      {
        title: 'Completa aggiornamento',
        titleIcon: 'restart_alt',
        titleIconColor: '#1976d2',
        message: [
          "L'aggiornamento è già stato scaricato.",
          'L’app si chiuderà e si riaprirà automaticamente per completare l’installazione.',
        ],
        buttons: [
          { label: 'Più tardi', value: false },
          {
            label: 'Riavvia e installa',
            value: true,
            variant: 'flat',
            color: 'primary',
            icon: 'restart_alt',
          },
        ],
      },
      { width: '520px', disableClose: true },
    );

    return result === true;
  }

  private setOperationError(error?: string): void {
    this.status.set('error');
    this.errorMessage.set(error ?? 'Si è verificato un errore imprevisto.');
    this.isPreparingDownload.set(false);
  }

  private formatBytes(bytes: number): string {
    if (bytes <= 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1,
    );
    const value = bytes / Math.pow(1024, unitIndex);
    const decimals = unitIndex === 0 || value >= 10 ? 0 : 1;

    return `${value.toFixed(decimals)} ${units[unitIndex]}`;
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds} sec`;
    }

    const minutes = Math.ceil(seconds / 60);
    return `${minutes} min`;
  }

  private parseChangelogBody(body: string): ChangelogBlock[] {
    const blocks: ChangelogBlock[] = [];
    const lines = body.split(/\r?\n/);
    let paragraph: string[] = [];
    let listItems: string[] = [];

    const flushParagraph = (): void => {
      if (paragraph.length === 0) {
        return;
      }

      blocks.push({
        type: 'paragraph',
        text: paragraph.join(' '),
      });
      paragraph = [];
    };

    const flushList = (): void => {
      if (listItems.length === 0) {
        return;
      }

      blocks.push({
        type: 'list',
        items: listItems,
      });
      listItems = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
      const listMatch = line.match(/^[-*]\s+(.+)$/);

      if (!line) {
        flushParagraph();
        flushList();
        continue;
      }

      if (headingMatch) {
        flushParagraph();
        flushList();
        blocks.push({ type: 'heading', text: headingMatch[1] });
        continue;
      }

      if (listMatch) {
        flushParagraph();
        listItems.push(listMatch[1]);
        continue;
      }

      flushList();
      paragraph.push(line);
    }

    flushParagraph();
    flushList();

    return blocks;
  }
}
