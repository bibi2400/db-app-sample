import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AppNotification } from '../../types/notification';
import { NotificationService } from '../../services/notification.service';
import { NOTIFICATION_PRESENTATION } from '../../../shared/notifications';

@Component({
  selector: 'eaf-notification-panel',
  imports: [MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-panel.html',
  styleUrl: './notification-panel.scss',
})
export class NotificationPanel {
  readonly notificationService = inject(NotificationService);
  readonly notifications = this.notificationService.toasts;
  readonly presentation = NOTIFICATION_PRESENTATION;

  open(notification: AppNotification): void {
    void this.notificationService.open(notification).catch(error => console.error(error));
  }

  focusOut(event: FocusEvent, id: string): void {
    const target = event.currentTarget as HTMLElement;
    if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
    this.notificationService.setToastPaused(id, 'focus', false);
  }
}
