export type NotificationLevel = 'debug' | 'info' | 'warn' | 'error';

export interface NotificationOptions {
  icon?: string;
  dedupId?: string;
  /** Retain the notification in history and unread counts. Default: true. */
  saveToHistory?: boolean;
  /** Override the configured history storage when history persistence is enabled. */
  historyStorage?: 'local' | 'session';
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
  /** Persist history in the selected storage. Default: true. */
  persistHistory?: boolean;
  /** Default history storage, overridable per notification. Default: 'local'. */
  historyStorage?: 'local' | 'session';
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
