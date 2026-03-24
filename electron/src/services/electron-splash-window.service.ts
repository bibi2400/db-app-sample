import { BrowserWindow } from 'electron';
import * as path from 'path';
import { Injectable } from '../helpers/mini-pie/decorators';
import { Injector } from '../helpers/mini-pie/injector';
import { Logger } from '../helpers/logger';
import { ElectronWindowService } from './electron-window.service';

export interface SplashConfig {
  width?: number;
  height?: number;
  /** Path to splash HTML file in dev mode (relative to main.ts) */
  devPath?: string;
  /** Path to splash HTML file in prod mode (relative to resourcesPath) */
  prodPath?: string;
}

const DEFAULT_SPLASH_CONFIG: Required<SplashConfig> = {
  width: 600,
  height: 400,
  // Path relative to dist-electron/electron/src/services/ -> goes to src/assets/
  devPath: '../../../../../src/assets/splash.html',
  prodPath: 'splash.html',
};

const SPLASH_WINDOW_ID = 'splash';

/**
 * Service that manages the application splash screen.
 * Handles splash creation, display, and graceful closing.
 */
@Injectable()
export class ElectronSplashWindowService {
  private splash: BrowserWindow | null = null;
  private isDevMode = false;

  private get windowService(): ElectronWindowService {
    return Injector.inject(ElectronWindowService);
  }

  /**
   * Creates and displays the splash screen.
   * @param config Splash screen configuration
   * @param options Additional options
   */
  async create(config: SplashConfig = {}, options: { isDevMode: boolean }): Promise<BrowserWindow> {
    this.isDevMode = options.isDevMode;
    const mergedConfig = { ...DEFAULT_SPLASH_CONFIG, ...config };

    this.splash = this.windowService.createWindow({
      id: SPLASH_WINDOW_ID,
      width: mergedConfig.width,
      height: mergedConfig.height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const splashPath = this.isDevMode
      ? path.join(__dirname, mergedConfig.devPath)
      : path.join(this.windowService.getResourcesPath(), mergedConfig.prodPath);

    try {
      await this.splash.loadFile(splashPath);
      Logger.info('[SplashWindow] Splash screen loaded');
    } catch (err) {
      Logger.error('[SplashWindow] Failed to load splash:', err);
    }

    return this.splash;
  }

  /**
   * Gets the current splash window instance.
   */
  getWindow(): BrowserWindow | null {
    return this.splash;
  }

  /**
   * Checks if the splash window is valid and visible.
   */
  isVisible(): boolean {
    return this.windowService.isWindowValid(this.splash);
  }

  /**
   * Closes the splash screen gracefully.
   * @param delay Optional delay before closing (ms)
   */
  async close(delay = 0): Promise<void> {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (this.windowService.isWindowValid(this.splash)) {
      this.splash.close();
      Logger.info('[SplashWindow] Splash screen closed');
    }

    this.splash = null;
  }

  /**
   * Hides the splash screen without closing it.
   */
  hide(): void {
    if (this.windowService.isWindowValid(this.splash)) {
      this.splash.hide();
    }
  }

  /**
   * Shows the splash screen if it was hidden.
   */
  show(): void {
    if (this.windowService.isWindowValid(this.splash)) {
      this.splash.show();
    }
  }
}
