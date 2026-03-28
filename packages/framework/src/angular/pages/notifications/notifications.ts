import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { AppNotification, NotificationLevel } from '../../types/notification';
import { NotificationService } from '../../services/notification.service';
import { NavigationService } from '../../services/navigation.service';

const LEVEL_ICONS: Record<NotificationLevel, string> = {
  debug: 'bug_report',
  info: 'info',
  warn: 'warning',
  error: 'error',
};

const LEVEL_LABELS: Record<NotificationLevel, string> = {
  debug: 'Debug',
  info: 'Info',
  warn: 'Avviso',
  error: 'Errore',
};

@Component({
  selector: 'app-notifications',
  imports: [
    DatePipe,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatBadgeModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Notifications implements OnInit {
  private notificationService = inject(NotificationService);
  private navigationService = inject(NavigationService);

  readonly notifications = this.notificationService.notifications;
  readonly unreadCount = this.notificationService.unreadCount;

  expandedId = signal<string | null>(null);

  readonly hasNotifications = computed(() => this.notifications().length > 0);

  ngOnInit(): void {
    this.navigationService.setTitle('Notifiche', 'notifications');
    this.navigationService.clearToolbarActions();
  }

  levelIcon(level: NotificationLevel): string {
    return LEVEL_ICONS[level];
  }

  levelLabel(level: NotificationLevel): string {
    return LEVEL_LABELS[level];
  }

  toggleExpand(notification: AppNotification): void {
    if (!notification.read) {
      this.notificationService.markAsRead(notification.id);
    }
    this.expandedId.update(current =>
      current === notification.id ? null : notification.id
    );
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  toggleReadStatus(event: Event, notification: AppNotification): void {
    event.stopPropagation();
    if (notification.read) {
      this.notificationService.markAsUnread(notification.id);
    } else {
      this.notificationService.markAsRead(notification.id);
    }
  }

  removeNotification(event: Event, id: string): void {
    event.stopPropagation();
    if (this.expandedId() === id) {
      this.expandedId.set(null);
    }
    this.notificationService.remove(id);
  }

  clearRead(): void {
    this.expandedId.set(null);
    this.notificationService.clearRead();
  }

  clearAll(): void {
    this.expandedId.set(null);
    this.notificationService.clearAll();
  }

  isExpanded(id: string): boolean {
    return this.expandedId() === id;
  }

  formatTimestamp(timestamp: number): Date {
    return new Date(timestamp);
  }
}
