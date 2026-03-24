import { PushService } from "./push.service";
import { BackupService } from "./backup.service";
import { DbConfigService } from "./db-config.service";
import { TestService } from "./test.service";
import { UpdaterService } from "./updater.service";
import { ControllerService } from "./controller.service";

export const SERVICES = [
  DbConfigService,
  PushService,
  BackupService,
  TestService,
  UpdaterService,
  ControllerService,
]