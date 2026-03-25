/**
 * Chronomancer Adapter for Electron (Node.js)
 *
 * Configures Chronomancer with:
 * - High-resolution timing using process.hrtime.bigint()
 * - Integration with the existing Logger
 */

import { Chronomancer, type ChronoLogger, type TimeProvider } from '../../../shared/chronomancer';
import { Logger } from './logger';

// High-resolution time provider using Node.js process.hrtime
const nodeTimeProvider: TimeProvider = {
  now: () => Date.now(),
  highResolution: () => {
    // process.hrtime.bigint() returns nanoseconds, we convert to milliseconds
    return Number(process.hrtime.bigint()) / 1_000_000;
  },
};

// Logger adapter that integrates with the existing Logger class
const loggerAdapter: ChronoLogger = {
  debug: (msg: string, ...args: unknown[]) => { Logger.addTag('Chronomancer').debug(msg, ...args); Logger.removeTag('Chronomancer'); },
  info: (msg: string, ...args: unknown[]) => { Logger.addTag('Chronomancer').info(msg, ...args); Logger.removeTag('Chronomancer'); },
  warn: (msg: string, ...args: unknown[]) => { Logger.addTag('Chronomancer').warn(msg, ...args); Logger.removeTag('Chronomancer'); },
  error: (msg: string, ...args: unknown[]) => { Logger.addTag('Chronomancer').error(msg, ...args); Logger.removeTag('Chronomancer'); },
};

/**
 * Initialize Chronomancer for Electron environment
 * Call this once at application startup
 */
export function initChronomancerForElectron(options?: {
  enabled?: boolean;
  autoLog?: boolean;
  logThresholdMs?: number;
}): void {
  Chronomancer.setTimeProvider(nodeTimeProvider);
  Chronomancer.setLogger(loggerAdapter);

  Chronomancer.configure({
    enabled: options?.enabled ?? true,
    autoLog: options?.autoLog ?? process.env['NODE_ENV'] === 'development',
    logThresholdMs: options?.logThresholdMs ?? 50,
    defaultScope: 'electron',
  });

  Logger.addTag('Chronomancer').info('Initialized for Electron environment with high-resolution timing');
  Logger.removeTag('Chronomancer');
}

// Re-export Chronomancer for convenience
export { Chronomancer } from '../../../shared/chronomancer';
export type * from '../../../shared/chronomancer';
