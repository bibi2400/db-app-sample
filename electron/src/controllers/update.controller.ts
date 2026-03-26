import { UpdaterService } from '../services/system-services/updater.service';
import { BaseController } from './base.controller';
import { IpcHandler } from '../decorators/ipc-handler.decorator';
import { Controller } from '../decorators/controller.decorator';

@Controller({ prefix: 'update' })
export class UpdateController extends BaseController {
  constructor(private readonly updaterService: UpdaterService) {
    super();
  }

  @IpcHandler('check')
  async checkForUpdates() {
    try {
      await this.updaterService.checkForUpdates();
      return this.success(null);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler('status')
  async getStatus() {
    try {
      const status = await this.updaterService.getStatus();
      return this.success(status);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler('download')
  async downloadUpdate() {
    try {
      await this.updaterService.download();
      return this.success(null);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler('install')
  async installUpdate() {
    try {
      this.updaterService.install();
      return this.success(null);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler('repair')
  async repairInstallation() {
    try {
      await this.updaterService.repairInstallation();
      return this.success(null);
    } catch (error) {
      return this.error(error);
    }
  }

}
