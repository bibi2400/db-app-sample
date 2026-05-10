// @bibi2400/electron-angular-framework/shared
// Shared types and utilities (platform-agnostic)

export { Chronomancer } from './chronomancer/chronomancer';
export type {
  ChronoConfig,
  ChronoLogger,
  TimeProvider,
  MeasurementStats,
  ChronoReport,
  ScopeReport,
  MeasurementRecord,
} from './chronomancer/chronomancer.types';

export type { IpcResponse } from './types/ipc';
export type { AppNotification, NotificationLevel } from './types/notification';
export type { UpdateStatusType, UpdateStatus, DownloadProgress, ChangelogEntry } from './types/update';
export type { BackupInfo, BackupOptions, RestoreResult, BackupStats } from './types/backup';
export type {
  AttachmentInfo,
  UploadFileRequest,
  UploadOptions,
  UploadProgress,
  UploadResult,
} from './types/upload';
export type { KeyBinding, ShortcutEntry, ShortcutDefinition } from './types/shortcut';
export type { CommandPaletteItem } from './types/command-palette';
export { DbMigrationDefinition } from './types/db-migration';
