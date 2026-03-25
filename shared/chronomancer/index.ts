/**
 * Chronomancer - Shared time measurement utility
 * 
 * This module provides a platform-agnostic timing utility that can be used
 * in both Node.js (Electron) and Browser (Angular) environments.
 * 
 * @example
 * // Basic usage
 * import { Chronomancer } from '@shared/chronomancer';
 * 
 * Chronomancer.start('operation');
 * // ... code to measure
 * const duration = Chronomancer.stop('operation');
 * 
 * @example
 * // With function wrapping
 * const result = await Chronomancer.measureAsync('fetch', async () => fetchData());
 * 
 * @example
 * // With decorator
 * class MyService {
 *   @Chronomancer.track()
 *   expensiveOperation() { ... }
 * }
 */

export { Chronomancer } from './chronomancer';
export type {
  TimeMeasurement,
  Checkpoint,
  MeasurementStats,
  ChronoReport,
  ScopeReport,
  ChronoConfig,
  ChronoLogger,
  TimeProvider,
  ChronoLogLevel,
  MeasureableFunction,
  AsyncMeasureableFunction,
} from './chronomancer.types';
