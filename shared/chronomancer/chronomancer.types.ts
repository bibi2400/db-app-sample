/**
 * Chronomancer - Time measurement utility
 * Shared types for both Electron (Node.js) and Angular (Browser)
 */

export interface TimeMeasurement {
  id: string;
  scope?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  checkpoints: Checkpoint[];
  metadata?: Record<string, unknown>;
}

export interface Checkpoint {
  name: string;
  timestamp: number;
  elapsed: number; // Time since start
  delta: number;   // Time since last checkpoint
}

export interface MeasurementStats {
  id: string;
  scope?: string;
  count: number;
  total: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  last: number;
}

export interface ScopeReport {
  scope: string;
  measurements: MeasurementStats[];
  totalTime: number;
  totalMeasurements: number;
}

export interface ChronoReport {
  generatedAt: number;
  scopes: ScopeReport[];
  globalStats: {
    totalMeasurements: number;
    totalTime: number;
    uniqueIds: number;
  };
}

export interface ChronoConfig {
  enabled: boolean;
  maxHistoryPerMeasurement: number;
  defaultScope: string;
  autoLog: boolean;
  logThresholdMs: number;
}

export type ChronoLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ChronoLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface TimeProvider {
  now(): number;
  highResolution(): number;
}

export type MeasureableFunction<T> = (...args: unknown[]) => T;
export type AsyncMeasureableFunction<T> = (...args: unknown[]) => Promise<T>;
