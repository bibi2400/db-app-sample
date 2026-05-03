// @bibi2400/electron-angular-framework/angular
// Angular frontend: config, components, services, routes

// ─── Framework Config ────────────────────────────────────────────────────────
export { FrameworkConfig } from './config';
export type { FrameworkConfigOptions } from './config';

// ─── Framework Shell (all-in-one layout component) ───────────────────────────
export { FrameworkShell } from './components/framework-shell/framework-shell';

// ─── Individual UI Components (building blocks) ──────────────────────────────
export { Sidebar } from './components/sidebar/sidebar';
export { Toolbar } from './components/toolbar/toolbar';
export { NotificationPanel } from './components/notification-panel/notification-panel';
export { CommandPalette } from './components/command-palette/command-palette';
export { EafDialog } from './components/dialogs/eaf-dialog/eaf-dialog';
export type { EafDialogData, EafDialogButton } from './components/dialogs/eaf-dialog/eaf-dialog';
export { ShortcutRecordDialog } from './components/dialogs/shortcut-record-dialog/shortcut-record-dialog';
export { FullscreenLoaderComponent } from './components/fullscreen-loader/fullscreen-loader';
export { ScrollRestorer } from './components/scroll-restorer/scroll-restorer';

// ─── Form Elements ───────────────────────────────────────────────────────────
export { EafSelect } from './components/form-elements/eaf-select/eaf-select';
export { EafFileUpload } from './components/form-elements/eaf-file-upload/eaf-file-upload';
export { EafInput } from './components/form-elements/eaf-input/eaf-input';

// ─── Side Tab (linguetta laterale con pannello azioni) ───────────────────────
export { EafSideTab } from './components/eaf-side-tab/eaf-side-tab';

// ─── EAF Table ───────────────────────────────────────────────────────────────
export { EafTable } from './components/eaf-table/eaf-table';
export { EafTableFilter } from './components/eaf-table-filter/eaf-table-filter';
export { EafCellDefDirective, EafFilterDefDirective, EafActionsDefDirective } from './directives/eaf-table.directives';
export { EafTableStorageService } from './services/eaf-table-storage.service';
export type {
  EafColumnDef,
  EafColumnState,
  EafFilterType,
  EafFilterConfig,
  EafSelectOption,
  EafSelectPredicateOption,
  EafPaginationConfig,
  EafPageEvent,
  EafSelectionMode,
  EafSortState,
  EafFilterValue,
  EafTableState,
  EafTableServerEvent,
  EafCellContext,
  EafFilterContext,
  EafActionsContext,
} from './types/eaf-table.types';

// ─── Routes ──────────────────────────────────────────────────────────────────
export { FrameworkRoutes } from './routes';

// ─── Angular Services ────────────────────────────────────────────────────────
export { ElectronPushService } from './services/electron-api/electron-push.service';
export { ElectronAppService } from './services/electron-api/electron-app.service';
export { ElectronBackupService } from './services/electron-api/electron-backup.service';
export { ElectronUpdateService } from './services/electron-api/electron-update.service';
export { ElectronUploadService } from './services/electron-api/electron-upload.service';
export { NavigationService } from './services/navigation.service';
export { NotificationService as AngularNotificationService } from './services/notification.service';
export { ShortcutService } from './services/shortcut.service';
export { SHORTCUT_REGISTRY } from './services/shortcut-registry';
export { CommandPaletteService } from './services/command-palette.service';
export { ChronoService, Chronomancer } from './services/chrono.service';
export { DialogService } from './services/dialog.service';
export type { UnsavedChangesChoice, UnsavedChangesMode } from './services/dialog.service';

// ─── Types (re-exported from shared for convenience) ─────────────────────────
export type { MenuItem, MenuInsertPosition } from './services/navigation.service';
export type { CommandPaletteItem } from './types/command-palette';
export type { AppNotification, NotificationLevel } from './types/notification';
export type { UpdateStatus, UpdateStatusType, DownloadProgress, ChangelogEntry } from './types/update';
export type { BackupInfo, BackupOptions, RestoreResult, BackupStats } from './types/backup';
export type {
  AttachmentInfo,
  UploadFileRequest,
  UploadOptions,
  UploadProgress,
  UploadResult,
} from './types/upload';
export type { KeyBinding, ShortcutEntry, ShortcutDefinition } from './types/shortcut';
export type { IpcResponse } from './types/global';
