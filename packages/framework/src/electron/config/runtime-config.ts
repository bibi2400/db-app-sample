/**
 * Runtime configuration interface.
 * The consumer provides this via BootstrapConfig.runtimeConfig.
 */
export interface RuntimeConfig {
  GH_TOKEN: string;
}

/**
 * Static holder for runtime config.
 * Set once during bootstrap, read by framework services (e.g. UpdaterService).
 */
export class RuntimeConfigHolder {
  private static config: RuntimeConfig = { GH_TOKEN: '' };

  static set(config: RuntimeConfig): void {
    RuntimeConfigHolder.config = config;
  }

  static get(): RuntimeConfig {
    return RuntimeConfigHolder.config;
  }
}
