import { app, BrowserWindow, MenuItem } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import "reflect-metadata";
import { RuntimeConfig, RuntimeConfigHolder } from './config/runtime-config';
import { FRAMEWORK_ENTITIES } from './entities';
import { Logger } from './helpers/logger';
import { Injector } from './helpers/mini-pie/injector';
import { Constructor } from './helpers/mini-pie/types';
import { SERVICES } from './services';
import { AppBootstrapService } from './services/system-services/app-bootstrap.service';
import { DataSourceService } from './services/system-services/data-source.service';

/**
 * Hooks that the consumer can provide to customize the bootstrap flow.
 */
export interface BootstrapHooks {
  /** Called after the database is initialized, before controllers are registered */
  afterDbInit?: () => Promise<void>;
  /** Called after all controllers (framework + app) are registered */
  afterControllersRegistered?: () => Promise<void>;
  /** Called after the full bootstrap is complete, receives the main BrowserWindow */
  afterBootstrap?: (win: BrowserWindow) => Promise<void>;
}

/**
 * Configuration for custom context menu items.
 */
export interface ContextMenuConfig {
  /** Extra menu items to append to the framework's default context menu */
  extraItems?: (params: Electron.ContextMenuParams, win: BrowserWindow) => MenuItem[];
}

/**
 * Configuration object for AppBootstrap.
 */
export interface BootstrapConfig {
  /** TypeORM entities from the consumer app */
  entities?: Constructor[];
  /** Custom Electron services from the consumer app (loaded after framework services) */
  services?: Constructor[];
  /** Custom controller classes from the consumer app.
   *  NOTE: Controllers must be imported (side-effect) before calling start()
   *  so their @Controller decorators fire. Pass the classes here for documentation.
   */
  controllers?: Constructor[];
  /** Lifecycle hooks */
  hooks?: BootstrapHooks;
  /** Context menu customization */
  contextMenu?: ContextMenuConfig;
  /** Runtime config (GH_TOKEN for auto-update). Injected at build time by `eaf inject-token`. */
  runtimeConfig?: RuntimeConfig;
}

/**
 * Main entry point for bootstrapping an Electron + Angular + SQLite application.
 *
 * Usage in consumer's electron/main.ts:
 * ```typescript
 * import { AppBootstrap } from '@bibi2400/electron-angular-framework/electron';
 * import { APP_SERVICES } from './src/services';
 * import { MODELS } from './src/db/entities';
 * import './src/controllers'; // side-effect imports to register @Controller decorators
 *
 * const bootstrap = new AppBootstrap({
 *   entities: MODELS,
 *   services: APP_SERVICES,
 *   hooks: {
 *     afterBootstrap: async (win) => {
 *       // custom logic
 *     }
 *   }
 * });
 *
 * bootstrap.start();
 * ```
 */
export class AppBootstrap {
  private config: BootstrapConfig;

  constructor(config: BootstrapConfig = {}) {
    this.config = config;
  }

  /**
   * Starts the full application bootstrap sequence.
   * This is the single method the consumer needs to call.
   */
  async start(): Promise<void> {
    // Apply runtime config (GH_TOKEN for auto-update)
    if (this.config.runtimeConfig) {
      RuntimeConfigHolder.set(this.config.runtimeConfig);
    }

    const { default: serve } = await import('electron-serve');
    const pkg = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf-8'));
    serve({ directory: `dist/${pkg.name}/browser` });

    await app.whenReady();

    try {
      // 1. Combine framework + consumer services and load them
      const allServices = [
        ...SERVICES,
        ...(this.config.services ?? []),
      ];
      await Injector.load(allServices);

      // 2. Configure entities on DataSourceService before bootstrap
      //    Always merges framework built-in entities (e.g. Attachment) with consumer entities.
      const allEntities = [
        ...FRAMEWORK_ENTITIES,
        ...(this.config.entities ?? []),
      ];
      const dataSourceService = Injector.inject(DataSourceService);
      dataSourceService.setEntities(allEntities);

      // 3. Run the framework bootstrap sequence
      const bootstrapService = Injector.inject(AppBootstrapService);

      // Inject hooks into bootstrap service
      bootstrapService.setHooks(this.config.hooks ?? {});

      await bootstrapService.bootstrap();

      // 4. After-bootstrap hook
      if (this.config.hooks?.afterBootstrap) {
        const win = bootstrapService.getMainWindow();
        if (win) {
          await this.config.hooks.afterBootstrap(win);
        }
      }

      Logger.info('✓ Application started successfully');
    } catch (error) {
      Logger.error('✗ Application failed to start:', error);
      app.quit();
    }
  }
}
