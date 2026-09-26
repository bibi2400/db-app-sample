import { BrowserWindow } from 'electron';
import { Injectable } from '../../helpers/mini-pie/decorators';
import { Logger } from '../../helpers/logger';
import { DataSourceService } from './data-source.service';
import { AppController, registerAllControllers } from '../../controllers';
import { AppConfigService } from './app-config.service';
import { ElectronSplashWindowService } from './electron-splash-window.service';
import { ElectronMainWindowService } from './electron-main-window.service';
import { PushService } from './push.service';
import { LifecycleService } from './lifecycle.service';
import { ControllerService } from './controller.service';
import { BackupService } from './backup.service';
import { UpdaterService } from './updater.service';
import { DevModeService } from './dev-mode.service';
import { ErrorNotificationService } from './error-notification.service';
import { ContextMenuService } from './context-menu.service';
import { DbMigrationService } from './db-migration.service';
import { initChronomancerForElectron, Chronomancer } from '../../helpers/chronomancer.adapter';
import type { BootstrapHooks } from '../../bootstrap';

/**
 * Service that orchestrates the application bootstrap process.
 * Handles initialization of database, controllers, services, and windows.
 */
@Injectable()
export class AppBootstrapService {
  private win: BrowserWindow | null = null;
  private hooks: BootstrapHooks = {};

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly splashService: ElectronSplashWindowService,
    private readonly mainWindowService: ElectronMainWindowService,
    private readonly pushService: PushService,
    private readonly lifecycleService: LifecycleService,
    private readonly controllerService: ControllerService,
    private readonly backupService: BackupService,
    private readonly updaterService: UpdaterService,
    private readonly devModeService: DevModeService,
    private readonly errorNotificationService: ErrorNotificationService,
    private readonly contextMenuService: ContextMenuService,
    private readonly dataSourceService: DataSourceService,
    private readonly dbMigrationService: DbMigrationService,
  ) {}

  /**
   * Runs the full application bootstrap sequence.
   * @returns The main window instance
   */
  async bootstrap(): Promise<BrowserWindow> {
    // Initialize Chronomancer first
    initChronomancerForElectron({
      enabled: true,
      autoLog: this.devModeService.isDev,
      logThresholdMs: 50,
    });

    // Start measuring total bootstrap time
    Chronomancer.start('app-bootstrap', 'bootstrap');

    Logger.info('=== STARTING APPLICATION BOOTSTRAP ===');

    // Initialize config first
    this.appConfigService.init();

    // Initialize core services (database, controllers)
    Chronomancer.checkpoint('app-bootstrap', 'before-core-init', 'bootstrap');
    await this.initializeCore();
    Chronomancer.checkpoint('app-bootstrap', 'after-core-init', 'bootstrap');

    // Create windows
    this.win = await this.createWindows();
    Chronomancer.checkpoint('app-bootstrap', 'after-windows-created', 'bootstrap');

    // Initialize context menu (after controllers, so it can reference them)
    await this.contextMenuService.init();

    // Initialize window-dependent services
    this.initializeWindowServices(this.win);

    // Set version in window title and listen for updates
    this.initializeTitleUpdater();

    // Start update checks after window-dependent services are ready
    this.startUpdateChecks();

    // Stop bootstrap measurement and print report
    const bootstrapDuration = Chronomancer.stop('app-bootstrap', 'bootstrap');
    Logger.info(`[Bootstrap] Total bootstrap time: ${bootstrapDuration.toFixed(2)}ms`);

    if (this.devModeService.isDev) {
      Chronomancer.printReport();
    }

    Logger.info('=== APPLICATION BOOTSTRAP COMPLETED ===');
    return this.win;
  }

  /**
   * Sets lifecycle hooks from the consumer.
   */
  setHooks(hooks: BootstrapHooks): void {
    this.hooks = hooks;
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
      await this.dataSourceService.initialize();
      Chronomancer.stop('database-init', 'bootstrap');
      Logger.info('[Bootstrap] ✓ Database connection established');

      // Ensure a fresh database can be backed up before frontend migrations run.
      await this.dbMigrationService.initializeSchema();

      // Verify schema drift (throws in dev if drift is found)
      await this.dbMigrationService.verifySchema();

      // Hook: afterDbInit
      if (this.hooks.afterDbInit) {
        await this.hooks.afterDbInit();
        Logger.info('[Bootstrap] ✓ afterDbInit hook completed');
      }

      Chronomancer.start('controllers-register', 'bootstrap');
      registerAllControllers();
      Chronomancer.stop('controllers-register', 'bootstrap');
      Logger.info('[Bootstrap] ✓ Controllers registered');

      // Hook: afterControllersRegistered
      if (this.hooks.afterControllersRegistered) {
        await this.hooks.afterControllersRegistered();
        Logger.info('[Bootstrap] ✓ afterControllersRegistered hook completed');
      }
    } catch (error) {
      Logger.error('[Bootstrap] ✗ Core initialization failed:', error);
      if (error instanceof Error) {
        Logger.error('[Bootstrap] Error stack:', error.stack);
      }
      this.errorNotificationService.reportBootstrapError('Inizializzazione core', error);
      throw error;
    }
  }

  /**
   * Creates splash and main windows with coordinated transition.
   */
  private async createWindows(): Promise<BrowserWindow> {
    const config = this.appConfigService.getInfo();

    if (!this.devModeService.noSplash) {
      // Create splash screen
      Chronomancer.start('splash-window', 'bootstrap');
      await this.splashService.create({
        width: config.splashScreen.width,
        height: config.splashScreen.height,
      });
      Chronomancer.stop('splash-window', 'bootstrap');
      this.splashService.setVersion(config.version);

      // Small delay to ensure splash is visible
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Finish backup maintenance before loading any consumer frontend IPC requests.
    await this.runStartupBackup();

    // Create main window (splash will close automatically on ready-to-show)
    Chronomancer.start('main-window', 'bootstrap');
    const win = await this.mainWindowService.create({
      width: config.mainWindow.width,
      height: config.mainWindow.height,
      title: config.name,
    });
    Chronomancer.stop('main-window', 'bootstrap');

    return win;
  }

  /**
   * Initializes services that require a window reference.
   */
  private initializeWindowServices(win: BrowserWindow): void {
    Chronomancer.start('window-services', 'bootstrap');

    // PushService needs window for IPC
    this.pushService.setWindow(win);
    Logger.info('[Bootstrap] ✓ PushService initialized');

    // LifecycleService handles graceful shutdown
    this.lifecycleService.init(win);
    Logger.info('[Bootstrap] ✓ LifecycleService initialized');

    // AppController needs window for reload functionality
    const appController = this.controllerService.getController<AppController>('AppController');
    if (appController) {
      const reloadInfo = this.mainWindowService.getReloadInfo();
      appController.setWindow(win, reloadInfo);
      Logger.info('[Bootstrap] ✓ AppController initialized');
    }

    Chronomancer.stop('window-services', 'bootstrap');
  }

  /**
   * Sets the window title with version and listens for update availability.
   */
  private initializeTitleUpdater(): void {
    const config = this.appConfigService.getInfo();
    const baseTitle = `${config.name} v${config.version}`;
    this.mainWindowService.setTitle(baseTitle);

    this.updaterService.onStatusChange((status) => {
      if (status.status === 'available' || status.status === 'downloading' || status.status === 'downloaded') {
        this.mainWindowService.setTitle(`${baseTitle} — Aggiornamento Disponibile!`);
      } else {
        this.mainWindowService.setTitle(baseTitle);
      }
    });
  }

  /**
   * Completes the automatic backup before the main window loads.
   */
  private async runStartupBackup(): Promise<void> {
    // Auto backup
    try {
      Chronomancer.start('auto-backup', 'bootstrap');
      await this.backupService.autoBackup();
      Chronomancer.stop('auto-backup', 'bootstrap');
      Logger.info('[Bootstrap] ✓ Startup backup completed');
    } catch (error) {
      Chronomancer.stop('auto-backup', 'bootstrap');
      Logger.error('[Bootstrap] Startup backup failed:', error);
      this.errorNotificationService.reportBootstrapError('Backup automatico', error);
    }
  }

  /**
   * Starts update checks after window-dependent services are initialized.
   */
  private startUpdateChecks(): void {
    // Check for updates (non-blocking) and start periodic check every 30 min
    Chronomancer.start('update-check', 'bootstrap');
    this.updaterService.checkForUpdates().catch((err: unknown) => {
      Logger.error('[Bootstrap] Startup update check failed:', err);
      this.errorNotificationService.reportBootstrapError('Controllo aggiornamenti', err);
    });
    this.updaterService.startPeriodicCheck();
    this.lifecycleService.onCleanup(() => this.updaterService.stopPeriodicCheck());
    Chronomancer.stop('update-check', 'bootstrap');
    Logger.info('[Bootstrap] ✓ Startup update check initiated (periodic every 30 min)');
  }
}
