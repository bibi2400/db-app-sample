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
import { initChronomancerForElectron, Chronomancer } from '../helpers/chronomancer.adapter';

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
    // Initialize Chronomancer first
    initChronomancerForElectron({
      enabled: true,
      autoLog: options.isDevMode,
      logThresholdMs: 50,
    });

    // Start measuring total bootstrap time
    Chronomancer.start('app-bootstrap', 'bootstrap');

    Logger.info('=== STARTING APPLICATION BOOTSTRAP ===');

    // Initialize config first
    this.configService.init(options);

    // Register protocol handler
    this.protocolService.registerHandler();

    // Initialize core services (database, controllers)
    Chronomancer.checkpoint('app-bootstrap', 'before-core-init', 'bootstrap');
    await this.initializeCore();
    Chronomancer.checkpoint('app-bootstrap', 'after-core-init', 'bootstrap');

    // Create windows
    this.win = await this.createWindows(options);
    Chronomancer.checkpoint('app-bootstrap', 'after-windows-created', 'bootstrap');

    // Initialize window-dependent services
    this.initializeWindowServices(this.win, options);

    // Run startup tasks (backup, updates)
    await this.runStartupTasks();

    // Stop bootstrap measurement and print report
    const bootstrapDuration = Chronomancer.stop('app-bootstrap', 'bootstrap');
    Logger.info(`[Bootstrap] Total bootstrap time: ${bootstrapDuration.toFixed(2)}ms`);

    if (options.isDevMode) {
      Chronomancer.printReport();
    }

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

      Chronomancer.start('database-init', 'bootstrap');
      await AppDataSource.initialize();
      Chronomancer.stop('database-init', 'bootstrap');
      Logger.info('[Bootstrap] ✓ Database connection established');

      Chronomancer.start('controllers-register', 'bootstrap');
      registerAllControllers();
      Chronomancer.stop('controllers-register', 'bootstrap');
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
    Chronomancer.start('splash-window', 'bootstrap');
    await this.splashService.create({
      width: config.splashScreen.width,
      height: config.splashScreen.height,
    }, options);
    Chronomancer.stop('splash-window', 'bootstrap');

    // Small delay to ensure splash is visible
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create main window (splash will close automatically on ready-to-show)
    Chronomancer.start('main-window', 'bootstrap');
    const win = await this.mainWindowService.create({
      width: config.mainWindow.width,
      height: config.mainWindow.height,
      title: config.name,
    }, options);
    Chronomancer.stop('main-window', 'bootstrap');

    return win;
  }

  /**
   * Initializes services that require a window reference.
   */
  private initializeWindowServices(win: BrowserWindow, options: { isDevMode: boolean }): void {
    Chronomancer.start('window-services', 'bootstrap');

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

    Chronomancer.stop('window-services', 'bootstrap');
  }

  /**
   * Runs startup background tasks (backup, updates).
   */
  private async runStartupTasks(): Promise<void> {
    // Auto backup
    try {
      Chronomancer.start('auto-backup', 'bootstrap');
      const backupService = Injector.inject(BackupService);
      await backupService.autoBackup();
      Chronomancer.stop('auto-backup', 'bootstrap');
      Logger.info('[Bootstrap] ✓ Startup backup completed');
    } catch (error) {
      Chronomancer.stop('auto-backup', 'bootstrap');
      Logger.error('[Bootstrap] Startup backup failed:', error);
    }

    // Check for updates (non-blocking)
    Chronomancer.start('update-check', 'bootstrap');
    const updaterService = Injector.inject(UpdaterService);
    updaterService.checkForUpdates().catch((err: unknown) => {
      Logger.error('[Bootstrap] Startup update check failed:', err);
    });
    Chronomancer.stop('update-check', 'bootstrap');
    Logger.info('[Bootstrap] ✓ Startup update check initiated');
  }
}
