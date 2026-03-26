/**
 * Chronomancer Service for Angular
 * 
 * Configures Chronomancer for browser environment and provides
 * an injectable Angular service wrapper.
 */

import { Injectable, isDevMode } from '@angular/core';
import { Chronomancer, type ChronoLogger, type TimeProvider, type ChronoReport, type MeasurementStats } from '../../../../shared/chronomancer';

// Browser time provider using Performance API
const browserTimeProvider: TimeProvider = {
  now: () => Date.now(),
  highResolution: () => performance.now(),
};

// Browser logger using console with styled output
const browserLogger: ChronoLogger = {
  debug: (msg: string, ...args: unknown[]) => console.debug(`%c⏱ Chronomancer%c ${msg}`, 'color: #888; font-weight: bold', 'color: inherit', ...args),
  info: (msg: string, ...args: unknown[]) => console.info(`%c⏱ Chronomancer%c ${msg}`, 'color: #2196F3; font-weight: bold', 'color: inherit', ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(`%c⏱ Chronomancer%c ${msg}`, 'color: #FF9800; font-weight: bold', 'color: inherit', ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`%c⏱ Chronomancer%c ${msg}`, 'color: #F44336; font-weight: bold', 'color: inherit', ...args),
};

/**
 * Initialize Chronomancer for browser environment
 * This is called automatically when ChronoService is first injected
 */
function initChronomancerForBrowser(): void {
  Chronomancer.setTimeProvider(browserTimeProvider);
  Chronomancer.setLogger(browserLogger);
  
  Chronomancer.configure({
    enabled: true,
    autoLog: isDevMode(),
    logThresholdMs: 100,
    defaultScope: 'angular',
  });
}

/**
 * Angular service wrapper for Chronomancer
 * 
 * Provides the same API as the static Chronomancer class but as an injectable service.
 * Use this for better Angular integration and testability.
 * 
 * @example
 * ```ts
 * @Component({...})
 * export class MyComponent {
 *   private chrono = inject(ChronoService);
 * 
 *   async loadData() {
 *     this.chrono.start('load-data');
 *     // ... fetch data
 *     const duration = this.chrono.stop('load-data');
 *     console.log(`Loaded in ${duration}ms`);
 *   }
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class ChronoService {
  private static initialized = false;

  constructor() {
    if (!ChronoService.initialized) {
      initChronomancerForBrowser();
      ChronoService.initialized = true;
      
      if (isDevMode()) {
        console.info('%c⏱ Chronomancer%c Initialized for Angular', 'color: #2196F3; font-weight: bold', 'color: inherit');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEASUREMENT API (delegates to static Chronomancer)
  // ═══════════════════════════════════════════════════════════════════════════

  start(id: string, scope?: string, metadata?: Record<string, unknown>): string {
    return Chronomancer.start(id, scope, metadata);
  }

  stop(id: string, scope?: string): number {
    return Chronomancer.stop(id, scope);
  }

  checkpoint(id: string, checkpointName: string, scope?: string) {
    return Chronomancer.checkpoint(id, checkpointName, scope);
  }

  measure<T>(id: string, fn: () => T, scope?: string): T {
    return Chronomancer.measure(id, fn, scope);
  }

  measureAsync<T>(id: string, fn: () => Promise<T>, scope?: string): Promise<T> {
    return Chronomancer.measureAsync(id, fn, scope);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATISTICS API
  // ═══════════════════════════════════════════════════════════════════════════

  getStats(id: string, scope?: string): MeasurementStats | undefined {
    return Chronomancer.getStats(id, scope);
  }

  generateReport(): ChronoReport {
    return Chronomancer.generateReport();
  }

  formatReport(): string {
    return Chronomancer.formatReport();
  }

  printReport(): void {
    Chronomancer.printReport();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  setEnabled(enabled: boolean): void {
    Chronomancer.setEnabled(enabled);
  }

  isEnabled(): boolean {
    return Chronomancer.isEnabled();
  }

  clearHistory(): void {
    Chronomancer.clearHistory();
  }

  reset(): void {
    Chronomancer.reset();
  }
}

// Also export static Chronomancer for direct usage (e.g., in decorators)
export { Chronomancer } from '../../../../shared/chronomancer';
export type * from '../../../../shared/chronomancer';
