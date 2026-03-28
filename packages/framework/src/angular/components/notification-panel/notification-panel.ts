import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { AppNotification, NotificationLevel } from '../../types/notification';
import { NotificationService } from '../../services/notification.service';

const LEVEL_ICONS: Record<NotificationLevel, string> = {
  debug: 'bug_report',
  info: 'info',
  warn: 'warning',
  error: 'error',
};

const AUTO_DISMISS_MS: Record<NotificationLevel, number> = {
  debug: 4000,
  info: 5000,
  warn: 7000,
  error: 10000,
};

@Component({
  selector: 'app-notification-panel',
  imports: [MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-panel.html',
  styleUrl: './notification-panel.scss',
})
export class NotificationPanel implements OnInit, OnDestroy {
  private notificationService = inject(NotificationService);
  private subscriptions: Subscription[] = [];
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private unsubFrontend?: () => void;

  notifications = signal<AppNotification[]>([]);

  ngOnInit(): void {
    // Backend notifications via push channel
    this.subscriptions.push(
      this.notificationService.backendNotification$.subscribe(n => {
        this.notificationService.addToHistory(n);
        this.addNotification(n);
      }),
    );

    // Frontend notifications via service callback (already added to history by the service)
    this.unsubFrontend = this.notificationService.onNotification(n => this.addNotification(n));

    // Signal backend that the notification channel is ready, flush queued notifications
    this.notificationService.enableBackendChannel();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.unsubFrontend?.();
    this.timers.forEach(t => clearTimeout(t));
  }

  levelIcon(level: NotificationLevel): string {
    return LEVEL_ICONS[level];
  }

  dismiss(id: string): void {
    this.notificationService.markAsRead(id);
    this.removeToast(id);
  }

  private removeToast(id: string): void {
    this.notifications.update(list => list.filter(n => n.id !== id));
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  private addNotification(notification: AppNotification): void {
    // Remove existing toast with the same dedupId
    if (notification.dedupId) {
      const existing = this.notifications().find(n => n.dedupId === notification.dedupId);
      if (existing) {
        this.removeToast(existing.id);
      }
    }

    this.notifications.update(list => [...list, notification]);

    const duration = AUTO_DISMISS_MS[notification.level];
    const timer = setTimeout(() => {
      this.removeToast(notification.id);
    }, duration);
    this.timers.set(notification.id, timer);
  }
}
