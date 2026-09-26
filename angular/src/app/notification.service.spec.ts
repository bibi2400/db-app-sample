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

  it('persists history by default and restores it without replaying toasts', () => {
    let service = create();
    service.info('Titolo', 'Messaggio');
    const id = service.notifications()[0].id;
    service.markAsRead(id);
    TestBed.resetTestingModule();
    service = create();
    expect(service.notifications()[0]).toMatchObject({ id, read: true });
    expect(service.toasts()).toEqual([]);
  });

  it('keeps disabled persistence in memory and discards old persisted history', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([notification('old')]));
    let service = create({ persistHistory: false });
    expect(service.notifications()).toEqual([]);
    service.info('Solo sessione', 'Messaggio');
    expect(service.notifications()).toHaveLength(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
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

  it('queues excess toasts and dismisses them without marking history as read', () => {
    const service = create({ maxVisibleToasts: 2 });
    for (const id of ['a', 'b', 'c']) backend.next(notification(id));
    expect(service.toasts().map(n => n.id)).toEqual(['a', 'b']);
    service.dismissToast('a');
    expect(service.toasts().map(n => n.id)).toEqual(['b', 'c']);
    expect(service.unreadCount()).toBe(3);
    vi.advanceTimersByTime(5000);
    expect(service.toasts()).toEqual([]);
    expect(service.unreadCount()).toBe(3);
  });

  it('pauses until both pointer and keyboard focus leave, preserving remaining time', () => {
    const service = create();
    backend.next(notification('paused'));
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
