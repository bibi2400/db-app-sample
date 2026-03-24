import { UpdaterService } from '../services/updater.service';
import { BaseController } from './base.controller';
import { IpcHandler } from '../decorators/ipc-handler.decorator';
import { Controller } from '../decorators/controller.decorator';

@Controller({ prefix: 'update' })
export class UpdateController extends BaseController {
  constructor(private updaterService: UpdaterService) {
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
      const status = this.updaterService.getStatus();
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
}
