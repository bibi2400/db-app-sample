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

  constructor(private pushService: PushService) {
    this.pushService.initializeChannel(this);
  }

  /**
   * Send a notification to the renderer process.
   * Can be called from any backend service or controller.
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
    this.show.emit(notification);
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
