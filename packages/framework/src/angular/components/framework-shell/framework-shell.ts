import { Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy, signal, input } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { Router, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { UpdateStatusType } from '../../types/update';
import { NotificationPanel } from '../notification-panel/notification-panel';
import { CommandPalette } from '../command-palette/command-palette';
import { Sidebar } from '../sidebar/sidebar';
import { Toolbar } from '../toolbar/toolbar';
import { FullscreenLoaderComponent } from '../fullscreen-loader/fullscreen-loader';
import '../../types/global';
import { NavigationService } from '../../services/navigation.service';
import { CommandPaletteService } from '../../services/command-palette.service';
import { ElectronAppService } from '../../services/electron-api/electron-app.service';
import { ElectronUpdateService } from '../../services/electron-api/electron-update.service';
import { ElectronDbMigrationService } from '../../services/electron-api/electron-db-migration.service';
import { NotificationService } from '../../services/notification.service';
import { ShortcutService } from '../../services/shortcut.service';
import { CommandPaletteItem } from '../../types/command-palette';

const UPDATE_BADGE_STATUSES: UpdateStatusType[] = ['available', 'downloaded'];

@Component({
  selector: 'eaf-shell',
  imports: [
    RouterOutlet,
    MatSidenavModule,
    NotificationPanel,
    CommandPalette,
    Sidebar,
    Toolbar,
    FullscreenLoaderComponent,
  ],
  templateUrl: './framework-shell.html',
  styleUrl: './framework-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FrameworkShell implements OnInit, OnDestroy {
  /** Nome autore mostrato nella sidebar */
  author = input<string>('');

  opened = signal(false);
  version = '';

  /** True while the db-migration:run IPC call is in flight */
  migrating = signal(true);
  /** Set to an error message if a migration fails; null otherwise */
  migrationError = signal<string | null>(null);

  private readonly updateService = inject(ElectronUpdateService);
  private readonly appService = inject(ElectronAppService);
  private readonly dbMigrationService = inject(ElectronDbMigrationService);
  private readonly navigationService = inject(NavigationService);
  private readonly notificationService = inject(NotificationService);
  private readonly shortcutService = inject(ShortcutService);
  private readonly commandPaletteService = inject(CommandPaletteService);
  private readonly router = inject(Router);
  private statusSub?: Subscription;
  private shortcutSubs: Subscription[] = [];

  ngOnInit(): void {
    this.notificationService.enableBackendChannel().catch(error => {
      this.notificationService.error(
        'Notifiche non disponibili',
        'Non è stato possibile attivare la ricezione delle notifiche.',
        { details: error instanceof Error ? error.message : String(error) },
      );
    });
    // Run pending DB migrations before letting the user interact with the app.
    // The fullscreen overlay is shown until the IPC call resolves.
    this.dbMigrationService.run().then(result => {
      if (result.success) {
        this.migrating.set(false);
      } else {
        this.migrationError.set(result.error ?? 'Errore sconosciuto durante la migrazione del database.');
        this.migrating.set(false);
      }
    }).catch(err => {
      this.migrationError.set(err instanceof Error ? err.message : String(err));
      this.migrating.set(false);
    });

    this.statusSub = this.updateService.statusChanged$.subscribe(status => {
      this.navigationService.updateAvailable.set(
        UPDATE_BADGE_STATUSES.includes(status.status)
      );
      if (status.status === 'available' && status.availableVersion) {
        this.notificationService.info(
          'Aggiornamento disponibile',
          `È disponibile la versione ${status.availableVersion}. Vai alla sezione Aggiornamenti per scaricarla.`,
          {
            icon: 'system_update',
            dedupId: 'update-available',
            route: '/updates',
            actionLabel: 'Vai agli aggiornamenti',
          },
        );
      }
    });

    // Registra shortcut stock di navigazione
    this.shortcutSubs.push(
      this.shortcutService.on('nav.notifications').subscribe(() => this.router.navigate(['/notifications'])),
      this.shortcutService.on('nav.backup').subscribe(() => this.router.navigate(['/backup'])),
      this.shortcutService.on('nav.updates').subscribe(() => this.router.navigate(['/updates'])),
      this.shortcutService.on('nav.shortcuts').subscribe(() => this.router.navigate(['/shortcuts'])),
      this.shortcutService.on('app.save').subscribe(() => {
        const saveFn = this.navigationService.onSaveAction();
        if (saveFn) saveFn();
      }),
      this.shortcutService.on('nav.menu').subscribe(() => {
        this.opened.update(v => !v);
      }),
      this.shortcutService.on('app.commandPalette').subscribe(() => {
        this.commandPaletteService.toggle();
      }),
    );

    this.registerStockCommands();

    this.appService.getInfo().then(info => {
      if (info) {
        this.version = info.version;
        this.navigationService.appName.set(info.productName);
      }
    });
  }

  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
    this.shortcutSubs.forEach(s => s.unsubscribe());
  }

  private registerStockCommands(): void {
    const stockCommands: CommandPaletteItem[] = [
      {
        id: 'nav.notifications',
        label: 'Vai alle Notifiche',
        category: 'Navigazione',
        icon: 'notifications',
        shortcutId: 'nav.notifications',
        action: () => this.router.navigate(['/notifications']),
      },
      {
        id: 'nav.backup',
        label: 'Vai alla gestione Backup',
        category: 'Navigazione',
        icon: 'backup',
        shortcutId: 'nav.backup',
        action: () => this.router.navigate(['/backup']),
      },
      {
        id: 'nav.updates',
        label: 'Vai agli Aggiornamenti',
        category: 'Navigazione',
        icon: 'system_update',
        shortcutId: 'nav.updates',
        action: () => this.router.navigate(['/updates']),
      },
      {
        id: 'nav.shortcuts',
        label: 'Vai alle Scorciatoie',
        category: 'Navigazione',
        icon: 'keyboard',
        shortcutId: 'nav.shortcuts',
        action: () => this.router.navigate(['/shortcuts']),
      },
      {
        id: 'nav.appInfo',
        label: 'Vai a Info Applicazione',
        category: 'Navigazione',
        icon: 'info',
        action: () => this.router.navigate(['/app-info']),
      },
      {
        id: 'nav.menu',
        label: 'Apri/Chiudi Menu laterale',
        category: 'Navigazione',
        icon: 'menu',
        shortcutId: 'nav.menu',
        action: () => this.opened.update(v => !v),
      },
      {
        id: 'app.save',
        label: 'Salva',
        description: 'Esegui l\'azione di salvataggio corrente',
        category: 'Azioni',
        icon: 'save',
        shortcutId: 'app.save',
        action: () => {
          const saveFn = this.navigationService.onSaveAction();
          if (saveFn) saveFn();
        },
      },
      {
        id: 'action.checkUpdates',
        label: 'Controlla Aggiornamenti',
        description: 'Vai agli aggiornamenti e controlla se ci sono nuove versioni',
        category: 'Azioni',
        icon: 'system_update',
        route: '/updates',
        action: () => this.updateService.checkForUpdates(),
      },
      {
        id: 'action.reload',
        label: 'Ricarica Applicazione',
        description: 'Ricarica la finestra dell\'applicazione',
        category: 'Azioni',
        icon: 'refresh',
        action: () => this.appService.reload(),
      },
    ];

    this.commandPaletteService.registerMany(stockCommands);
  }
}
