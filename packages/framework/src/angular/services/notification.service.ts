import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ElectronPushService } from './electron-api/electron-push.service';
import { AppNotification, NotificationInput, NotificationLevel, NotificationOptions } from '../types/notification';
import { IpcResponse } from '../types/global';
import { EAF_NOTIFICATION_CONFIG } from '../config';
import {
  addNotificationToHistory,
  isNotificationRoute,
  notificationInput,
  notificationLimit,
  NOTIFICATION_PRESENTATION,
  parseNotification,
} from '../../shared/notifications';

const STORAGE_KEY = 'app-notifications';

type PauseReason = 'pointer' | 'focus';

interface ToastTimer {
  remaining: number;
  startedAt: number;
  handle?: ReturnType<typeof setTimeout>;
  paused: Set<PauseReason>;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly pushService = inject(ElectronPushService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly config = inject(EAF_NOTIFICATION_CONFIG, { optional: true }) ?? {};
  private readonly maxHistory = notificationLimit(this.config.maxHistory, 500);
  private readonly maxVisibleToasts = notificationLimit(this.config.maxVisibleToasts, 3);
  private readonly history = signal<AppNotification[]>(this.loadFromStorage());
  private readonly visibleToasts = signal<AppNotification[]>([]);
  private readonly pendingToasts: AppNotification[] = [];
  private readonly timers = new Map<string, ToastTimer>();
  private listeners: Array<(notification: AppNotification) => void> = [];
  private counter = 0;
  private enabling?: Promise<void>;

  readonly notifications = this.history.asReadonly();
  readonly toasts = this.visibleToasts.asReadonly();
  readonly unreadCount = computed(() => this.history().filter(n => !n.read).length);
  readonly readCount = computed(() => this.history().length - this.unreadCount());
  readonly backendNotification$ = this.pushService.on<AppNotification>('push:notification:show');

  constructor() {
    this.backendNotification$.pipe(takeUntilDestroyed()).subscribe(n => this.receive(n));
    this.destroyRef.onDestroy(() => {
      this.timers.forEach(timer => clearTimeout(timer.handle));
      this.timers.clear();
      this.pendingToasts.length = 0;
      this.listeners = [];
    });
  }

  /** Called by the application shell, independently of the toast component. */
  enableBackendChannel(): Promise<void> {
    this.enabling ??= window.electronAPI.invoke<IpcResponse<null>>('notification:enable')
      .then(result => {
        if (!result.success) throw new Error(result.error ?? 'Canale notifiche non disponibile');
      }).catch(error => {
        this.enabling = undefined;
        throw error;
      });
    return this.enabling;
  }

  onNotification(callback: (notification: AppNotification) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  notify(input: NotificationInput): void;
  notify(
    level: NotificationLevel,
    title: string,
    message: string,
    options?: string | NotificationOptions,
    dedupId?: string,
  ): void;
  notify(
    input: NotificationInput | NotificationLevel,
    title = '',
    message = '',
    options?: string | NotificationOptions,
    dedupId?: string,
  ): void {
    const payload = typeof input === 'string'
      ? notificationInput(input, title, message, options, dedupId) : input;
    this.receive({
      ...payload,
      id: `fe-${Date.now()}-${++this.counter}`,
      timestamp: Date.now(),
      read: false,
    });
  }

  /** Retained for consumers that explicitly insert history without a toast. */
  addToHistory(notification: AppNotification): void {
    const parsed = parseNotification(notification);
    if (!parsed) return;
    this.updateHistory(list => addNotificationToHistory(list, parsed, this.maxHistory));
  }

  markAsRead(id: string): void {
    this.setRead(id, true);
  }

  markAsUnread(id: string): void {
    this.setRead(id, false);
  }

  markAllAsRead(): void {
    this.updateHistory(list => list.map(n => n.read ? n : { ...n, read: true }));
  }

  remove(id: string): void {
    this.updateHistory(list => list.filter(n => n.id !== id));
    this.dismissToast(id);
  }

  clearRead(): void {
    this.clearMatching(n => n.read);
  }

  clearAll(): void {
    this.updateHistory(() => []);
    this.timers.forEach(timer => clearTimeout(timer.handle));
    this.timers.clear();
    this.pendingToasts.length = 0;
    this.visibleToasts.set([]);
  }

  async open(notification: AppNotification): Promise<boolean> {
    const destination = isNotificationRoute(notification.route) ? notification.route : undefined;
    if (!destination && !this.history().some(n => n.id === notification.id)) {
      this.updateHistory(list => addNotificationToHistory(
        list.slice(0, this.maxHistory - 1),
        notification,
        this.maxHistory,
      ));
    }
    const route = destination ?? `/notifications?notification=${encodeURIComponent(notification.id)}`;
    const navigated = await this.router.navigateByUrl(route);
    if (navigated) {
      this.markAsRead(notification.id);
      this.dismissToast(notification.id);
    }
    return navigated;
  }

  dismissToast(id: string): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer.handle);
    this.timers.delete(id);
    const pendingIndex = this.pendingToasts.findIndex(n => n.id === id);
    if (pendingIndex >= 0) this.pendingToasts.splice(pendingIndex, 1);
    this.visibleToasts.update(list => list.filter(n => n.id !== id));
    this.fillToasts();
  }

  setToastPaused(id: string, reason: PauseReason, paused: boolean): void {
    const timer = this.timers.get(id);
    if (!timer) return;
    if (paused) {
      if (timer.paused.size === 0) {
        clearTimeout(timer.handle);
        timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
      }
      timer.paused.add(reason);
    } else {
      const wasPaused = timer.paused.delete(reason);
      if (wasPaused && timer.paused.size === 0) this.startTimer(id, timer);
    }
  }

  debug(
    title: string,
    message: string,
    options?: string | NotificationOptions,
    dedupId?: string,
  ): void {
    this.notify('debug', title, message, options, dedupId);
  }

  info(
    title: string,
    message: string,
    options?: string | NotificationOptions,
    dedupId?: string,
  ): void {
    this.notify('info', title, message, options, dedupId);
  }

  warn(
    title: string,
    message: string,
    options?: string | NotificationOptions,
    dedupId?: string,
  ): void {
    this.notify('warn', title, message, options, dedupId);
  }

  error(
    title: string,
    message: string,
    options?: string | NotificationOptions,
    dedupId?: string,
  ): void {
    this.notify('error', title, message, options, dedupId);
  }

  private receive(value: unknown): void {
    const notification = parseNotification(value);
    if (!notification || this.history().some(n => n.id === notification.id)) return;
    this.addToHistory(notification);
    const retained = this.history().find(n => n.id === notification.id) ?? notification;
    if (notification.level !== 'debug' || this.config.showDebugToasts) {
      if (notification.dedupId) {
        const previous = [...this.visibleToasts(), ...this.pendingToasts]
          .find(n => n.dedupId === notification.dedupId);
        if (previous) this.dismissToast(previous.id);
      }
      this.pendingToasts.push(retained);
      // Retain at most one history-sized batch during a notification burst.
      if (this.pendingToasts.length > this.maxHistory) this.pendingToasts.shift();
      this.fillToasts();
    }
    this.listeners.forEach(listener => listener(retained));
  }

  private fillToasts(): void {
    while (this.visibleToasts().length < this.maxVisibleToasts && this.pendingToasts.length) {
      const notification = this.pendingToasts.shift()!;
      this.visibleToasts.update(list => [...list, notification]);
      const timer: ToastTimer = {
        remaining: NOTIFICATION_PRESENTATION[notification.level].duration,
        startedAt: Date.now(),
        paused: new Set(),
      };
      this.timers.set(notification.id, timer);
      this.startTimer(notification.id, timer);
    }
  }

  private startTimer(id: string, timer: ToastTimer): void {
    clearTimeout(timer.handle);
    timer.startedAt = Date.now();
    timer.handle = setTimeout(() => this.dismissToast(id), timer.remaining);
  }

  private setRead(id: string, read: boolean): void {
    this.updateHistory(list => list.map(n => n.id === id ? { ...n, read } : n));
  }

  private clearMatching(predicate: (notification: AppNotification) => boolean): void {
    const ids = new Set(this.history().filter(predicate).map(n => n.id));
    this.updateHistory(list => list.filter(n => !ids.has(n.id)));
    // Remove the whole batch before filling slots, avoiding transient queued toasts.
    this.visibleToasts.update(list => list.filter(n => !ids.has(n.id)));
    for (let i = this.pendingToasts.length - 1; i >= 0; i--) {
      if (ids.has(this.pendingToasts[i].id)) this.pendingToasts.splice(i, 1);
    }
    ids.forEach(id => {
      clearTimeout(this.timers.get(id)?.handle);
      this.timers.delete(id);
    });
    this.fillToasts();
  }

  private updateHistory(update: (list: AppNotification[]) => AppNotification[]): void {
    this.history.update(update);
    if (this.config.persistHistory === false) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history()));
    } catch {
      // History remains available in memory when storage is unavailable or full.
    }
  }

  private loadFromStorage(): AppNotification[] {
    try {
      if (this.config.persistHistory === false) {
        // Discard previously persisted history when the consumer disables persistence.
        localStorage.removeItem(STORAGE_KEY);
        return [];
      }
      const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (!Array.isArray(raw)) return [];
      return raw.reduce<AppNotification[]>((history, value) => {
        const notification = parseNotification(value);
        return notification ? addNotificationToHistory(history, notification, this.maxHistory) : history;
      }, []);
    } catch {
      return [];
    }
  }
}
