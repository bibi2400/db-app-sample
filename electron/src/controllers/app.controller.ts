import { BrowserWindow, app, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { BaseController } from './base.controller';
import { IpcHandler } from '../decorators/ipc-handler.decorator';
import { Controller } from '../decorators/controller.decorator';
import { Logger } from '../helpers/logger';
import { AppConfigService } from '../services/app-config.service';
import { AppDataService } from '../services/app-data.service';
import { DbConfigService } from '../services/db-config.service';

@Controller({ prefix: 'app' })
export class AppController extends BaseController {
  private win: BrowserWindow | null = null;
  private loadedUrl: string | null = null;
  private indexFilePath: string | null = null;
  private serve = false;

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly appDataService: AppDataService,
    private readonly dbConfigService: DbConfigService,
  ) {
    super();
  }

  @IpcHandler('info')
  async getAppInfo() {
    const info = this.appConfigService.getInfo();
    return this.success({
      name: info.name,
      version: info.version,
    });
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

  @IpcHandler('open-appdata')
  async openAppData() {
    try {
      const appDataPath = this.appDataService.getBasePath();
      shell.openPath(appDataPath);
      return this.success(null);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler('details')
  async getAppDetails() {
    try {
      const info = this.appConfigService.getInfo();
      const dbPath = this.dbConfigService.dbPath;
      const resolvedDbPath = path.isAbsolute(dbPath)
        ? dbPath
        : path.resolve(app.getAppPath(), dbPath);
      return this.success({
        name: info.name,
        version: info.version,
        dbPath: resolvedDbPath,
        appDataPath: this.appDataService.getBasePath(),
        installPath: app.getAppPath(),
        electron: process.versions.electron,
        node: process.versions.node,
        chrome: process.versions.chrome,
      });
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler('change-db-path')
  async changeDbPath() {
    try {
      if (!this.win || this.win.isDestroyed()) {
        return this.error('Finestra non disponibile');
      }

      const currentDbPath = this.dbConfigService.dbPath;
      const currentDir = path.isAbsolute(currentDbPath)
        ? path.dirname(currentDbPath)
        : path.resolve(app.getAppPath(), path.dirname(currentDbPath));

      const result = await dialog.showOpenDialog(this.win, {
        title: 'Seleziona la cartella del database',
        defaultPath: currentDir,
        properties: ['openDirectory'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return this.success(null);
      }

      const folder = result.filePaths[0];
      const dbFile = path.join(folder, 'database.sqlite');

      if (!fs.existsSync(dbFile)) {
        return this.error(
          `Il file 'database.sqlite' non è stato trovato in:\n\n${folder}\n\nSeleziona un percorso valido contenente il database.`
        );
      }

      const newDbPath = dbFile.replace(/\\/g, '/');
      this.dbConfigService.dbPath = newDbPath;
      Logger.info(`[App] Database path changed to: ${newDbPath}`);

      return this.success({ dbPath: newDbPath, restartRequired: true });
    } catch (error) {
      return this.error(error);
    }
  }
}
