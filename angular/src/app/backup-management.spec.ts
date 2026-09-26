import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BackupManagement,
} from '../../../packages/framework/src/angular/pages/backup-management/backup-management';
import {
  ElectronBackupService,
} from '../../../packages/framework/src/angular/services/electron-api/electron-backup.service';
import {
  ElectronAppService,
} from '../../../packages/framework/src/angular/services/electron-api/electron-app.service';
import { NavigationService } from '../../../packages/framework/src/angular/services/navigation.service';
import { DialogService } from '../../../packages/framework/src/angular/services/dialog.service';
import { BackupInfo } from '../../../packages/framework/src/shared/types/backup';
import {
  GracefulShutdownService,
} from '../../../packages/framework/src/angular/services/graceful-shutdown.service';

const backup: BackupInfo = {
  filename: 'database_test.sqlite',
  path: 'C:/backups/manual/database_test.sqlite',
  date: new Date('2026-09-26T10:00:00Z'),
  type: 'manual',
  size: 2048,
  includesAttachments: true,
};

describe('Backup management', () => {
  let api: {
    listBackups: ReturnType<typeof vi.fn>;
    createBackup: ReturnType<typeof vi.fn>;
    restoreBackup: ReturnType<typeof vi.fn>;
    deleteBackup: ReturnType<typeof vi.fn>;
    autoBackup: ReturnType<typeof vi.fn>;
  };
  let reload: ReturnType<typeof vi.fn>;
  let confirm: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    api = {
      listBackups: vi.fn().mockResolvedValue({ success: true, data: [backup] }),
      createBackup: vi.fn().mockResolvedValue({ success: true, data: backup }),
      restoreBackup: vi.fn().mockResolvedValue({
        success: true,
        data: { success: true, message: 'ok', reloadRequired: true },
      }),
      deleteBackup: vi.fn().mockResolvedValue({ success: true, data: true }),
      autoBackup: vi.fn().mockResolvedValue({ success: true, data: null }),
    };
    reload = vi.fn().mockResolvedValue(undefined);
    confirm = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [BackupManagement],
      providers: [
        { provide: ElectronBackupService, useValue: api },
        { provide: ElectronAppService, useValue: { reload } },
        { provide: DialogService, useValue: { confirm } },
        { provide: NavigationService, useValue: { clearToolbarActions: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  async function page() {
    const fixture = TestBed.createComponent(BackupManagement);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows persistent load errors without presenting them as an empty list and can retry', async () => {
    api.listBackups.mockResolvedValueOnce({ success: false, error: 'Accesso negato' });
    const fixture = await page();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Accesso negato');
    expect(root.textContent).not.toContain('Nessun backup disponibile');
    await fixture.componentInstance.retryOperation();
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(root.textContent).toContain(backup.filename);
  });

  it('labels icon actions and computes totals from the displayed list including attachments', async () => {
    const fixture = await page();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector(`[aria-label="Ripristina ${backup.filename}"]`)).not.toBeNull();
    expect(root.querySelector(`[aria-label="Elimina ${backup.filename}"]`)).not.toBeNull();
    expect(root.textContent).toContain('Database e allegati');
    expect(fixture.componentInstance.stats()).toEqual({ count: 1, totalSize: 2048 });
  });

  it('retries list refresh after a successful creation without creating a duplicate backup', async () => {
    const fixture = await page();
    api.listBackups.mockResolvedValueOnce({ success: false, error: 'Elenco non disponibile' });
    await fixture.componentInstance.createManualBackup();
    expect(fixture.componentInstance.error()).toContain('Elenco non disponibile');
    await fixture.componentInstance.retryOperation();
    expect(api.createBackup).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.error()).toBeNull();
  });

  it('does not describe a damaged attachment bundle as a legacy database-only backup', async () => {
    api.listBackups.mockResolvedValueOnce({
      success: true,
      data: [{ ...backup, includesAttachments: false, attachmentError: 'Cartella mancante' }],
    });
    const fixture = await page();
    const scope: HTMLElement = fixture.nativeElement.querySelector('.backup-scope');
    expect(scope.textContent).toContain('Allegati mancanti o non validi');
    expect(scope.classList.contains('incomplete')).toBe(true);
    const restore: HTMLButtonElement = fixture.nativeElement.querySelector(
      `[aria-label="Ripristina ${backup.filename}"]`,
    );
    expect(restore.disabled).toBe(true);
    restore.click();
    expect(confirm).not.toHaveBeenCalled();
    expect(api.restoreBackup).not.toHaveBeenCalled();
  });

  it('prevents duplicate operations while a confirmation is open', async () => {
    const fixture = await page();
    let answer!: (value: boolean) => void;
    confirm.mockImplementationOnce(() => new Promise(resolve => { answer = resolve; }));
    const deletion = fixture.componentInstance.deleteBackup(backup);
    await fixture.componentInstance.createManualBackup();
    await fixture.componentInstance.deleteBackup(backup);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(api.createBackup).not.toHaveBeenCalled();
    answer(false);
    await deletion;
    expect(api.deleteBackup).not.toHaveBeenCalled();
    expect(fixture.componentInstance.busy()).toBe(false);
  });

  it('keeps the fullscreen loader active until the renderer reloads', async () => {
    const fixture = await page();
    await fixture.componentInstance.restoreBackup(backup);
    fixture.detectChanges();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.operation()).toBe('reload');
    expect(fixture.nativeElement.querySelector('app-fullscreen-loader')).not.toBeNull();
    await fixture.componentInstance.createManualBackup();
    expect(api.createBackup).not.toHaveBeenCalled();
  });

  it('retries a failed reload without repeating the database restore', async () => {
    const fixture = await page();
    reload.mockRejectedValueOnce(new Error('Ricaricamento fallito'));
    await fixture.componentInstance.restoreBackup(backup);
    expect(fixture.componentInstance.operation()).toBeNull();
    expect(fixture.componentInstance.reloadRequired()).toBe(true);
    expect(fixture.componentInstance.error()).toBe('Ricaricamento fallito');
    await fixture.componentInstance.retryOperation();
    expect(api.restoreBackup).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.operation()).toBe('reload');
  });

  it('shows restore failures without reloading and warns when restoring a legacy backup', async () => {
    const fixture = await page();
    api.restoreBackup.mockResolvedValueOnce({ success: false, error: 'Schema incompatibile' });
    await fixture.componentInstance.restoreBackup({ ...backup, includesAttachments: false });
    expect(confirm.mock.calls[0][1]).toContain('solo il database');
    expect(fixture.componentInstance.error()).toBe('Schema incompatibile');
    expect(reload).not.toHaveBeenCalled();
    expect(fixture.componentInstance.busy()).toBe(false);
  });

  it('does not quit silently when the automatic backup fails', async () => {
    const quit = vi.fn();
    TestBed.overrideProvider(ElectronAppService, { useValue: { reload, quit } });
    api.autoBackup.mockResolvedValueOnce({ success: false, error: 'Backup failed' });
    confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await TestBed.inject(GracefulShutdownService).quit();
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(quit).not.toHaveBeenCalled();
  });

  it('quits normally when a valid daily backup already exists', async () => {
    const quit = vi.fn();
    TestBed.overrideProvider(ElectronAppService, { useValue: { reload, quit } });
    await TestBed.inject(GracefulShutdownService).quit();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(quit).toHaveBeenCalledTimes(1);
  });
});

describe('Backup IPC client', () => {
  let originalApi: typeof window.electronAPI;
  let invoke: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalApi = window.electronAPI;
    invoke = vi.fn();
    window.electronAPI = { invoke } as unknown as typeof window.electronAPI;
  });

  afterEach(() => {
    window.electronAPI = originalApi;
    TestBed.resetTestingModule();
  });

  it('normalizes backup dates at the IPC boundary', async () => {
    invoke.mockResolvedValue({ success: true, data: [{ ...backup, date: backup.date.toISOString() }] });
    const result = await TestBed.inject(ElectronBackupService).listBackups();
    expect(result.data?.[0].date).toEqual(backup.date);
  });

  it('preserves operation errors and converts IPC rejection into a failed response', async () => {
    invoke.mockResolvedValueOnce({ success: false, error: 'Permission denied' });
    expect(await TestBed.inject(ElectronBackupService).deleteBackup(backup.path))
      .toEqual({ success: false, error: 'Permission denied' });
    invoke.mockRejectedValueOnce(new Error('IPC unavailable'));
    expect(await TestBed.inject(ElectronBackupService).restoreBackup(backup.path))
      .toEqual({ success: false, error: 'IPC unavailable' });
  });

  it('rejects unsuccessful renderer reload responses', async () => {
    invoke.mockResolvedValue({ success: false, error: 'Window unavailable' });
    await expect(TestBed.inject(ElectronAppService).reload()).rejects.toThrow('Window unavailable');
  });
});
