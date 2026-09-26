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
      'Operazione non completata',
      'Non è stato possibile completare la richiesta. Riprova o consulta i dettagli tecnici.',
      {
        icon: 'error',
        dedupId: `controller-error:${channel}`,
        details: `Operazione: ${channel}\n${message}`,
      },
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
      'Si è verificato un problema durante l’avvio. Consulta i dettagli tecnici.',
      {
        icon: 'warning',
        dedupId: `bootstrap-error:${phase}`,
        details: message,
      },
    );
  }

  /**
   * Generic error report.
   */
  reportError(title: string, error: unknown): void {
    const message = this.extractMessage(error);
    Logger.error(`[ErrorNotification] ${title}:`, error);
    this.notificationService.error(
      title,
      'Si è verificato un errore. Consulta i dettagli tecnici per maggiori informazioni.',
      { details: message },
    );
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.stack ?? error.message;
    }
    return String(error);
  }
}
