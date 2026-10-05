import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EAF_NOTIFICATION_CONFIG } from '../../../packages/framework/src/angular/config';
import { NotificationService } from '../../../packages/framework/src/angular/services/notification.service';
import {
  ElectronPushService,
} from '../../../packages/framework/src/angular/services/electron-api/electron-push.service';
import { AppNotification, NotificationConfig } from '../../../packages/framework/src/shared/types/notification';
import { parseNotification } from '../../../packages/framework/src/shared/notifications';

const STORAGE_KEY = 'app-notifications';

function storedNotifications(storage: Storage): AppNotification[] {
  return JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
}

function notification(id: string, extras: Partial<AppNotification> = {}): AppNotification {
  return {
    id,
    title: 'Operazione completata',
    message: 'Messaggio',
    level: 'info',
    timestamp: Date.now(),
    read: false,
    ...extras,
  };
}

describe('NotificationService', () => {
  let backend: Subject<AppNotification>;
  let navigate: ReturnType<typeof vi.fn>;
  let invoke: ReturnType<typeof vi.fn>;
  let originalApi: Window['electronAPI'];

  function create(config: NotificationConfig = {}): NotificationService {
    TestBed.configureTestingModule({
      providers: [
        { provide: ElectronPushService, useValue: { on: () => backend } },
        { provide: Router, useValue: { navigateByUrl: navigate } },
        { provide: EAF_NOTIFICATION_CONFIG, useValue: config },
      ],
    });
    return TestBed.inject(NotificationService);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T12:00:00Z'));
    localStorage.clear();
    sessionStorage.clear();
    backend = new Subject();
    navigate = vi.fn().mockResolvedValue(true);
    invoke = vi.fn().mockResolvedValue({ success: true, data: null });
    originalApi = window.electronAPI;
    window.electronAPI = { ...originalApi, invoke: invoke as Window['electronAPI']['invoke'] };
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    window.electronAPI = originalApi;
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('receives backend notifications without mounting a toast panel', async () => {
    const service = create();
    await Promise.all([service.enableBackendChannel(), service.enableBackendChannel()]);
    backend.next(notification('backend'));
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(service.notifications()[0].id).toBe('backend');
    expect(service.toasts()[0].id).toBe('backend');
  });

  it('allows retrying channel activation after an IPC failure', async () => {
    const service = create();
    invoke.mockResolvedValueOnce({ success: false, error: 'Unavailable' });
    await expect(service.enableBackendChannel()).rejects.toThrow('Unavailable');
    await service.enableBackendChannel();
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, true])('persists and restores history with saveToHistory=%s', saveToHistory => {
    let service = create();
    service.info('Titolo', 'Messaggio', { saveToHistory });
    const id = service.notifications()[0].id;
    service.markAsRead(id);
    TestBed.resetTestingModule();
    service = create();
    expect(service.notifications()[0]).toMatchObject({ id, read: true });
    expect(service.toasts()).toEqual([]);
  });

  it.each(['local', 'session'] as const)(
    'uses %s storage by default and allows per-notification overrides',
    historyStorage => {
      let service = create({ historyStorage });
      const storage = historyStorage === 'local' ? localStorage : sessionStorage;
      const overrideStorage = historyStorage === 'local' ? sessionStorage : localStorage;
      service.info('Default', 'Messaggio');
      service.info('Eccezione', 'Messaggio', {
        historyStorage: historyStorage === 'local' ? 'session' : 'local',
      });
      expect(storedNotifications(storage).map(n => n.title)).toEqual(['Default']);
      expect(storedNotifications(overrideStorage).map(n => n.title)).toEqual(['Eccezione']);
      expect(service.unreadCount()).toBe(2);
      service.markAsRead(service.notifications().find(n => n.title === 'Eccezione')!.id);
      expect(storedNotifications(overrideStorage)[0].read).toBe(true);
      TestBed.resetTestingModule();
      service = create({ historyStorage });
      expect(service.notifications()).toHaveLength(2);
      expect(service.unreadCount()).toBe(1);
      expect(service.toasts()).toEqual([]);
    },
  );

  it('restores session history after reload but only local history in a new session', () => {
    let service = create({ historyStorage: 'session' });
    service.info('Sessione', 'Messaggio');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    service.info('Persistente', 'Messaggio', { historyStorage: 'local' });
    TestBed.resetTestingModule();
    service = create({ historyStorage: 'session' });
    expect(service.notifications()).toHaveLength(2);
    TestBed.resetTestingModule();
    sessionStorage.clear();
    service = create({ historyStorage: 'session' });
    expect(service.notifications().map(n => n.title)).toEqual(['Persistente']);
    expect(service.unreadCount()).toBe(1);
  });

  it('preserves storage destinations when the configured default changes', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([notification('legacy')]));
    let service = create({ historyStorage: 'session' });
    service.info('Sessione', 'Messaggio');
    service.markAsRead('legacy');
    expect(storedNotifications(localStorage).map(n => n.id)).toEqual(['legacy']);
    expect(storedNotifications(localStorage)[0].read).toBe(true);
    TestBed.resetTestingModule();
    service = create();
    service.markAllAsRead();
    expect(storedNotifications(localStorage).map(n => n.id)).toEqual(['legacy']);
    expect(storedNotifications(sessionStorage).map(n => n.title)).toEqual(['Sessione']);
    expect(storedNotifications(sessionStorage)[0].read).toBe(true);
  });

  it('updates read status and removes notifications from their respective storage', () => {
    const service = create();
    backend.next(notification('local'));
    backend.next(notification('session', { historyStorage: 'session' }));
    service.markAllAsRead();
    expect(storedNotifications(localStorage)[0].read).toBe(true);
    expect(storedNotifications(sessionStorage)[0].read).toBe(true);
    service.markAsUnread('session');
    expect(storedNotifications(sessionStorage)[0].read).toBe(false);
    service.clearRead();
    expect(storedNotifications(localStorage)).toEqual([]);
    expect(storedNotifications(sessionStorage).map(n => n.id)).toEqual(['session']);
    service.remove('session');
    expect(storedNotifications(sessionStorage)).toEqual([]);
    expect(service.notifications()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
  });

  it('clears history from both storage locations', () => {
    const service = create();
    service.info('Locale', 'Messaggio');
    service.info('Sessione', 'Messaggio', { historyStorage: 'session' });
    service.clearAll();
    TestBed.resetTestingModule();
    expect(create().notifications()).toEqual([]);
    expect(storedNotifications(localStorage)).toEqual([]);
    expect(storedNotifications(sessionStorage)).toEqual([]);
  });

  it.each(['local', 'session'] as const)(
    'moves deduplicated notifications to %s storage without restoring old copies',
    historyStorage => {
      let service = create();
      service.error('Errore', 'Prima', {
        dedupId: 'operation',
        historyStorage: historyStorage === 'local' ? 'session' : 'local',
      });
      service.error('Errore', 'Seconda', { dedupId: 'operation', historyStorage });
      const storage = historyStorage === 'local' ? localStorage : sessionStorage;
      const previousStorage = historyStorage === 'local' ? sessionStorage : localStorage;
      expect(storedNotifications(previousStorage)).toEqual([]);
      expect(storedNotifications(storage)[0]).toMatchObject({ message: 'Seconda', occurrences: 2 });
      TestBed.resetTestingModule();
      service = create();
      expect(service.notifications()).toHaveLength(1);
      expect(service.notifications()[0]).toMatchObject({ message: 'Seconda', occurrences: 2 });
    },
  );

  it('applies the history limit across both storage locations', () => {
    let service = create({ maxHistory: 2 });
    backend.next(notification('old', { timestamp: Date.now() - 1000 }));
    backend.next(notification('new', { timestamp: Date.now() + 1000, historyStorage: 'session' }));
    backend.next(notification('middle'));
    expect(storedNotifications(localStorage).map(n => n.id)).toEqual(['middle']);
    expect(storedNotifications(sessionStorage).map(n => n.id)).toEqual(['new']);
    TestBed.resetTestingModule();
    service = create({ maxHistory: 2 });
    expect(service.notifications().map(n => n.id)).toEqual(['new', 'middle']);
  });

  it.each(['local', 'session'] as const)(
    'restores the other storage when %s storage contains malformed data',
    historyStorage => {
      const storage = historyStorage === 'local' ? localStorage : sessionStorage;
      const otherStorage = historyStorage === 'local' ? sessionStorage : localStorage;
      storage.setItem(STORAGE_KEY, '{invalid');
      otherStorage.setItem(STORAGE_KEY, JSON.stringify([notification('valid')]));
      expect(create().notifications().map(n => n.id)).toEqual(['valid']);
    },
  );

  it.each(['local', 'session'] as const)(
    'does not persist toast-only notifications with an explicit %s storage override',
    async historyStorage => {
      const service = create({ historyStorage: historyStorage === 'local' ? 'session' : 'local' });
      service.info('Copia completata', 'Codici copiati.', { saveToHistory: false, historyStorage });
      const toast = service.toasts()[0];
      expect(toast.historyStorage).toBe(historyStorage);
      expect(await service.open(toast)).toBe(false);
      expect(service.notifications()).toEqual([]);
      expect(service.unreadCount()).toBe(0);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    },
  );

  it('shows toast-only notifications without changing history, storage or unread counts', () => {
    const service = create();
    service.info('Salvata', 'Messaggio', { dedupId: 'operation' });
    const history = service.notifications();
    const stored = localStorage.getItem(STORAGE_KEY);
    const listener = vi.fn();
    service.onNotification(listener);
    service.info('Copia completata', 'Codici copiati.', {
      saveToHistory: false,
      dedupId: 'operation',
    });
    const toast = service.toasts()[0];
    expect(toast).toMatchObject({
      title: 'Copia completata',
      message: 'Codici copiati.',
      saveToHistory: false,
    });
    expect(listener).toHaveBeenCalledWith(toast);
    expect(service.toasts()).toHaveLength(1);
    expect(service.notifications()).toBe(history);
    expect(service.unreadCount()).toBe(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(stored);
    service.addToHistory(toast);
    expect(service.notifications()).toBe(history);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(stored);
  });

  it('excludes toast-only entries when restoring saved history', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      notification('saved'),
      notification('transient', { saveToHistory: false }),
    ]));
    const service = create();
    expect(service.notifications().map(n => n.id)).toEqual(['saved']);
    expect(service.unreadCount()).toBe(1);
    service.markAllAsRead();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).map((n: AppNotification) => n.id))
      .toEqual(['saved']);
  });

  it('keeps disabled persistence in memory and discards old persisted history', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([notification('old')]));
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([notification('old-session')]));
    let service = create({ persistHistory: false, historyStorage: 'session' });
    expect(service.notifications()).toEqual([]);
    service.info('Solo memoria', 'Messaggio');
    service.info('Eccezione locale', 'Messaggio', { historyStorage: 'local' });
    service.info('Eccezione sessione', 'Messaggio', { historyStorage: 'session' });
    expect(service.notifications()).toHaveLength(3);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    TestBed.resetTestingModule();
    service = create({ persistHistory: false });
    expect(service.notifications()).toEqual([]);
  });

  it('validates saved history and migrates missing read status', () => {
    const legacy = { ...notification('legacy'), read: undefined };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      legacy,
      null,
      { id: 'invalid' },
      notification('bad-date', { timestamp: 1e20 }),
    ]));
    const service = create();
    expect(service.notifications()).toHaveLength(1);
    expect(service.notifications()[0]).toMatchObject({ id: 'legacy', read: false, occurrences: 1 });
  });

  it.each(['{invalid', '{}', 'null'])('handles malformed saved history: %s', raw => {
    localStorage.setItem(STORAGE_KEY, raw);
    expect(create().notifications()).toEqual([]);
  });

  it('bounds history and preserves newest-first ordering', () => {
    const service = create({ maxHistory: 2 });
    backend.next(notification('new', { timestamp: Date.now() + 1000 }));
    backend.next(notification('old', { timestamp: Date.now() - 1000 }));
    backend.next(notification('middle'));
    expect(service.notifications().map(n => n.id)).toEqual(['new', 'middle']);
  });

  it('deduplicates repeated errors, resets read status and counts occurrences', () => {
    const service = create();
    service.error('Errore', 'Prima', 'error', 'operation');
    service.markAllAsRead();
    service.error('Errore', 'Seconda', { dedupId: 'operation', details: 'Stack' });
    expect(service.notifications()).toHaveLength(1);
    expect(service.notifications()[0]).toMatchObject({
      message: 'Seconda',
      read: false,
      occurrences: 2,
      details: 'Stack',
    });
    expect(service.toasts()).toHaveLength(1);
  });

  it('ignores replayed backend IDs', () => {
    const service = create();
    backend.next(notification('same'));
    backend.next(notification('same'));
    expect(service.notifications()).toHaveLength(1);
    expect(service.toasts()).toHaveLength(1);
    expect(service.notifications()[0].occurrences).toBe(1);
  });

  it.each([undefined, false])(
    'queues and dismisses toasts without marking history as read with saveToHistory=%s',
    saveToHistory => {
      const service = create({ maxVisibleToasts: 2 });
      for (const id of ['a', 'b', 'c']) backend.next(notification(id, { saveToHistory }));
      const expectedUnread = saveToHistory === false ? 0 : 3;
      expect(service.toasts().map(n => n.id)).toEqual(['a', 'b']);
      service.dismissToast('a');
      expect(service.toasts().map(n => n.id)).toEqual(['b', 'c']);
      expect(service.unreadCount()).toBe(expectedUnread);
      vi.advanceTimersByTime(4999);
      expect(service.toasts()).toHaveLength(2);
      vi.advanceTimersByTime(1);
      expect(service.toasts()).toEqual([]);
      expect(service.unreadCount()).toBe(expectedUnread);
      if (saveToHistory === false) {
        expect(service.notifications()).toEqual([]);
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      }
    },
  );

  it.each([undefined, false])('pauses and resumes toasts with saveToHistory=%s', saveToHistory => {
    const service = create();
    backend.next(notification('paused', { saveToHistory }));
    vi.advanceTimersByTime(1000);
    service.setToastPaused('paused', 'pointer', true);
    service.setToastPaused('paused', 'focus', true);
    vi.advanceTimersByTime(10000);
    service.setToastPaused('paused', 'pointer', false);
    vi.advanceTimersByTime(10000);
    expect(service.toasts()).toHaveLength(1);
    service.setToastPaused('paused', 'focus', false);
    vi.advanceTimersByTime(3999);
    expect(service.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(service.toasts()).toEqual([]);
  });

  it('retains debug history and allows consumers to opt into debug toasts', () => {
    let service = create();
    service.debug('Diagnostica', 'Dettagli');
    expect(service.notifications()).toHaveLength(1);
    expect(service.toasts()).toEqual([]);
    TestBed.resetTestingModule();
    service = create({ showDebugToasts: true });
    vi.advanceTimersByTime(1);
    service.debug('Diagnostica', 'Nuovi dettagli');
    expect(service.toasts()).toHaveLength(1);
  });

  it('opens update destinations and marks read only after successful navigation', async () => {
    const service = create();
    service.notify({
      level: 'info',
      title: 'Aggiornamento disponibile',
      message: 'Versione 3',
      route: '/updates',
      actionLabel: 'Vai agli aggiornamenti',
    });
    navigate.mockResolvedValueOnce(false);
    await service.open(service.notifications()[0]);
    expect(service.unreadCount()).toBe(1);
    await service.open(service.notifications()[0]);
    expect(navigate).toHaveBeenCalledWith('/updates');
    expect(service.unreadCount()).toBe(0);
    expect(service.toasts()).toEqual([]);
  });

  it('opens ordinary notifications in their history detail', async () => {
    const service = create();
    service.info('Titolo', 'Messaggio');
    const n = service.notifications()[0];
    await service.open(n);
    expect(navigate).toHaveBeenCalledWith(`/notifications?notification=${n.id}`);
  });

  it.each([undefined, 'https://example.com'])(
    'does not open or retain a toast-only notification without an internal route: %s',
    async route => {
      const service = create();
      service.info('Copia completata', 'Codici copiati.', { saveToHistory: false, route });
      const toast = service.toasts()[0];
      expect(await service.open(toast)).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
      expect(service.notifications()).toEqual([]);
      expect(service.unreadCount()).toBe(0);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(service.toasts()).toEqual([toast]);
    },
  );

  it('opens a toast-only route and dismisses it only after successful navigation', async () => {
    const service = create();
    service.notify({
      level: 'info',
      title: 'Operazione completata',
      message: 'Apri il risultato',
      saveToHistory: false,
      route: '/updates',
    });
    const toast = service.toasts()[0];
    navigate.mockResolvedValueOnce(false);
    expect(await service.open(toast)).toBe(false);
    expect(service.toasts()).toEqual([toast]);
    expect(await service.open(toast)).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/updates');
    expect(service.toasts()).toEqual([]);
    expect(service.notifications()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('retains an opened toast even if its original history entry was evicted', async () => {
    const service = create({ maxHistory: 1 });
    backend.next(notification('older', { timestamp: Date.now() - 1000 }));
    backend.next(notification('newer'));
    await service.open(service.toasts()[0]);
    expect(service.notifications()[0]).toMatchObject({ id: 'older', read: true });
    expect(navigate).toHaveBeenCalledWith('/notifications?notification=older');
  });

  it('removes only read notifications and their queued toasts', () => {
    const service = create({ maxVisibleToasts: 1 });
    for (const id of ['a', 'b', 'c']) backend.next(notification(id));
    service.markAsRead('a');
    service.markAsRead('b');
    service.clearRead();
    expect(service.notifications().map(n => n.id)).toEqual(['c']);
    expect(service.toasts().map(n => n.id)).toEqual(['c']);
  });

  it('clears all toasts including ones already evicted from bounded history', () => {
    const service = create({ maxHistory: 1, maxVisibleToasts: 2 });
    for (const id of ['a', 'b', 'c']) backend.next(notification(id));
    service.clearAll();
    expect(service.notifications()).toEqual([]);
    expect(service.toasts()).toEqual([]);
    vi.advanceTimersByTime(20000);
    expect(service.toasts()).toEqual([]);
  });

  it('rejects external destinations from IPC and storage', () => {
    for (const route of ['https://example.com', '//example.com', '/\\example.com']) {
      expect(parseNotification(notification('invalid-route', { route }))?.route).toBeUndefined();
    }
  });
});
