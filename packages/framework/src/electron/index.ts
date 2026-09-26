// @bibi2400/electron-angular-framework/electron
// Electron main process: bootstrap, DI, decorators, services, controllers

// ─── Bootstrap ───────────────────────────────────────────────────────────────
export { AppBootstrap } from './bootstrap';
export type { BootstrapConfig, BootstrapHooks, ContextMenuConfig } from './bootstrap';

// ─── Runtime Config ──────────────────────────────────────────────────────────
export type { RuntimeConfig } from './config/runtime-config';

// ─── DI Framework (mini-pie) ─────────────────────────────────────────────────
export { Injectable } from './helpers/mini-pie/decorators';
export { Injector } from './helpers/mini-pie/injector';
export type { Constructor } from './helpers/mini-pie/types';

// ─── Decorators ──────────────────────────────────────────────────────────────
export { Controller, getControllerMetadata, getRegisteredControllers, isController } from './decorators/controller.decorator';
export { IpcHandler, getIpcHandlerMetadata } from './decorators/ipc-handler.decorator';
export { PushChannel, PushEvent } from './decorators/push-channel.decorator';
export { OwnsAttachments, getOwnsAttachmentsType } from './decorators/owns-attachments.decorator';

// ─── Base Controller ─────────────────────────────────────────────────────────
export { BaseController } from './controllers/base.controller';

// ─── Helpers ─────────────────────────────────────────────────────────────────
export { Logger } from './helpers/logger';
export { PushEmitter } from './helpers/push/push-emitter';
export { buildFindOptions } from './helpers/build-find-options';

// ─── System Services (re-exported for consumer DI injection) ─────────────────
export { ConfigService } from './services/system-services/config.service';
export { DataSourceService } from './services/system-services/data-source.service';
export { AppConfigService } from './services/system-services/app-config.service';
export { AppDataService } from './services/system-services/app-data.service';
export { CacheService } from './services/system-services/cache.service';
export { DbConfigService } from './services/system-services/db-config.service';
export { DevModeService } from './services/system-services/dev-mode.service';
export { PushService } from './services/system-services/push.service';
export { NotificationService } from './services/system-services/notification.service';
export type {
  AppNotification,
  NotificationInput,
  NotificationLevel,
  NotificationOptions,
} from '../shared/types/notification';
export { ErrorNotificationService } from './services/system-services/error-notification.service';
export { BackupService } from './services/system-services/backup.service';
export { MaintenanceService } from './services/system-services/maintenance.service';
export { UpdaterService } from './services/system-services/updater.service';
export { UploadService } from './services/system-services/upload.service';
export { NoteService } from './services/system-services/note.service';
export { ControllerService } from './services/system-services/controller.service';
export { ContextMenuService } from './services/system-services/context-menu.service';
export { LifecycleService } from './services/system-services/lifecycle.service';
export { ElectronWindowService } from './services/system-services/electron-window.service';
export { ElectronSplashWindowService } from './services/system-services/electron-splash-window.service';
export { ElectronMainWindowService } from './services/system-services/electron-main-window.service';

// ─── Chronomancer (Electron adapter) ─────────────────────────────────────────
export { initChronomancerForElectron, Chronomancer } from './helpers/chronomancer.adapter';
