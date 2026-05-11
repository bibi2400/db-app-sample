import { Injectable } from "../../helpers/mini-pie/decorators";
import { Logger } from "../../helpers/logger";
import { DbMigrationDefinition } from "../../../shared/types/db-migration";
import { DbMigrationRecord } from "../../entities/db-migration-record";
import { DataSourceService } from "./data-source.service";
import { IpcResponse } from "../../../shared/types/ipc";

@Injectable()
export class DbMigrationService {
  private migrations: DbMigrationDefinition[] = [];

  constructor(private readonly dataSourceService: DataSourceService) {}

  /**
   * Register the migration definitions to run.
   * Called by AppBootstrap before the bootstrap sequence starts.
   */
  setMigrations(migrations: DbMigrationDefinition[]): void {
    this.migrations = migrations;
  }

  /**
   * Ensures all framework-owned tables exist in the database.
   * Uses raw DDL so it works regardless of whether TypeORM `synchronize` is
   * enabled or not. Safe to call multiple times — all statements are idempotent.
   */
  private async ensureSchemaExists(): Promise<void> {
    const ds = this.dataSourceService.dataSource;

    await ds.query(`
      CREATE TABLE IF NOT EXISTS _eaf_db_migrations (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        migrationId VARCHAR NOT NULL,
        appliedAt   VARCHAR NOT NULL,
        description VARCHAR,
        UNIQUE (migrationId)
      )
    `);

    await ds.query(`
      CREATE TABLE IF NOT EXISTS attachment (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        fileName     VARCHAR NOT NULL,
        originalName VARCHAR NOT NULL,
        relativePath VARCHAR NOT NULL DEFAULT '',
        size         INTEGER NOT NULL,
        mimeType     VARCHAR,
        checksum     VARCHAR(64) NOT NULL,
        ownerType    VARCHAR,
        ownerId      INTEGER,
        uploadDate   DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    await ds.query(`CREATE INDEX IF NOT EXISTS IDX_attachment_relativePath ON attachment (relativePath)`);
    await ds.query(`CREATE INDEX IF NOT EXISTS IDX_attachment_checksum     ON attachment (checksum)`);
    await ds.query(`CREATE INDEX IF NOT EXISTS IDX_attachment_owner        ON attachment (ownerType, ownerId)`);
  }

  /**
   * Execute all pending migrations in order.
   * Called via IPC from the Angular frontend at startup.
   *
   * For each migration not yet recorded in `_eaf_db_migrations`:
   *   1. Run `migration.up(dataSource)`
   *   2. Insert a `DbMigrationRecord` to mark it as applied
   *
   * Returns `{ success: true }` when all pending migrations complete,
   * or `{ success: false, error }` if any migration throws.
   */
  async runPendingMigrations(): Promise<IpcResponse<void>> {
    try {
      await this.ensureSchemaExists();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Logger.error("[DbMigration] Failed to create migrations table:", err);
      return { success: false, error: `Impossibile creare la tabella delle migrazioni: ${message}` };
    }

    if (this.migrations.length === 0) {
      return { success: true };
    }

    const repo = this.dataSourceService.model(DbMigrationRecord);

    let appliedIds: Set<string>;
    try {
      const applied = await repo.find({ select: { migrationId: true } });
      appliedIds = new Set(applied.map(r => r.migrationId));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Logger.error("[DbMigration] Failed to read migration records:", err);
      return { success: false, error: `Impossibile leggere lo stato delle migrazioni: ${message}` };
    }

    const pending = this.migrations.filter(m => !appliedIds.has(m.id));

    if (pending.length === 0) {
      return { success: true };
    }

    Logger.info(`[DbMigration] ${pending.length} migration(s) pending.`);

    for (const migration of pending) {
      Logger.info(`[DbMigration] Running migration "${migration.id}": ${migration.description}`);
      try {
        await migration.up(this.dataSourceService.dataSource);

        const record = repo.create({
          migrationId: migration.id,
          description: migration.description,
          appliedAt: new Date().toISOString(),
        });
        await repo.save(record);

        Logger.info(`[DbMigration] Migration "${migration.id}" applied successfully.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Logger.error(`[DbMigration] Migration "${migration.id}" failed:`, err);
        return {
          success: false,
          error: `Migrazione "${migration.id}" fallita: ${message}`,
        };
      }
    }

    Logger.info(`[DbMigration] All pending migrations applied.`);
    return { success: true };
  }
}
