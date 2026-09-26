import { BackupService } from "../services/system-services/backup.service";
import type { BackupOptions } from "../../shared/types/backup";
import { BaseController } from "./base.controller";
import { IpcHandler } from "../decorators/ipc-handler.decorator";
import { Controller } from "../decorators/controller.decorator";

@Controller({ prefix: "backup" })
export class BackupController extends BaseController {
  constructor(private readonly backupService: BackupService) {
    super();
  }

  @IpcHandler("create")
  async createBackup(options: BackupOptions = {}) {
    return this.success(await this.backupService.createBackup(options));
  }

  @IpcHandler("auto")
  async autoBackup() {
    return this.success(await this.backupService.autoBackup());
  }

  @IpcHandler("list")
  async listBackups() {
    return this.success(await this.backupService.listBackups());
  }

  @IpcHandler("restore")
  async restoreBackup(backupPath: string) {
    return this.success(await this.backupService.restoreBackup(backupPath));
  }

  @IpcHandler("delete")
  async deleteBackup(backupPath: string) {
    return this.success(await this.backupService.deleteBackup(backupPath));
  }

  @IpcHandler("stats")
  async getBackupStats() {
    return this.success(await this.backupService.getBackupStats());
  }
}
