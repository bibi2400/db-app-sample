import { TitleCasePipe } from '@angular/common';
import { Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbar } from '@angular/material/toolbar';
import { MatBadgeModule } from '@angular/material/badge';
import { RouterLink, RouterOutlet, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subscription } from 'rxjs';
import { MenuItem, NavigationService } from './services/navigation.service';
import { ElectronUpdateService } from './services/electron-api/electron-update.service';
import { UpdateStatusType } from './types/update';
import { NotificationPanel } from './components/notification-panel/notification-panel';
import { NotificationService } from './services/notification.service';
import "./types/global";

const UPDATE_BADGE_STATUSES: UpdateStatusType[] = ['available', 'downloaded'];

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    MatSidenavModule,
    MatButtonModule,
    MatIcon,
    MatListModule,
    MatToolbar,
    MatTooltipModule,
    MatBadgeModule,
    NotificationPanel,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit, OnDestroy {
  opened = false;
  version = '1.0.0';
  author = 'bibi';

  private updateService = inject(ElectronUpdateService);
  readonly notificationService = inject(NotificationService);
  private statusSub?: Subscription;

  constructor(
    public navigationService: NavigationService,
    private location: Location,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.statusSub = this.updateService.statusChanged$.subscribe(status => {
      this.navigationService.updateAvailable.set(
        UPDATE_BADGE_STATUSES.includes(status.status)
      );
    });
  }

  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
  }

  goBack() {
    this.location.back();
  }

  goForward() {
    this.location.forward();
  }

  clickMenuItem($event: Event, menuItem: MenuItem) {
    $event.preventDefault();
    if (menuItem.route) {
      this.opened = false;
      this.router.navigate([menuItem.route]);
    }
  }

  goToNotifications(): void {
    this.router.navigate(['/notifications']);
  }

  get menu() {
    return this.navigationService.menu;
  }

  toggleSubmenu(item: MenuItem) {
    this.navigationService.toggleSubmenu(item);
  }

  isExpanded(item: MenuItem): boolean {
    return this.navigationService.isExpanded(item);
  }

  get activeLink() {
    return this.navigationService.activeLink;
  }
}
