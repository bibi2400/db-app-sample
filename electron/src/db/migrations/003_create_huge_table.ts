import { DbMigrationDefinition } from '@bibi2400/electron-angular-framework/shared';
import type { DataSource } from 'typeorm';

export class CreateHugeTableMigration extends DbMigrationDefinition {
  readonly id = '003_create_huge_table';
  readonly description = 'Migrazione di test: crea una tabella con molti record per testare le performance';

  async up(dataSource: DataSource): Promise<void> {
    await dataSource.query(`
        CREATE TABLE IF NOT EXISTS hugeTable (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);
    const values: string[] = [];
    for (let index = 0; index < 100_000; index++) {
      values.push(`('Record ${index + 1}', datetime('now'))`);
    }
    await dataSource.query(`
      INSERT INTO hugeTable (message, created_at)
      VALUES ${values.join(', ')}
    `);
  }
}
