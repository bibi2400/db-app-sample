import { computed, inject, Injectable, signal } from '@angular/core';
import { ElectronPushService } from './electron-api/electron-push.service';
import { AppNotification, NotificationLevel } from '../types/notification';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private pushService = inject(ElectronPushService);
  private counter = 0;

  /** Push notifications from the backend */
  readonly backendNotification$ = this.pushService.on<AppNotification>('push:notification:show');

  /** Full notification history */
  readonly notifications = signal<AppNotification[]>([]);

  /** Number of unread notifications */
  readonly unreadCount = computed(() => this.notifications().filter(n => !n.read).length);

  private listeners: Array<(notification: AppNotification) => void> = [];

  /** Register a listener for new notifications (used by the toast panel) */
  onNotification(callback: (notification: AppNotification) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /** Add a notification to history and broadcast to listeners */
  notify(level: NotificationLevel, title: string, message: string, icon?: string): void {
    const notification: AppNotification = {
      id: `fe-${Date.now()}-${++this.counter}`,
      title,
      message,
      level,
      icon,
      timestamp: Date.now(),
      read: false,
    };
    this.addToHistory(notification);
    this.listeners.forEach(l => l(notification));
  }

  /** Add a notification to history (called for both frontend and backend notifications) */
  addToHistory(notification: AppNotification): void {
    const n = notification.read !== undefined ? notification : { ...notification, read: false };
    this.notifications.update(list => [n, ...list]);
  }

  markAsRead(id: string): void {
    this.notifications.update(list =>
      list.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }

  markAllAsRead(): void {
    this.notifications.update(list =>
      list.map(n => n.read ? n : { ...n, read: true })
    );
  }

  debug(title: string, message: string, icon?: string): void {
    this.notify('debug', title, message, icon);
  }

  info(title: string, message: string, icon?: string): void {
    this.notify('info', title, message, icon);
  }

  warn(title: string, message: string, icon?: string): void {
    this.notify('warn', title, message, icon);
  }

  error(title: string, message: string, icon?: string): void {
    this.notify('error', title, message, icon);
  }
}
