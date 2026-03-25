import { Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { Router, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { NavigationService } from './services/navigation.service';
import { ElectronUpdateService } from './services/electron-api/electron-update.service';
import { ShortcutService } from './services/shortcut.service';
import { CommandPaletteService } from './services/command-palette.service';
import { NotificationService } from './services/notification.service';
import { UpdateStatusType } from './types/update';
import { NotificationPanel } from './components/notification-panel/notification-panel';
import { CommandPalette } from './components/command-palette/command-palette';
import { Sidebar } from './components/sidebar/sidebar';
import { Toolbar } from './components/toolbar/toolbar';
import "./types/global";

const UPDATE_BADGE_STATUSES: UpdateStatusType[] = ['available', 'downloaded'];

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    MatSidenavModule,
    NotificationPanel,
    CommandPalette,
    Sidebar,
    Toolbar,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit, OnDestroy {
  opened = signal(false);
  version = '';
  author = 'bibi';

  private updateService = inject(ElectronUpdateService);
  private navigationService = inject(NavigationService);
  private notificationService = inject(NotificationService);
  private shortcutService = inject(ShortcutService);
  private commandPaletteService = inject(CommandPaletteService);
  private router = inject(Router);
  private statusSub?: Subscription;
  private shortcutSubs: Subscription[] = [];

  ngOnInit(): void {
    this.statusSub = this.updateService.statusChanged$.subscribe(status => {
      this.navigationService.updateAvailable.set(
        UPDATE_BADGE_STATUSES.includes(status.status)
      );
      if (status.status === 'available' && status.availableVersion) {
        this.notificationService.info(
          'Aggiornamento disponibile',
          `È disponibile la versione ${status.availableVersion}. Vai alla sezione Aggiornamenti per scaricarla.`,
          'system_update',
        );
      }
    });

    // Registra shortcut di navigazione
    this.shortcutSubs.push(
      this.shortcutService.on('nav.dashboard').subscribe(() => this.router.navigate(['/dashboard'])),
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

    this.registerCommands();

    window.electronAPI.invoke<{ success: boolean; data?: { name: string; version: string } }>('app:info').then(response => {
      if (response.success && response.data) {
        this.version = response.data.version;
      }
    });
  }

  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
    this.shortcutSubs.forEach(s => s.unsubscribe());
  }

  private registerCommands(): void {
    this.commandPaletteService.registerMany([
      {
        id: 'nav.dashboard',
        label: 'Vai alla Dashboard',
        category: 'Navigazione',
        icon: 'dashboard',
        shortcutId: 'nav.dashboard',
        action: () => this.router.navigate(['/dashboard']),
      },
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
        id: 'test.notifications',
        label: 'Test Notifiche',
        description: 'Invia notifiche di test dal backend',
        category: 'Test',
        icon: 'bug_report',
        action: () => window.electronAPI.invoke('test:test-notifications'),
      },
    ]);
  }
}
