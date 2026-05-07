import { DbMigrationDefinition } from '@bibi2400/electron-angular-framework/shared';

export const CREATE_LOG_TABLE_SQL: DbMigrationDefinition = {
  id: '001_test_migration',
  description: 'Migrazione di test: aggiunge la tabella migration_test_log',
  async up(dataSource) {
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
  },
};
