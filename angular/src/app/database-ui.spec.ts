import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EAF_DATABASE_UI_CONFIG } from '../../../packages/framework/src/angular/config';
import { FrameworkRoutes } from '../../../packages/framework/src/angular/routes';
import { AppInfo } from '../../../packages/framework/src/angular/pages/app-info/app-info';
import {
  DatabaseUiService,
} from '../../../packages/framework/src/angular/services/database-ui.service';
import { NavigationService } from '../../../packages/framework/src/angular/services/navigation.service';
import { ShortcutService } from '../../../packages/framework/src/angular/services/shortcut.service';
import {
  CommandPaletteService,
} from '../../../packages/framework/src/angular/services/command-palette.service';
import {
  GracefulShutdownService,
} from '../../../packages/framework/src/angular/services/graceful-shutdown.service';
import { DialogService } from '../../../packages/framework/src/angular/services/dialog.service';
import {
  ElectronAppService,
} from '../../../packages/framework/src/angular/services/electron-api/electron-app.service';
import {
  ElectronUploadService,
} from '../../../packages/framework/src/angular/services/electron-api/electron-upload.service';
import {
  ElectronBackupService,
} from '../../../packages/framework/src/angular/services/electron-api/electron-backup.service';

describe('Internal database UI policy', () => {
  const details = {
    name: 'Test app',
    version: '1.0',
    dbPath: 'C:/internal/database.sqlite',
    appDataPath: 'C:/internal',
    installPath: 'C:/app',
    electron: '1',
    node: '2',
    chrome: '3',
  };
  let app: {
    getDetails: ReturnType<typeof vi.fn>;
    changeDbPath: ReturnType<typeof vi.fn>;
    openDbFolder: ReturnType<typeof vi.fn>;
    quit: ReturnType<typeof vi.fn>;
  };
  let confirm: ReturnType<typeof vi.fn>;
  let autoBackup: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.removeItem('app-shortcut-bindings');
    app = {
      getDetails: vi.fn().mockResolvedValue(details),
      changeDbPath: vi.fn(),
      openDbFolder: vi.fn(),
      quit: vi.fn().mockResolvedValue(undefined),
    };
    confirm = vi.fn().mockResolvedValue(true);
    autoBackup = vi.fn().mockResolvedValue({ success: true, data: null });
    TestBed.configureTestingModule({
      imports: [AppInfo],
      providers: [
        provideRouter(FrameworkRoutes.build([{ path: 'dashboard', component: AppInfo }])),
        { provide: EAF_DATABASE_UI_CONFIG, useValue: { enabled: false } },
        { provide: ElectronAppService, useValue: app },
        { provide: DialogService, useValue: { confirm } },
        { provide: ElectronBackupService, useValue: { autoBackup } },
        {
          provide: ElectronUploadService,
          useValue: {
            getRepositoryPath: vi.fn().mockResolvedValue({ success: true, data: 'C:/files' }),
          },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.removeItem('app-shortcut-bindings');
  });

  async function page() {
    const fixture = TestBed.createComponent(AppInfo);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.details()).toEqual(details));
    fixture.detectChanges();
    return fixture;
  }

  it('preserves the original menu and shortcuts when no policy is provided', () => {
    TestBed.overrideProvider(EAF_DATABASE_UI_CONFIG, { useValue: {} });
    expect(TestBed.inject(DatabaseUiService).enabled).toBe(true);
    const navigation = TestBed.inject(NavigationService);
    expect(JSON.stringify(navigation.menu)).toContain('/backup');
    expect(TestBed.inject(ShortcutService).definitions().some(item => item.id === 'nav.backup')).toBe(true);
  });

  it('removes backup links recursively, including consumer entries and empty parents', () => {
    const navigation = TestBed.inject(NavigationService);
    navigation.addMenuItems([
      { title: 'Duplicate', icon: 'backup', route: '/backup?source=custom' },
      { title: 'Empty', icon: 'folder', children: [{ title: 'DB', icon: 'backup', route: '/backup' }] },
      { title: 'Other', icon: 'folder', route: '/other' },
    ]);
    const menu = JSON.stringify(navigation.menu);
    expect(menu).not.toContain('backup');
    expect(menu).not.toContain('Empty');
    expect(menu).toContain('/other');
    expect(menu).toContain('/updates');
  });

  it('redirects direct backup navigation to the home without loading backup UI', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/backup', AppInfo);
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });

  it('ignores a saved backup shortcut and removes its editable definition', () => {
    localStorage.setItem('app-shortcut-bindings', JSON.stringify({
      'nav.backup': { key: 'b', ctrl: true, alt: true },
    }));
    const shortcuts = TestBed.inject(ShortcutService);
    const triggered = vi.fn();
    shortcuts.on('nav.backup').subscribe(triggered);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, altKey: true }));
    expect(triggered).not.toHaveBeenCalled();
    expect(shortcuts.definitions().some(item => item.id === 'nav.backup')).toBe(false);
  });

  it('filters palette entries by route and reserved shortcut while keeping other commands', async () => {
    const palette = TestBed.inject(CommandPaletteService);
    const action = vi.fn();
    palette.registerMany([
      { id: 'nav.backup', label: 'Backup', category: 'Test', action },
      { id: 'custom.backup', label: 'Copy', category: 'Test', route: '/backup', action },
      { id: 'other.backup', label: 'Copy', category: 'Test', shortcutId: 'nav.backup', action },
      { id: 'test.other', label: 'Other', category: 'Test', action },
    ]);
    expect(palette.items().map(item => item.id)).toEqual(['test.other']);
    await palette.execute('nav.backup');
    expect(action).not.toHaveBeenCalled();
  });

  it('shows the DB only as read-only information in collapsed technical details', async () => {
    const fixture = await page();
    const root: HTMLElement = fixture.nativeElement;
    const technical = root.querySelector<HTMLDetailsElement>('details');
    expect(technical?.open).toBe(false);
    expect(technical?.querySelector('.database-technical-info')?.textContent).toContain(details.dbPath);
    expect(root.textContent).not.toContain('Percorso Database');
    expect(root.querySelector('[matTooltip="Cambia percorso database"]')).toBeNull();
    await fixture.componentInstance.changeDbPath();
    fixture.componentInstance.openDbFolder();
    expect(app.changeDbPath).not.toHaveBeenCalled();
    expect(app.openDbFolder).not.toHaveBeenCalled();
  });

  it('can hide the DB from technical details as well', async () => {
    TestBed.overrideProvider(EAF_DATABASE_UI_CONFIG, {
      useValue: { enabled: false, showTechnicalInfo: false },
    });
    const fixture = await page();
    expect(fixture.nativeElement.textContent).not.toContain(details.dbPath);
    expect(fixture.nativeElement.querySelector('.database-technical-info')).toBeNull();
  });

  it('keeps automatic backups active and uses generic shutdown messages', async () => {
    autoBackup.mockResolvedValueOnce({ success: false, error: 'database failure' });
    confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await TestBed.inject(GracefulShutdownService).quit();
    expect(autoBackup).toHaveBeenCalledTimes(1);
    expect(app.quit).not.toHaveBeenCalled();
    expect(JSON.stringify(confirm.mock.calls).toLowerCase()).not.toMatch(/database|backup/);
    await TestBed.inject(GracefulShutdownService).quit();
    expect(app.quit).toHaveBeenCalledTimes(1);
  });
});
