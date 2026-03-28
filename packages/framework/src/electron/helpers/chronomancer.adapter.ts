/**
 * Chronomancer Adapter for Electron (Node.js)
 *
 * Configures Chronomancer with:
 * - High-resolution timing using process.hrtime.bigint()
 * - Integration with the existing Logger
 */

import { Chronomancer, type ChronoLogger, type TimeProvider } from '../../shared/chronomancer';
import { Logger } from './logger';

const nodeTimeProvider: TimeProvider = {
  now: () => Date.now(),
  highResolution: () => {
    return Number(process.hrtime.bigint()) / 1_000_000;
  },
};

const loggerAdapter: ChronoLogger = {
  debug: (msg: string, ...args: unknown[]) => { Logger.addTag('Chronomancer').debug(msg, ...args); Logger.removeTag('Chronomancer'); },
  info: (msg: string, ...args: unknown[]) => { Logger.addTag('Chronomancer').info(msg, ...args); Logger.removeTag('Chronomancer'); },
  warn: (msg: string, ...args: unknown[]) => { Logger.addTag('Chronomancer').warn(msg, ...args); Logger.removeTag('Chronomancer'); },
  error: (msg: string, ...args: unknown[]) => { Logger.addTag('Chronomancer').error(msg, ...args); Logger.removeTag('Chronomancer'); },
};

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

export { Chronomancer } from '../../shared/chronomancer';
export type * from '../../shared/chronomancer';
