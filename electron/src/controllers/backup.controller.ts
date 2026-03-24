import { BackupOptions, BackupService } from "../services/backup.service";
import { BaseController } from "./base.controller";
import { IpcHandler } from "../decorators/ipc-handler.decorator";
import { Controller } from "../decorators/controller.decorator";

@Controller({ prefix: "backup" })
export class BackupController extends BaseController {
  constructor(private backupService: BackupService) {
    super();
  }

  @IpcHandler("create")
  async createBackup(options: BackupOptions) {
    try {
      const backup = await this.backupService.createBackup(options);
      return this.success(backup);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("auto")
  async autoBackup() {
    try {
      const backup = await this.backupService.autoBackup();
      return this.success(backup);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("list")
  async listBackups() {
    try {
      const backups = await this.backupService.listBackups();
      return this.success(backups);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("restore")
  async restoreBackup(backupPath: string) {
    try {
      const result = await this.backupService.restoreBackup(backupPath);
      return this.success(result);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("delete")
  async deleteBackup(backupPath: string) {
    try {
      const deleted = await this.backupService.deleteBackup(backupPath);
      return this.success(deleted);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("stats")
  async getBackupStats() {
    try {
      const stats = await this.backupService.getBackupStats();
      return this.success(stats);
    } catch (error) {
      return this.error(error);
    }
  }
}
