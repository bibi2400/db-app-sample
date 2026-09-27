import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toolbar } from '../src/angular/components/toolbar/toolbar';
import { ElectronUpdateService } from '../src/angular/services/electron-api/electron-update.service';
import { ElectronZoomService } from '../src/angular/services/electron-api/electron-zoom.service';
import { GracefulShutdownService } from '../src/angular/services/graceful-shutdown.service';
import { NavigationService } from '../src/angular/services/navigation.service';
import { NotificationService } from '../src/angular/services/notification.service';
import { UpdateStateService } from '../src/angular/services/update-state.service';
import { UpdateStatus, UpdateStatusType } from '../src/angular/types/update';

describe('Toolbar notices', () => {
  let changes: Subject<UpdateStatus>;
  let resolveStatus: (result: Awaited<ReturnType<ElectronUpdateService['getStatus']>>) => void;
  let rejectStatus: (error: Error) => void;
  let updates: {
    statusChanged$: Subject<UpdateStatus>;
    getStatus: ReturnType<typeof vi.fn>;
    downloadUpdate: ReturnType<typeof vi.fn>;
    installUpdate: ReturnType<typeof vi.fn>;
    checkForUpdates: ReturnType<typeof vi.fn>;
  };

  function status(value: UpdateStatusType): UpdateStatus {
    return { status: value, currentVersion: '1.0.0', availableVersion: '2.0.0' };
  }

  beforeEach(() => {
    changes = new Subject<UpdateStatus>();
    const initial = new Promise<Awaited<ReturnType<ElectronUpdateService['getStatus']>>>(
      (resolve, reject) => {
        resolveStatus = resolve;
        rejectStatus = reject;
      },
    );
    updates = {
      statusChanged$: changes,
      getStatus: vi.fn().mockReturnValue(initial),
      downloadUpdate: vi.fn(),
      installUpdate: vi.fn(),
      checkForUpdates: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [Toolbar],
      providers: [
        provideRouter([{ path: 'updates', children: [] }]),
        { provide: ElectronUpdateService, useValue: updates },
        { provide: NotificationService, useValue: { unreadCount: signal(0) } },
        { provide: GracefulShutdownService, useValue: { quit: vi.fn() } },
        {
          provide: ElectronZoomService,
          useValue: {
            canZoomIn: signal(true),
            canZoomOut: signal(true),
            zoomPercent: signal(100),
          },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  function toolbar() {
    const fixture = TestBed.createComponent(Toolbar);
    fixture.detectChanges();
    return fixture;
  }

  it.each([
    ['available', 'Aggiornamento disponibile'],
    ['downloaded', 'Aggiornamento pronto da installare'],
  ] as const)('reads initial %s and navigates without updater operations', async (value, label) => {
    const fixture = toolbar();
    expect(fixture.nativeElement.querySelector('.update-notice')).toBeNull();
    resolveStatus({ success: true, data: status(value) });
    await fixture.whenStable();
    fixture.detectChanges();
    const notice: HTMLAnchorElement = fixture.nativeElement.querySelector('.update-notice');
    expect(notice.textContent?.trim()).toBe(label);
    expect(notice.getAttribute('href')).toBe('/updates');
    expect(TestBed.inject(NavigationService).updateAvailable()).toBe(true);
    notice.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/updates');
    expect(updates.downloadUpdate).not.toHaveBeenCalled();
    expect(updates.installUpdate).not.toHaveBeenCalled();
    expect(updates.checkForUpdates).not.toHaveBeenCalled();
    expect(updates.getStatus).toHaveBeenCalledTimes(1);
  });

  it('keeps the notice and menu badge consistent through every status', () => {
    const fixture = toolbar();
    const navigation = TestBed.inject(NavigationService);
    const states: UpdateStatusType[] = [
      'available', 'checking', 'downloaded', 'idle', 'available',
      'downloading', 'downloaded', 'not-available', 'available', 'error',
    ];
    for (const value of states) {
      changes.next(status(value));
      fixture.detectChanges();
      const label = value === 'available'
        ? 'Aggiornamento disponibile'
        : value === 'downloaded' ? 'Aggiornamento pronto da installare' : null;
      const notice = fixture.nativeElement.querySelector('.update-notice');
      expect(notice?.textContent?.trim() ?? null).toBe(label);
      expect(navigation.updateAvailable()).toBe(label !== null);
    }
  });

  it.each(['idle', 'downloaded'] as const)('ignores a late initial response after %s', async value => {
    const fixture = toolbar();
    changes.next(status(value));
    resolveStatus({ success: true, data: status('available') });
    await fixture.whenStable();
    expect(TestBed.inject(UpdateStateService).status()?.status).toBe(value);
    expect(TestBed.inject(NavigationService).updateAvailable()).toBe(value === 'downloaded');
  });

  it('allows opting out and adding, updating and removing independent custom notices', () => {
    const fixture = toolbar();
    const navigation = TestBed.inject(NavigationService);
    const callback = vi.fn();
    changes.next(status('downloaded'));
    navigation.showUpdateNotice.set(false);
    navigation.toolbarNotices.set([{ id: 'custom', label: 'Avviso custom', callback }]);
    navigation.clearToolbarActions();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.update-notice')).toBeNull();
    expect(navigation.updateAvailable()).toBe(true);
    const notice: HTMLButtonElement = fixture.nativeElement.querySelector('.toolbar-notice');
    expect(notice.textContent?.trim()).toBe('Avviso custom');
    notice.click();
    expect(callback).toHaveBeenCalledTimes(1);
    navigation.toolbarNotices.set([{ id: 'custom', label: 'Testo aggiornato', callback }]);
    navigation.showUpdateNotice.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.toolbar-notice')).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('Testo aggiornato');
    navigation.toolbarNotices.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.toolbar-notice')).toHaveLength(1);
  });

  it('moves a single notice group in DOM order and preserves custom actions', () => {
    const fixture = toolbar();
    const navigation = TestBed.inject(NavigationService);
    const callback = vi.fn();
    navigation.toolbarLogoUrl.set('logo.png');
    navigation.toolbarNotices.set([{ id: 'custom', label: 'Avviso custom', callback }]);
    changes.next(status('available'));
    expect(navigation.toolbarNoticePosition()).toBe('center');
    expect(navigation.toolbarNoticeShape()).toBe('rounded');
    for (const position of ['title', 'center', 'right'] as const) {
      navigation.toolbarNoticePosition.set(position);
      fixture.detectChanges();
      const root: HTMLElement = fixture.nativeElement;
      const group = root.querySelector('.toolbar-notices')!;
      expect(root.querySelectorAll('.toolbar-notices')).toHaveLength(1);
      expect(group.querySelectorAll('.toolbar-notice')).toHaveLength(2);
      expect(group.getAttribute('data-position')).toBe(position);
      const previousClass = position === 'title' ? 'page-title' :
        position === 'center' ? 'toolbar-leading' : 'toolbar-spacer';
      expect(group.previousElementSibling?.classList.contains(previousClass)).toBe(true);
      if (position === 'right') {
        expect(group.nextElementSibling?.classList.contains('toolbar-commands')).toBe(true);
      }
      group.querySelector<HTMLButtonElement>('button')!.click();
      expect(group.querySelector('a')?.getAttribute('href')).toBe('/updates');
    }
    expect(callback).toHaveBeenCalledTimes(3);
    navigation.showUpdateNotice.set(false);
    navigation.toolbarNotices.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.toolbar-notices')).toBeNull();
    expect(fixture.nativeElement.querySelector('.toolbar-spacer')).not.toBeNull();
  });

  it.each(['failure', 'rejection'] as const)('handles initial %s and continues receiving pushes', async kind => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fixture = toolbar();
    if (kind === 'failure') resolveStatus({ success: false, error: 'offline' });
    else rejectStatus(new Error('offline'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.update-notice')).toBeNull();
    changes.next(status('available'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.update-notice')).not.toBeNull();
  });

  it('handles a push error without clearing the last known state', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fixture = toolbar();
    changes.next(status('downloaded'));
    changes.error(new Error('disconnected'));
    resolveStatus({ success: true, data: status('idle') });
    await fixture.whenStable();
    expect(warning).toHaveBeenCalledOnce();
    expect(TestBed.inject(UpdateStateService).status()?.status).toBe('downloaded');
  });

  it('shares one listener and releases it on destruction, ignoring pending responses', async () => {
    toolbar();
    toolbar();
    const state = TestBed.inject(UpdateStateService);
    const navigation = TestBed.inject(NavigationService);
    const complete = vi.fn();
    state.statusChanged$.subscribe({ complete });
    expect(changes.observers).toHaveLength(1);
    expect(updates.getStatus).toHaveBeenCalledTimes(1);
    TestBed.resetTestingModule();
    expect(changes.observers).toHaveLength(0);
    expect(complete).toHaveBeenCalledOnce();
    resolveStatus({ success: true, data: status('available') });
    await Promise.resolve();
    expect(state.status()).toBeNull();
    expect(navigation.updateAvailable()).toBe(false);
  });
});
