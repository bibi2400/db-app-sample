/**
 * Chronomancer - Advanced Time Measurement Utility
 *
 * A static class for detailed execution time measurement of functions and code blocks.
 * Platform-agnostic core that works with both Node.js and Browser environments.
 */

import type {
  TimeMeasurement,
  Checkpoint,
  MeasurementStats,
  ChronoReport,
  ScopeReport,
  ChronoConfig,
  ChronoLogger,
  TimeProvider,
  MeasureableFunction,
  AsyncMeasureableFunction,
} from './chronomancer.types';

// Default console-based logger
const defaultLogger: ChronoLogger = {
  debug: (msg, ...args) => console.debug(`[Chronomancer] ${msg}`, ...args),
  info: (msg, ...args) => console.info(`[Chronomancer] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[Chronomancer] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[Chronomancer] ${msg}`, ...args),
};

// Default time provider (performance.now is available in both environments)
const defaultTimeProvider: TimeProvider = {
  now: () => Date.now(),
  highResolution: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
};

const defaultConfig: ChronoConfig = {
  enabled: true,
  maxHistoryPerMeasurement: 1000,
  defaultScope: 'default',
  autoLog: false,
  logThresholdMs: 100,
};

export class Chronomancer {
  // Storage for active measurements
  private static activeMeasurements: Map<string, TimeMeasurement> = new Map();

  // History of completed measurements for statistics
  private static history: Map<string, number[]> = new Map();

  // Scope grouping
  private static scopes: Map<string, Set<string>> = new Map();

  // Configuration
  private static config: ChronoConfig = { ...defaultConfig };

  // Dependencies (can be overridden for platform-specific implementations)
  private static logger: ChronoLogger = defaultLogger;
  private static timeProvider: TimeProvider = defaultTimeProvider;

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Configure Chronomancer settings
   */
  static configure(config: Partial<ChronoConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set a custom logger implementation
   */
  static setLogger(logger: ChronoLogger): void {
    this.logger = logger;
  }

  /**
   * Set a custom time provider (useful for high-resolution timing on Node.js)
   */
  static setTimeProvider(provider: TimeProvider): void {
    this.timeProvider = provider;
  }

  /**
   * Enable/disable all measurements
   */
  static setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Check if measurements are enabled
   */
  static isEnabled(): boolean {
    return this.config.enabled;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BASIC MEASUREMENT (start/stop pattern)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Start a new time measurement
   *
   * @param id Unique identifier for this measurement
   * @param scope Optional scope for grouping measurements
   * @param metadata Optional metadata to attach to the measurement
   * @returns The measurement ID
   *
   * @example
   * Chronomancer.start('db-query');
   * // ... code to measure
   * const duration = Chronomancer.stop('db-query');
   */
  static start(id: string, scope?: string, metadata?: Record<string, unknown>): string {
    if (!this.config.enabled) return id;

    const effectiveScope = scope ?? this.config.defaultScope;
    const fullId = this.getFullId(id, effectiveScope);

    if (this.activeMeasurements.has(fullId)) {
      this.logger.warn(`Measurement "${fullId}" already started. Restarting.`);
    }

    const measurement: TimeMeasurement = {
      id,
      scope: effectiveScope,
      startTime: this.timeProvider.highResolution(),
      checkpoints: [],
      metadata,
    };

    this.activeMeasurements.set(fullId, measurement);
    this.registerScope(effectiveScope, id);

    return id;
  }

  /**
   * Stop a measurement and get the duration
   *
   * @param id The measurement ID to stop
   * @param scope Optional scope (must match the start scope)
   * @returns Duration in milliseconds, or -1 if measurement not found
   */
  static stop(id: string, scope?: string): number {
    if (!this.config.enabled) return -1;

    const effectiveScope = scope ?? this.config.defaultScope;
    const fullId = this.getFullId(id, effectiveScope);

    const measurement = this.activeMeasurements.get(fullId);
    if (!measurement) {
      this.logger.warn(`Measurement "${fullId}" not found. Did you call start()?`);
      return -1;
    }

    measurement.endTime = this.timeProvider.highResolution();
    measurement.duration = measurement.endTime - measurement.startTime;

    this.activeMeasurements.delete(fullId);
    this.addToHistory(fullId, measurement.duration);

    if (this.config.autoLog && measurement.duration >= this.config.logThresholdMs) {
      this.logger.info(`[${effectiveScope}] ${id}: ${this.formatDuration(measurement.duration)}`);
    }

    return measurement.duration;
  }

  /**
   * Add a checkpoint to an active measurement
   *
   * @param id The measurement ID
   * @param checkpointName Name for this checkpoint
   * @param scope Optional scope
   * @returns The checkpoint or undefined if measurement not found
   */
  static checkpoint(id: string, checkpointName: string, scope?: string): Checkpoint | undefined {
    if (!this.config.enabled) return undefined;

    const effectiveScope = scope ?? this.config.defaultScope;
    const fullId = this.getFullId(id, effectiveScope);

    const measurement = this.activeMeasurements.get(fullId);
    if (!measurement) {
      this.logger.warn(`Measurement "${fullId}" not found for checkpoint.`);
      return undefined;
    }

    const now = this.timeProvider.highResolution();
    const elapsed = now - measurement.startTime;
    const lastCheckpoint = measurement.checkpoints[measurement.checkpoints.length - 1];
    const delta = lastCheckpoint ? elapsed - lastCheckpoint.elapsed : elapsed;

    const cp: Checkpoint = {
      name: checkpointName,
      timestamp: now,
      elapsed,
      delta,
    };

    measurement.checkpoints.push(cp);

    if (this.config.autoLog) {
      this.logger.debug(`[${effectiveScope}] ${id} -> ${checkpointName}: +${this.formatDuration(delta)} (total: ${this.formatDuration(elapsed)})`);
    }

    return cp;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNCTION WRAPPING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Measure the execution time of a synchronous function
   *
   * @param id Measurement identifier
   * @param fn Function to measure
   * @param scope Optional scope
   * @returns The function result
   *
   * @example
   * const result = Chronomancer.measure('calc', () => heavyCalculation());
   */
  static measure<T>(id: string, fn: MeasureableFunction<T>, scope?: string): T {
    this.start(id, scope);
    try {
      return fn() as T;
    } finally {
      this.stop(id, scope);
    }
  }

  /**
   * Measure the execution time of an async function
   *
   * @param id Measurement identifier
   * @param fn Async function to measure
   * @param scope Optional scope
   * @returns Promise with the function result
   *
   * @example
   * const data = await Chronomancer.measureAsync('fetch-data', async () => fetchData());
   */
  static async measureAsync<T>(id: string, fn: AsyncMeasureableFunction<T>, scope?: string): Promise<T> {
    this.start(id, scope);
    try {
      return await fn();
    } finally {
      this.stop(id, scope);
    }
  }

  /**
   * Create a wrapper function that measures execution time on each call
   *
   * @param id Measurement identifier
   * @param fn Function to wrap
   * @param scope Optional scope
   * @returns Wrapped function
   *
   * @example
   * const measuredFetch = Chronomancer.wrap('api-call', fetchData);
   * await measuredFetch(params);
   */
  static wrap<T extends (...args: Parameters<T>) => ReturnType<T>>(
    id: string,
    fn: T,
    scope?: string
  ): T {
    const self = this;
    return function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
      return self.measure(id, () => fn.apply(this, args), scope) as ReturnType<T>;
    } as T;
  }

  /**
   * Create an async wrapper function that measures execution time on each call
   */
  static wrapAsync<T extends (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>>(
    id: string,
    fn: T,
    scope?: string
  ): T {
    const self = this;
    return async function (this: unknown, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
      return self.measureAsync(id, () => fn.apply(this, args) as Promise<Awaited<ReturnType<T>>>, scope);
    } as unknown as T;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DECORATOR
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Method decorator for automatic timing measurement
   *
   * @param id Optional measurement ID (defaults to method name)
   * @param scope Optional scope
   *
   * @example
   * class MyService {
   *   @Chronomancer.track('heavy-operation', 'services')
   *   doHeavyWork() { ... }
   * }
   */
  static track(id?: string, scope?: string): MethodDecorator {
    return (
      target: object,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor
    ): PropertyDescriptor => {
      const originalMethod = descriptor.value;
      const measurementId = id ?? String(propertyKey);
      const self = this;

      if (originalMethod.constructor.name === 'AsyncFunction') {
        descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
          return self.measureAsync(measurementId, () => originalMethod.apply(this, args), scope);
        };
      } else {
        descriptor.value = function (this: unknown, ...args: unknown[]): unknown {
          return self.measure(measurementId, () => originalMethod.apply(this, args), scope);
        };
      }

      return descriptor;
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get statistics for a specific measurement
   */
  static getStats(id: string, scope?: string): MeasurementStats | undefined {
    const effectiveScope = scope ?? this.config.defaultScope;
    const fullId = this.getFullId(id, effectiveScope);

    const measurements = this.history.get(fullId);
    if (!measurements || measurements.length === 0) {
      return undefined;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const total = sorted.reduce((sum, v) => sum + v, 0);

    return {
      id,
      scope: effectiveScope,
      count: sorted.length,
      total,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: total / sorted.length,
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      last: sorted[sorted.length - 1],
    };
  }

  /**
   * Get all statistics for a scope
   */
  static getScopeStats(scope: string): MeasurementStats[] {
    const ids = this.scopes.get(scope);
    if (!ids) return [];

    const stats: MeasurementStats[] = [];
    for (const id of ids) {
      const stat = this.getStats(id, scope);
      if (stat) stats.push(stat);
    }

    return stats.sort((a, b) => b.total - a.total);
  }

  /**
   * Generate a comprehensive report
   */
  static generateReport(): ChronoReport {
    const scopeReports: ScopeReport[] = [];
    let totalMeasurements = 0;
    let totalTime = 0;
    const uniqueIds = new Set<string>();

    for (const [scopeName, ids] of this.scopes) {
      const measurements = this.getScopeStats(scopeName);
      let scopeTotal = 0;
      let scopeCount = 0;

      for (const stat of measurements) {
        scopeTotal += stat.total;
        scopeCount += stat.count;
        uniqueIds.add(`${scopeName}:${stat.id}`);
      }

      scopeReports.push({
        scope: scopeName,
        measurements,
        totalTime: scopeTotal,
        totalMeasurements: scopeCount,
      });

      totalMeasurements += scopeCount;
      totalTime += scopeTotal;
    }

    return {
      generatedAt: this.timeProvider.now(),
      scopes: scopeReports.sort((a, b) => b.totalTime - a.totalTime),
      globalStats: {
        totalMeasurements,
        totalTime,
        uniqueIds: uniqueIds.size,
      },
    };
  }

  /**
   * Format the report as a readable string
   */
  static formatReport(report?: ChronoReport): string {
    const r = report ?? this.generateReport();
    const lines: string[] = [];

    // Column widths: id=18, count=6, min/avg/max/p95=9 each
    // Row: ║ + 1 + 18 + 1 + │ + 1 + 6 + 1 + │ + 1 + 9 + 1 + │ + 1 + 9 + 1 + │ + 1 + 9 + 1 + │ + 1 + 9 + 1 + ║ = 79
    const W = 77;

    const topLine = '╔' + '═'.repeat(W) + '╗';
    const midLine = '╠' + '═'.repeat(W) + '╣';
    const botLine = '╚' + '═'.repeat(W) + '╝';
    const row = (s: string) => '║' + s.padEnd(W) + '║';

    // Table separators: 20 + 8 + 11 + 11 + 11 + 11 = 72 + 5 separators + 2 borders = 79
    const tblTop = '╠════════════════════╤════════╤═══════════╤═══════════╤═══════════╤═══════════╣';
    const tblMid = '╠════════════════════╪════════╪═══════════╪═══════════╪═══════════╪═══════════╣';
    const tblBot = '╠════════════════════╧════════╧═══════════╧═══════════╧═══════════╧═══════════╣';
    const tblHdr = '║ Measurement        │ Count  │    Min    │    Avg    │    Max    │    p95    ║';

    lines.push(topLine);
    lines.push(row('                      CHRONOMANCER REPORT                       '));
    lines.push(midLine);
    lines.push(row(` Generated:          ${new Date(r.generatedAt).toISOString()}`));
    lines.push(row(` Total Measurements: ${r.globalStats.totalMeasurements}`));
    lines.push(row(` Total Time:         ${this.formatDuration(r.globalStats.totalTime)}`));
    lines.push(row(` Unique IDs:         ${r.globalStats.uniqueIds}`));
    lines.push(midLine);

    for (const scope of r.scopes) {
      lines.push(row(` Scope: ${scope.scope}`));
      lines.push(tblTop);
      lines.push(tblHdr);
      lines.push(tblMid);

      for (const stat of scope.measurements) {
        const id = (stat.id.length > 18 ? stat.id.substring(0, 16) + '..' : stat.id).padEnd(18);
        const cnt = stat.count.toString().padStart(6);
        const min = this.formatDuration(stat.min).padStart(9);
        const avg = this.formatDuration(stat.avg).padStart(9);
        const max = this.formatDuration(stat.max).padStart(9);
        const p95 = this.formatDuration(stat.p95).padStart(9);
        lines.push(`║ ${id} │ ${cnt} │ ${min} │ ${avg} │ ${max} │ ${p95} ║`);
      }

      lines.push(tblBot);
      lines.push(row(` Total: ${scope.totalMeasurements} measurements, ${this.formatDuration(scope.totalTime)}`));
      lines.push(midLine);
    }

    lines.pop();
    lines.push(botLine);

    return lines.join('\n');
  }

  /**
   * Print the report to the logger
   */
  static printReport(): void {
    this.logger.info('\n' + this.formatReport());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Clear all measurement history
   */
  static clearHistory(): void {
    this.history.clear();
  }

  /**
   * Clear history for a specific scope
   */
  static clearScope(scope: string): void {
    const ids = this.scopes.get(scope);
    if (ids) {
      for (const id of ids) {
        this.history.delete(this.getFullId(id, scope));
      }
      this.scopes.delete(scope);
    }
  }

  /**
   * Reset all state
   */
  static reset(): void {
    this.activeMeasurements.clear();
    this.history.clear();
    this.scopes.clear();
  }

  /**
   * Get active (running) measurements
   */
  static getActiveMeasurements(): TimeMeasurement[] {
    return Array.from(this.activeMeasurements.values());
  }

  /**
   * Cancel an active measurement without recording
   */
  static cancel(id: string, scope?: string): boolean {
    const effectiveScope = scope ?? this.config.defaultScope;
    const fullId = this.getFullId(id, effectiveScope);
    return this.activeMeasurements.delete(fullId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private static getFullId(id: string, scope: string): string {
    return `${scope}::${id}`;
  }

  private static registerScope(scope: string, id: string): void {
    if (!this.scopes.has(scope)) {
      this.scopes.set(scope, new Set());
    }
    this.scopes.get(scope)!.add(id);
  }

  private static addToHistory(fullId: string, duration: number): void {
    if (!this.history.has(fullId)) {
      this.history.set(fullId, []);
    }

    const hist = this.history.get(fullId)!;
    hist.push(duration);

    // Trim to max size
    while (hist.length > this.config.maxHistoryPerMeasurement) {
      hist.shift();
    }
  }

  private static percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0];

    const index = (p / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private static formatDuration(ms: number): string {
    if (ms < 0.001) {
      return `${(ms * 1000000).toFixed(2)}ns`;
    }
    if (ms < 1) {
      return `${(ms * 1000).toFixed(2)}µs`;
    }
    if (ms < 1000) {
      return `${ms.toFixed(2)}ms`;
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    }
    return `${(ms / 60000).toFixed(2)}m`;
  }
}
