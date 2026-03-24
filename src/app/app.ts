import { Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { Router, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { NavigationService } from './services/navigation.service';
import { ElectronUpdateService } from './services/electron-api/electron-update.service';
import { ShortcutService } from './services/shortcut.service';
import { UpdateStatusType } from './types/update';
import { NotificationPanel } from './components/notification-panel/notification-panel';
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
  private shortcutService = inject(ShortcutService);
  private router = inject(Router);
  private statusSub?: Subscription;
  private shortcutSubs: Subscription[] = [];

  ngOnInit(): void {
    this.statusSub = this.updateService.statusChanged$.subscribe(status => {
      this.navigationService.updateAvailable.set(
        UPDATE_BADGE_STATUSES.includes(status.status)
      );
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
    );

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
}
