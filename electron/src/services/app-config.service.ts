import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Injectable } from "../helpers/mini-pie/decorators";
import { Logger } from '../helpers/logger';
import { ConfigService } from "./config.service";
import { DevModeService } from "./dev-mode.service";

export interface AppWindowConfig {
  width: number;
  height: number;
}

export interface AppInfo {
  name: string;
  slug: string;
  version: string;
  mainWindow: AppWindowConfig;
  splashScreen: AppWindowConfig;
}

export interface AppSettings {
  // Configurazioni inter-sessione dell'applicazione
}

const APP_CONFIG_FILE = 'app-config.json';

const APP_SETTINGS_DEFAULTS: AppSettings = {
};

const DEFAULT_APP_INFO: Omit<AppInfo, 'name' | 'slug' | 'version'> = {
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
 * Gestisce le informazioni dell'applicazione (da package.json)
 * e le configurazioni inter-sessione persistenti (app-config.json).
 */
@Injectable()
export class AppConfigService {

  private appInfo: AppInfo | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly devModeService: DevModeService,
  ) {
    this.configService.register<AppSettings>(APP_CONFIG_FILE, APP_SETTINGS_DEFAULTS);
  }

  // ── App Info (da package.json) ──────────────────────────────

  init(): void {
    this.loadAppInfo();
  }

  getInfo(): AppInfo {
    if (!this.appInfo) {
      this.loadAppInfo();
    }
    return this.appInfo!;
  }

  get name(): string {
    return this.getInfo().name;
  }

  get slug(): string {
    return this.getInfo().slug;
  }

  get version(): string {
    return this.getInfo().version;
  }

  get mainWindow(): AppWindowConfig {
    return this.getInfo().mainWindow;
  }

  get splashScreen(): AppWindowConfig {
    return this.getInfo().splashScreen;
  }

  get isDev(): boolean {
    return this.devModeService.isDev;
  }

  getAppPath(): string {
    return app.getAppPath();
  }

  getDistPath(): string {
    return path.join(this.getAppPath(), 'dist', this.slug, 'browser');
  }

  // ── Settings persistenti (app-config.json) ─────────────────

  get settings(): AppSettings {
    return this.configService.read<AppSettings>(APP_CONFIG_FILE);
  }

  set settings(value: AppSettings) {
    this.configService.write<AppSettings>(APP_CONFIG_FILE, value);
  }

  updateSettings(partial: Partial<AppSettings>): void {
    this.configService.update<AppSettings>(APP_CONFIG_FILE, partial);
  }

  get settingsPath(): string {
    return this.configService.getFilePath(APP_CONFIG_FILE);
  }

  // ── Private ─────────────────────────────────────────────────

  private loadAppInfo(): void {
    try {
      const packageJsonPath = path.join(app.getAppPath(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      this.appInfo = {
        name: pkg.build?.productName || pkg.name,
        slug: pkg.name,
        version: pkg.version || '0.0.0',
        ...DEFAULT_APP_INFO,
      };

      Logger.debug('[AppConfig] Configuration loaded:', this.appInfo.name, 'v' + this.appInfo.version);
    } catch (error) {
      Logger.error('[AppConfig] Failed to load configuration:', error);
      throw error;
    }
  }
}
