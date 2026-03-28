import { DevModeService } from "./dev-mode.service";
import { PushService } from "./push.service";
import { BackupService } from "./backup.service";
import { AppDataService } from "./app-data.service";
import { ConfigService } from "./config.service";
import { CacheService } from "./cache.service";
import { DbConfigService } from "./db-config.service";
import { TestService } from "./test.service";
import { UpdaterService } from "./updater.service";
import { ControllerService } from "./controller.service";
import { ContextMenuService } from "./context-menu.service";
import { LifecycleService } from "./lifecycle.service";
import { ElectronWindowService } from "./electron-window.service";
import { ElectronSplashWindowService } from "./electron-splash-window.service";
import { ElectronMainWindowService } from "./electron-main-window.service";
import { AppBootstrapService } from "./app-bootstrap.service";
import { AppConfigService } from "./app-config.service";
import { NotificationService } from "./notification.service";
import { ErrorNotificationService } from "./error-notification.service";
import { DataSourceService } from "./data-source.service";

export const SYSTEM_SERVICES = [
  DevModeService,
  AppDataService,
  ConfigService,
  CacheService,
  DbConfigService,
  AppConfigService,
  DataSourceService,

  // Core services
  PushService,
  NotificationService,
  ErrorNotificationService,
  BackupService,
  TestService,
  UpdaterService,
  ControllerService,
  ContextMenuService,
  LifecycleService,

  // Window services
  ElectronWindowService,
  ElectronSplashWindowService,
  ElectronMainWindowService,

  // Bootstrap service (must be last, depends on all others)
  AppBootstrapService,
];
