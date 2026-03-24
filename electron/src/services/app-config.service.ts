import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Injectable } from '../helpers/mini-pie/decorators';
import { Logger } from '../helpers/logger';

export interface AppWindowConfig {
  width: number;
  height: number;
}

export interface AppConfiguration {
  name: string;
  slug: string;
  version: string;
  mainWindow: AppWindowConfig;
  splashScreen: AppWindowConfig;
}

const DEFAULT_CONFIG: Omit<AppConfiguration, 'name' | 'slug' | 'version'> = {
  mainWindow: {
    width: 1200,
    height: 800,
  },
  splashScreen: {
    width: 600,
    height: 400,
  },
};

/**
 * Service that provides application configuration.
 * Reads from package.json and provides typed access to app settings.
 */
@Injectable()
export class AppConfigService {
  private config: AppConfiguration | null = null;
  private isDevMode = false;

  /**
   * Initializes the config service by reading package.json.
   * Must be called early in the app lifecycle.
   */
  init(options: { isDevMode: boolean }): void {
    this.isDevMode = options.isDevMode;
    this.loadConfig();
  }

  /**
   * Gets the full application configuration.
   */
  getConfig(): AppConfiguration {
    if (!this.config) {
      this.loadConfig();
    }
    return this.config!;
  }

  /**
   * Gets the application name (display name).
   */
  get name(): string {
    return this.getConfig().name;
  }

  /**
   * Gets the application slug (package name).
   */
  get slug(): string {
    return this.getConfig().slug;
  }

  /**
   * Gets the application version.
   */
  get version(): string {
    return this.getConfig().version;
  }

  /**
   * Gets the main window configuration.
   */
  get mainWindow(): AppWindowConfig {
    return this.getConfig().mainWindow;
  }

  /**
   * Gets the splash screen configuration.
   */
  get splashScreen(): AppWindowConfig {
    return this.getConfig().splashScreen;
  }

  /**
   * Checks if the app is running in dev mode.
   */
  get isDev(): boolean {
    return this.isDevMode;
  }

  /**
   * Gets the app's base path.
   */
  getAppPath(): string {
    return app.getAppPath();
  }

  /**
   * Gets the path to the built Angular app.
   */
  getDistPath(): string {
    return path.join(this.getAppPath(), 'dist', this.slug, 'browser');
  }

  private loadConfig(): void {
    try {
      const packageJsonPath = path.join(app.getAppPath(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      this.config = {
        name: pkg.build?.productName || pkg.name,
        slug: pkg.name,
        version: pkg.version || '0.0.0',
        ...DEFAULT_CONFIG,
      };

      Logger.debug('[AppConfig] Configuration loaded:', this.config.name, 'v' + this.config.version);
    } catch (error) {
      Logger.error('[AppConfig] Failed to load configuration:', error);
      throw error;
    }
  }
}
