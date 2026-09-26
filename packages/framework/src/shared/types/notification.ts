export type NotificationLevel = 'debug' | 'info' | 'warn' | 'error';

export interface NotificationOptions {
  icon?: string;
  dedupId?: string;
  /** Internal Angular route opened when the notification is activated. */
  route?: string;
  actionLabel?: string;
  details?: string;
}

export interface NotificationInput extends NotificationOptions {
  title: string;
  message: string;
  level: NotificationLevel;
}

export interface NotificationConfig {
  /** Keep history between application launches. Default: true. */
  persistHistory?: boolean;
  /** Maximum retained notifications. Default: 500. */
  maxHistory?: number;
  /** Maximum simultaneously visible toasts. Default: 3. */
  maxVisibleToasts?: number;
  /** Show debug toasts as well as retaining them in history. Default: false. */
  showDebugToasts?: boolean;
}

export interface AppNotification extends NotificationInput {
  id: string;
  timestamp: number;
  read: boolean;
  occurrences?: number;
}
