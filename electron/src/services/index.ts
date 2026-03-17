import { BackupService } from "./backup.service";
import { DbConfigService } from "./db-config.service";
import { TestService } from "./test.service";
import { UpdaterService } from "./updater.service";

export const SERVICES = [
  BackupService,
  DbConfigService,
  TestService,
  UpdaterService,
]