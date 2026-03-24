import { PushService } from "./push.service";
import { BackupService } from "./backup.service";
import { ConfigService } from "./config.service";
import { DbConfigService } from "./db-config.service";
import { TestService } from "./test.service";
import { UpdaterService } from "./updater.service";
import { ControllerService } from "./controller.service";
import { LifecycleService } from "./lifecycle.service";
import { ElectronProtocolService } from "./electron-protocol.service";
import { ElectronWindowService } from "./electron-window.service";
import { ElectronSplashWindowService } from "./electron-splash-window.service";
import { ElectronMainWindowService } from "./electron-main-window.service";
import { AppBootstrapService } from "./app-bootstrap.service";
import { AppConfigService } from "./app-config.service";

export const SERVICES = [
  // Config services (must be first, order matters: ConfigService → consumers)
  ConfigService,
  DbConfigService,
  AppConfigService,

  // Core services
  PushService,
  BackupService,
  TestService,
  UpdaterService,
  ControllerService,
  LifecycleService,

  // Protocol service
  ElectronProtocolService,

  // Window services (order matters: base service first)
  ElectronWindowService,
  ElectronSplashWindowService,
  ElectronMainWindowService,

  // Bootstrap service (must be last, depends on all others)
  AppBootstrapService,
]