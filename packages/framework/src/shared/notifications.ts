import {
  AppNotification,
  NotificationInput,
  NotificationLevel,
  NotificationOptions,
} from './types/notification';

export const NOTIFICATION_LEVELS: NotificationLevel[] = ['info', 'warn', 'error', 'debug'];

export const NOTIFICATION_PRESENTATION: Record<NotificationLevel, {
  icon: string;
  label: string;
  duration: number;
}> = {
  debug: { icon: 'bug_report', label: 'Debug', duration: 4000 },
  info: { icon: 'info', label: 'Informazione', duration: 5000 },
  warn: { icon: 'warning', label: 'Avviso', duration: 7000 },
  error: { icon: 'error', label: 'Errore', duration: 10000 },
};

export function notificationInput(
  level: NotificationLevel,
  title: string,
  message: string,
  options?: string | NotificationOptions,
  dedupId?: string,
): NotificationInput {
  return {
    ...(typeof options === 'string' ? { icon: options, dedupId } : { dedupId, ...options }),
    level,
    title,
    message,
  };
}

/** Only internal, absolute Angular routes can be notification destinations. */
export function isNotificationRoute(route: unknown): route is string {
  return typeof route === 'string' && route.startsWith('/') &&
    !route.startsWith('//') && !route.includes('\\');
}

/** Validate persisted/IPC data and migrate history written by older versions. */
export function parseNotification(value: unknown): AppNotification | null {
  if (!value || typeof value !== 'object') return null;
  const n = value as Record<string, unknown>;
  if (typeof n['id'] !== 'string' || !n['id'] ||
      typeof n['title'] !== 'string' || typeof n['message'] !== 'string' ||
      !NOTIFICATION_LEVELS.includes(n['level'] as NotificationLevel) ||
      typeof n['timestamp'] !== 'number' || !Number.isFinite(n['timestamp']) ||
      !Number.isFinite(new Date(n['timestamp']).getTime())) {
    return null;
  }

  return {
    id: n['id'],
    title: n['title'],
    message: n['message'],
    level: n['level'] as NotificationLevel,
    timestamp: n['timestamp'],
    read: n['read'] === true,
    icon: typeof n['icon'] === 'string' ? n['icon'] : undefined,
    dedupId: typeof n['dedupId'] === 'string' ? n['dedupId'] : undefined,
    route: isNotificationRoute(n['route']) ? n['route'] : undefined,
    actionLabel: typeof n['actionLabel'] === 'string' ? n['actionLabel'] : undefined,
    details: typeof n['details'] === 'string' ? n['details'] : undefined,
    occurrences: typeof n['occurrences'] === 'number' &&
      Number.isSafeInteger(n['occurrences']) && n['occurrences'] > 0
      ? n['occurrences'] : 1,
  };
}

export function addNotificationToHistory(
  history: AppNotification[],
  notification: AppNotification,
  limit: number,
): AppNotification[] {
  if (history.some(n => n.id === notification.id)) return history;
  const previous = notification.dedupId
    ? history.find(n => n.dedupId === notification.dedupId)
    : undefined;
  const next = {
    ...notification,
    occurrences: previous ? (previous.occurrences ?? 1) + 1 : notification.occurrences ?? 1,
  };
  return [next, ...history.filter(n => !next.dedupId || n.dedupId !== next.dedupId)]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export function notificationLimit(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
