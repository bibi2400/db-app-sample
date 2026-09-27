import { Component, ChangeDetectionStrategy, computed, output, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatToolbar } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NavigationService } from '../../services/navigation.service';
import { NotificationService } from '../../services/notification.service';
import { ElectronZoomService } from '../../services/electron-api/electron-zoom.service';
import { GracefulShutdownService } from '../../services/graceful-shutdown.service';
import { UpdateStateService } from '../../services/update-state.service';

@Component({
  selector: 'eaf-toolbar',
  imports: [
    MatButtonModule,
    MatIcon,
    MatToolbar,
    MatTooltipModule,
    MatBadgeModule,
    RouterLink,
  ],
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Toolbar {
  menuToggled = output<void>();
  toolbarLogoError = false;

  readonly navigationService = inject(NavigationService);
  readonly notificationService = inject(NotificationService);
  readonly zoomService = inject(ElectronZoomService);
  readonly shutdownService = inject(GracefulShutdownService);
  private location = inject(Location);
  private router = inject(Router);
  private readonly updateState = inject(UpdateStateService);

  readonly updateNotice = computed(() => {
    if (!this.navigationService.showUpdateNotice()) return null;
    switch (this.updateState.status()?.status) {
      case 'available':
        return 'Aggiornamento disponibile';
      case 'downloaded':
        return 'Aggiornamento pronto da installare';
      default:
        return null;
    }
  });

  get activeLink() {
    return this.navigationService.activeLink;
  }

  goBack() {
    this.location.back();
  }

  goForward() {
    this.location.forward();
  }

  goToNotifications(): void {
    this.router.navigate(['/notifications']);
  }
}
