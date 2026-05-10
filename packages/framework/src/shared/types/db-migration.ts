import type { DataSource } from 'typeorm';

/**
 * Defines a single database migration to be applied at runtime.
 *
 * - `id`: unique identifier (e.g. "001_add_status_column"). Must be stable across releases.
 * - `description`: human-readable description shown in logs.
 * - `up`: async function that receives the TypeORM DataSource and performs the migration.
 *   Must be idempotent — the framework ensures it is called only once per installation,
 *   but the function itself should handle partial states gracefully.
 */
export abstract class DbMigrationDefinition {
  abstract readonly id: string;
  abstract readonly description: string;
  abstract up(dataSource: DataSource): Promise<void>;
}
