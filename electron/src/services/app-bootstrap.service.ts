import { BrowserWindow } from 'electron';
import { Injectable } from '../helpers/mini-pie/decorators';
import { Injector } from '../helpers/mini-pie/injector';
import { Logger } from '../helpers/logger';
import { AppDataSource } from '../db/data-source';
import { AppController, registerAllControllers } from '../controllers';
import { AppConfigService } from './app-config.service';
import { ElectronProtocolService } from './electron-protocol.service';
import { ElectronSplashWindowService } from './electron-splash-window.service';
import { ElectronMainWindowService } from './electron-main-window.service';
import { PushService } from './push.service';
import { LifecycleService } from './lifecycle.service';
import { ControllerService } from './controller.service';
import { BackupService } from './backup.service';
import { UpdaterService } from './updater.service';

/**
 * Service that orchestrates the application bootstrap process.
 * Handles initialization of database, controllers, services, and windows.
 */
@Injectable()
export class AppBootstrapService {
  private win: BrowserWindow | null = null;

  private get configService(): AppConfigService {
    return Injector.inject(AppConfigService);
  }

  private get protocolService(): ElectronProtocolService {
    return Injector.inject(ElectronProtocolService);
  }

  private get splashService(): ElectronSplashWindowService {
    return Injector.inject(ElectronSplashWindowService);
  }

  private get mainWindowService(): ElectronMainWindowService {
    return Injector.inject(ElectronMainWindowService);
  }

  /**
   * Runs the full application bootstrap sequence.
   * @param options Bootstrap options
   * @returns The main window instance
   */
  async bootstrap(options: { isDevMode: boolean }): Promise<BrowserWindow> {
    Logger.info('=== STARTING APPLICATION BOOTSTRAP ===');

    // Initialize config first
    this.configService.init(options);

    // Register protocol handler
    this.protocolService.registerHandler();

    // Initialize core services (database, controllers)
    await this.initializeCore();

    // Create windows
    this.win = await this.createWindows(options);

    // Initialize window-dependent services
    this.initializeWindowServices(this.win, options);

    // Run startup tasks (backup, updates)
    await this.runStartupTasks();

    Logger.info('=== APPLICATION BOOTSTRAP COMPLETED ===');
    return this.win;
  }

  /**
   * Gets the main window instance.
   */
  getMainWindow(): BrowserWindow | null {
    return this.win;
  }

  /**
   * Initializes core services: database and controllers.
   */
  private async initializeCore(): Promise<void> {
    try {
      Logger.info('[Bootstrap] Initializing database...');
      Logger.debug('[Bootstrap] Process resource path:', process.resourcesPath);

      await AppDataSource.initialize();
      Logger.info('[Bootstrap] ✓ Database connection established');

      registerAllControllers();
      Logger.info('[Bootstrap] ✓ Controllers registered');
    } catch (error) {
      Logger.error('[Bootstrap] ✗ Core initialization failed:', error);
      if (error instanceof Error) {
        Logger.error('[Bootstrap] Error stack:', error.stack);
      }
      throw error;
    }
  }

  /**
   * Creates splash and main windows with coordinated transition.
   */
  private async createWindows(options: { isDevMode: boolean }): Promise<BrowserWindow> {
    const config = this.configService.getConfig();

    // Create splash screen
    await this.splashService.create({
      width: config.splashScreen.width,
      height: config.splashScreen.height,
    }, options);

    // Small delay to ensure splash is visible
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create main window (splash will close automatically on ready-to-show)
    const win = await this.mainWindowService.create({
      width: config.mainWindow.width,
      height: config.mainWindow.height,
      title: config.name,
    }, options);

    return win;
  }

  /**
   * Initializes services that require a window reference.
   */
  private initializeWindowServices(win: BrowserWindow, options: { isDevMode: boolean }): void {
    // PushService needs window for IPC
    Injector.inject(PushService).setWindow(win);
    Logger.info('[Bootstrap] ✓ PushService initialized');

    // LifecycleService handles graceful shutdown
    const lifecycleService = Injector.inject(LifecycleService);
    lifecycleService.init(win, options);
    Logger.info('[Bootstrap] ✓ LifecycleService initialized');

    // AppController needs window for reload functionality
    const controllerService = Injector.inject(ControllerService);
    const appController = controllerService.getController<AppController>('AppController');
    if (appController) {
      const reloadInfo = this.mainWindowService.getReloadInfo();
      appController.setWindow(win, reloadInfo);
      Logger.info('[Bootstrap] ✓ AppController initialized');
    }
  }

  /**
   * Runs startup background tasks (backup, updates).
   */
  private async runStartupTasks(): Promise<void> {
    // Auto backup
    try {
      const backupService = Injector.inject(BackupService);
      await backupService.autoBackup();
      Logger.info('[Bootstrap] ✓ Startup backup completed');
    } catch (error) {
      Logger.error('[Bootstrap] Startup backup failed:', error);
    }

    // Check for updates (non-blocking)
    const updaterService = Injector.inject(UpdaterService);
    updaterService.checkForUpdates().catch((err: unknown) => {
      Logger.error('[Bootstrap] Startup update check failed:', err);
    });
    Logger.info('[Bootstrap] ✓ Startup update check initiated');
  }
}
