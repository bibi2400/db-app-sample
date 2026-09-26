import { Injectable } from '../../helpers/mini-pie/decorators';
import { PushChannel, PushEvent } from '../../decorators/push-channel.decorator';
import { PushEmitter } from '../../helpers/push/push-emitter';
import { PushService } from './push.service';
import { Logger } from '../../helpers/logger';
import { notificationInput } from '../../../shared/notifications';
import {
  AppNotification,
  NotificationInput,
  NotificationLevel,
  NotificationOptions,
} from '../../../shared/types/notification';

export type { AppNotification, NotificationLevel } from '../../../shared/types/notification';

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
    const notification: AppNotification = {
      ...payload,
      id: `be-${Date.now()}-${++this.counter}`,
      timestamp: Date.now(),
      read: false,
    };

    if (this.enabled) {
      this.show.emit(notification);
    } else {
      this.queue.push(notification);
      Logger.debug(`[Notification] Queued (channel not ready): ${notification.level}: ${notification.title}`);
    }
    Logger.info(`[Notification] ${notification.level}: ${notification.title}`);
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
}
