import { BrowserWindow, app } from 'electron';
import * as path from 'path';
import * as http from 'http';
import { Injectable } from '../helpers/mini-pie/decorators';
import { Injector } from '../helpers/mini-pie/injector';
import { Logger } from '../helpers/logger';
import { ElectronWindowService } from './electron-window.service';
import { ElectronSplashWindowService } from './electron-splash-window.service';

export interface MainWindowConfig {
  width?: number;
  height?: number;
  title?: string;
  icon?: string;
  /** Dev server URL */
  devServerUrl?: string;
  /** Production app URL (protocol) */
  prodAppUrl?: string;
  /** Max attempts to wait for dev server */
  devServerMaxAttempts?: number;
}

const DEFAULT_MAIN_WINDOW_CONFIG: Required<MainWindowConfig> = {
  width: 1200,
  height: 800,
  title: 'App',
  // Path relative to dist-electron/src/services/ -> goes to src/assets/
  icon: '../../../../src/assets/icon.png',
  devServerUrl: 'http://localhost:4202',
  prodAppUrl: 'app://./',
  devServerMaxAttempts: 30,
};

const MAIN_WINDOW_ID = 'main';

/**
 * Service that manages the main application window.
 * Handles window creation, navigation blocking for Angular SPA,
 * dev server waiting, and splash screen coordination.
 */
@Injectable()
export class ElectronMainWindowService {
  private win: BrowserWindow | null = null;
  private isDevMode = false;
  private loadedUrl: string | null = null;
  private indexFilePath: string | null = null;

  private get windowService(): ElectronWindowService {
    return Injector.inject(ElectronWindowService);
  }

  private get splashService(): ElectronSplashWindowService {
    return Injector.inject(ElectronSplashWindowService);
  }

  /**
   * Creates and initializes the main application window.
   * Coordinates with splash screen for smooth transition.
   */
  async create(config: MainWindowConfig = {}, options: { isDevMode: boolean }): Promise<BrowserWindow> {
    this.isDevMode = options.isDevMode;
    const mergedConfig = { ...DEFAULT_MAIN_WINDOW_CONFIG, ...config };

    this.win = this.windowService.createWindow({
      id: MAIN_WINDOW_ID,
      width: mergedConfig.width,
      height: mergedConfig.height,
      title: mergedConfig.title,
      icon: path.join(__dirname, mergedConfig.icon),
      show: false, // Don't show immediately, wait for splash transition
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        // preload.js is at dist-electron/preload.js, service is at dist-electron/src/services/
        preload: path.join(__dirname, '../../preload.js'),
      },
    });

    this.setupNavigationBlocking();
    this.setupReadyToShowHandler();

    await this.loadContent(mergedConfig);

    Logger.info('[MainWindow] Main window created');
    return this.win;
  }

  /**
   * Gets the current main window instance.
   */
  getWindow(): BrowserWindow | null {
    return this.win;
  }

  /**
   * Checks if the main window is valid.
   */
  isValid(): boolean {
    return this.windowService.isWindowValid(this.win);
  }

  /**
   * Gets information needed for reload functionality.
   */
  getReloadInfo(): { serve: boolean; loadedUrl?: string; indexFilePath?: string } {
    return {
      serve: this.isDevMode,
      loadedUrl: this.loadedUrl ?? undefined,
      indexFilePath: this.indexFilePath ?? undefined,
    };
  }

  /**
   * Reloads the main window content.
   */
  async reload(): Promise<void> {
    if (!this.windowService.isWindowValid(this.win)) {
      Logger.warn('[MainWindow] Cannot reload - window is not valid');
      return;
    }

    if (this.isDevMode && this.loadedUrl) {
      await this.win.loadURL(this.loadedUrl);
    } else if (this.indexFilePath) {
      await this.win.loadURL(this.indexFilePath);
    }

    Logger.info('[MainWindow] Window reloaded');
  }

  /**
   * Shows the main window and focuses it.
   */
  show(): void {
    if (this.windowService.isWindowValid(this.win)) {
      this.win.show();
      this.win.focus();
    }
  }

  /**
   * Opens DevTools (useful for debugging).
   */
  openDevTools(): void {
    if (this.windowService.isWindowValid(this.win)) {
      this.win.webContents.openDevTools();
    }
  }

  /**
   * Sets up navigation blocking for Angular SPA routing.
   * Angular manages routing internally, Electron should not follow URL changes.
   */
  private setupNavigationBlocking(): void {
    if (!this.win) return;

    let initialLoadComplete = false;

    this.win.webContents.on('did-finish-load', () => {
      initialLoadComplete = true;
    });

    this.win.webContents.on('will-navigate', (event, url) => {
      // After initial load, block all navigations
      // Angular changes the URL but shouldn't trigger Electron navigation
      if (initialLoadComplete) {
        event.preventDefault();
      }
    });

    Logger.debug('[MainWindow] Navigation blocking configured');
  }

  /**
   * Sets up the ready-to-show handler for splash transition.
   */
  private setupReadyToShowHandler(): void {
    if (!this.win) return;

    this.win.once('ready-to-show', async () => {
      Logger.info('[MainWindow] Window ready to show');

      // Close splash and show main window with a small delay for smooth transition
      await this.splashService.close(300);

      this.show();
      Logger.info('[MainWindow] Main window shown');
    });
  }

  /**
   * Loads the appropriate content based on dev/prod mode.
   */
  private async loadContent(config: Required<MainWindowConfig>): Promise<void> {
    if (!this.win) return;

    if (this.isDevMode) {
      await this.waitForDevServer(config.devServerUrl, config.devServerMaxAttempts);
      this.loadedUrl = config.devServerUrl;
      await this.win.loadURL(this.loadedUrl);
      this.openDevTools();
      Logger.info(`[MainWindow] Loaded dev server: ${this.loadedUrl}`);
    } else {
      this.indexFilePath = config.prodAppUrl;
      Logger.info(`[MainWindow] Loading production URL: ${this.indexFilePath}`);
      await this.win.loadURL(this.indexFilePath);
      Logger.info('[MainWindow] App loaded successfully');
    }
  }

  /**
   * Waits for the Angular dev server to be ready.
   */
  private async waitForDevServer(url: string, maxAttempts: number): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await new Promise<void>((resolve, reject) => {
          http.get(url, (res) => {
            if (res.statusCode === 200) {
              resolve();
            } else {
              reject(new Error(`Status: ${res.statusCode}`));
            }
          }).on('error', reject);
        });
        Logger.info('[MainWindow] Dev server is ready!');
        return;
      } catch (error) {
        Logger.info(`[MainWindow] Waiting for dev server... (attempt ${i + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error('[MainWindow] Dev server did not start in time');
  }
}
