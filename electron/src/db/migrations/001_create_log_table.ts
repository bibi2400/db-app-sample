import { DbMigrationDefinition } from '@bibi2400/electron-angular-framework/shared';
import type { DataSource } from 'typeorm';

export class CreateLogTableMigration extends DbMigrationDefinition {
  readonly id = '001_test_migration';
  readonly description = 'Migrazione di test: aggiunge la tabella migration_test_log';

  async up(dataSource: DataSource): Promise<void> {
    // Simula un'operazione leggermente lenta per rendere visibile l'overlay
    await new Promise((r) => setTimeout(r, 2000));
    await dataSource.query(`
        CREATE TABLE IF NOT EXISTS migration_test_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);
    await dataSource.query(`
        INSERT INTO migration_test_log (message, created_at)
        VALUES ('Migrazione 001 applicata', datetime('now'))
      `);
  }
}
