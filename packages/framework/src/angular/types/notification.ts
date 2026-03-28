export type NotificationLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  level: NotificationLevel;
  icon?: string;
  timestamp: number;
  read: boolean;
  dedupId?: string;
}
