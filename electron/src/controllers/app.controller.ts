import { BrowserWindow, app } from 'electron';
import { BaseController } from './base.controller';
import { IpcHandler } from '../decorators/ipc-handler.decorator';
import { Controller } from '../decorators/controller.decorator';
import { Logger } from '../helpers/logger';

@Controller({ prefix: 'app' })
export class AppController extends BaseController {
  private win: BrowserWindow | null = null;
  private loadedUrl: string | null = null;
  private indexFilePath: string | null = null;
  private serve = false;

  constructor() {
    super();
  }

  /**
   * Sets the main window reference and loading configuration.
   * Must be called after the window is created.
   */
  setWindow(win: BrowserWindow, options: { serve: boolean; loadedUrl?: string; indexFilePath?: string }): void {
    this.win = win;
    this.serve = options.serve;
    this.loadedUrl = options.loadedUrl ?? null;
    this.indexFilePath = options.indexFilePath ?? null;
  }

  @IpcHandler('reload')
  async reload() {
    try {
      if (this.win && !this.win.isDestroyed()) {
        Logger.info('Reloading app...');
        if (this.serve && this.loadedUrl) {
          this.win.reload();
        } else if (this.indexFilePath) {
          Logger.info('Reloading from:', this.indexFilePath);
          await this.win.loadURL(this.indexFilePath);
        }
      }
      return this.success(null);
    } catch (error) {
      return this.error(error);
    }
  }
}
