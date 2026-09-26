import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notifications } from '../../../packages/framework/src/angular/pages/notifications/notifications';
import {
  NotificationPanel,
} from '../../../packages/framework/src/angular/components/notification-panel/notification-panel';
import { NotificationService } from '../../../packages/framework/src/angular/services/notification.service';
import { NavigationService } from '../../../packages/framework/src/angular/services/navigation.service';
import {
  ElectronPushService,
} from '../../../packages/framework/src/angular/services/electron-api/electron-push.service';
import { EAF_NOTIFICATION_CONFIG } from '../../../packages/framework/src/angular/config';
import { AppNotification } from '../../../packages/framework/src/shared/types/notification';

describe('Notification views', () => {
  let service: NotificationService;
  let navigate: ReturnType<typeof vi.fn>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    localStorage.clear();
    navigate = vi.fn().mockResolvedValue(true);
    params = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [Notifications, NotificationPanel],
      providers: [
        { provide: Router, useValue: { navigateByUrl: navigate } },
        { provide: ActivatedRoute, useValue: { queryParamMap: params } },
        { provide: NavigationService, useValue: { clearToolbarActions: vi.fn() } },
        { provide: ElectronPushService, useValue: { on: () => new Subject() } },
        { provide: EAF_NOTIFICATION_CONFIG, useValue: { persistHistory: false } },
      ],
    });
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  function add(id: string, extras: Partial<AppNotification> = {}): void {
    service.addToHistory({
      id,
      title: `Titolo ${id}`,
      message: `Messaggio ${id}`,
      level: 'info',
      timestamp: Date.now(),
      read: false,
      ...extras,
    });
  }

  function page(): ComponentFixture<Notifications> {
    const fixture = TestBed.createComponent(Notifications);
    fixture.detectChanges();
    return fixture;
  }

  it('groups dates, searches messages and exposes debug through its dedicated filter', () => {
    add('today');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    add('yesterday', { timestamp: yesterday.getTime() });
    add('debug', { level: 'debug' });
    const fixture = page();
    const root: HTMLElement = fixture.nativeElement;
    expect([...root.querySelectorAll('.notification-group h3')].map(n => n.textContent))
      .toEqual(['Oggi', 'Ieri']);
    expect(root.querySelectorAll('.notification-item')).toHaveLength(2);
    const input = root.querySelector('input')!;
    input.value = 'MESSAGGIO yesterday';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(root.querySelectorAll('.notification-item')).toHaveLength(1);
    expect(root.querySelector('.notification-title')?.textContent).toContain('yesterday');
    fixture.componentInstance.setSearch('');
    fixture.componentInstance.setLevel('debug');
    fixture.detectChanges();
    expect(root.querySelector('.notification-title')?.textContent).toContain('debug');
  });

  it('keeps an opened unread notification visible until its detail is closed', () => {
    add('unread', { details: 'Technical stack' });
    const fixture = page();
    const root: HTMLElement = fixture.nativeElement;
    fixture.componentInstance.setUnreadOnly(true);
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('.notification-main')!.click();
    fixture.detectChanges();
    expect(service.unreadCount()).toBe(0);
    expect(root.querySelector('.notification-expanded')).not.toBeNull();
    expect(root.querySelector('details pre')?.textContent).toBe('Technical stack');
    root.querySelector<HTMLButtonElement>('.notification-main')!.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.notification-item')).toHaveLength(0);
  });

  it('opens route notifications directly when clicking their row', async () => {
    add('update', { route: '/updates', actionLabel: 'Vai agli aggiornamenti' });
    const fixture = page();
    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>('.notification-main')!.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/updates');
    expect(service.unreadCount()).toBe(0);
  });

  it('opens toast-selected details even when the page is already filtered', () => {
    add('selected');
    const fixture = page();
    fixture.componentInstance.setSearch('No match');
    params.next(convertToParamMap({ notification: 'selected' }));
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.notification-expanded')?.textContent).toContain('Messaggio selected');
    expect(service.unreadCount()).toBe(0);
  });

  it('separates the toast close button from its navigation action', async () => {
    service.info('Prima', 'Messaggio');
    const fixture = TestBed.createComponent(NotificationPanel);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>('.notification-close')!.click();
    fixture.detectChanges();
    expect(service.unreadCount()).toBe(1);
    expect(navigate).not.toHaveBeenCalled();
    service.info('Aggiornamento', 'Versione disponibile', { route: '/updates' });
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('.notification-content')!.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/updates');
    expect(service.unreadCount()).toBe(1);
    expect(service.toasts()).toEqual([]);
  });
});
