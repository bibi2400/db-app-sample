import { DbMigrationDefinition } from '@bibi2400/electron-angular-framework/shared';
import type { DataSource } from 'typeorm';

export class TestNotesMigration extends DbMigrationDefinition {
  readonly id = '002_test_migration';
  readonly description = 'Migrazione di test: aggiunge colonna notes a migration_test_log';

  async up(dataSource: DataSource): Promise<void> {
      await new Promise(r => setTimeout(r, 1500));
      await dataSource.query(`
        ALTER TABLE migration_test_log ADD COLUMN notes TEXT
      `);
      await dataSource.query(`
        INSERT INTO migration_test_log (message, created_at, notes)
        VALUES ('Migrazione 002 applicata', datetime('now'), 'colonna notes aggiunta')
      `);
  }
}