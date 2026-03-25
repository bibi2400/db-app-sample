import { Injectable } from '../helpers/mini-pie/decorators';
import { PushChannel, PushEvent } from '../decorators/push-channel.decorator';
import { PushEmitter } from '../helpers/push/push-emitter';
import { PushService } from './push.service';
import { Logger } from '../helpers/logger';

export type NotificationLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  level: NotificationLevel;
  icon?: string;
  timestamp: number;
}

@PushChannel('notification')
@Injectable()
export class NotificationService {
  @PushEvent('show')
  readonly show = new PushEmitter<AppNotification>();

  private counter = 0;
  private enabled = false;
  private queue: AppNotification[] = [];

  constructor(private pushService: PushService) {
    this.pushService.initializeChannel(this);
  }

  /**
   * Enable the notification channel and flush any queued notifications.
   * Called when the frontend signals it is ready to receive.
   */
  enable(): void {
    this.enabled = true;
    Logger.info(`[Notification] Channel enabled, flushing ${this.queue.length} queued notification(s)`);
    for (const notification of this.queue) {
      this.show.emit(notification);
    }
    this.queue = [];
  }

  /**
   * Send a notification to the renderer process.
   * If the channel is not yet enabled, notifications are queued.
   */
  notify(level: NotificationLevel, title: string, message: string, icon?: string): void {
    const notification: AppNotification = {
      id: `be-${Date.now()}-${++this.counter}`,
      title,
      message,
      level,
      icon,
      timestamp: Date.now(),
    };

    if (this.enabled) {
      this.show.emit(notification);
    } else {
      this.queue.push(notification);
      Logger.debug(`[Notification] Queued (channel not ready): ${level}: ${title}`);
    }
    Logger.info(`[Notification] ${level}: ${title}`);
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
