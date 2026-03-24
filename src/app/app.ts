import { Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { NavigationService } from './services/navigation.service';
import { ElectronUpdateService } from './services/electron-api/electron-update.service';
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
  opened = false;
  version = '';
  author = 'bibi';

  private updateService = inject(ElectronUpdateService);
  private navigationService = inject(NavigationService);
  private statusSub?: Subscription;

  ngOnInit(): void {
    this.statusSub = this.updateService.statusChanged$.subscribe(status => {
      this.navigationService.updateAvailable.set(
        UPDATE_BADGE_STATUSES.includes(status.status)
      );
    });

    window.electronAPI.invoke<{ success: boolean; data?: { name: string; version: string } }>('app:info').then(response => {
      if (response.success && response.data) {
        this.version = response.data.version;
      }
    });
  }

  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
  }
}
