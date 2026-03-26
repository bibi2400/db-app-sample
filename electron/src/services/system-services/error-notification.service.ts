import { Injectable } from '../../helpers/mini-pie/decorators';
import { Logger } from '../../helpers/logger';
import { NotificationService } from './notification.service';

/**
 * Monitors errors across the application and sends them
 * as notifications through the notification push channel.
 */
@Injectable()
export class ErrorNotificationService {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Report a controller IPC handler error.
   */
  reportControllerError(channel: string, error: unknown): void {
    const message = this.extractMessage(error);
    Logger.error(`[ErrorNotification] Controller error on "${channel}":`, error);
    this.notificationService.error(
      `Errore: ${channel}`,
      message,
      'error',
      `controller-error:${channel}`,
    );
  }

  /**
   * Report a bootstrap / startup error.
   */
  reportBootstrapError(phase: string, error: unknown): void {
    const message = this.extractMessage(error);
    Logger.error(`[ErrorNotification] Bootstrap error in "${phase}":`, error);
    this.notificationService.error(
      `Errore avvio: ${phase}`,
      message,
      'warning',
      `bootstrap-error:${phase}`,
    );
  }

  /**
   * Generic error report.
   */
  reportError(title: string, error: unknown): void {
    const message = this.extractMessage(error);
    Logger.error(`[ErrorNotification] ${title}:`, error);
    this.notificationService.error(title, message);
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.stack ?? error.message;
    }
    return String(error);
  }
}
