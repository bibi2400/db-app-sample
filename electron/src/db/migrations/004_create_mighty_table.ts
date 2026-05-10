import { DbMigrationDefinition } from '@bibi2400/electron-angular-framework/shared';
import type { DataSource } from 'typeorm';

const mySQLdataTypes = [
  'INT',
  'VARCHAR(255)',
  'TEXT',
  'DATE',
  'DATETIME',
  'BOOLEAN',
  'FLOAT',
  'DOUBLE',
  'DECIMAL(10,2)',
] as const;

export class CreateMightyTableMigration extends DbMigrationDefinition {
  readonly id = '004_create_mighty_table';
  readonly description =
    'Migrazione di test: crea una tabella con molti record per testare le performance';

  async up(dataSource: DataSource): Promise<void> {
    const headers: { key: string; type: string }[] = [];

    for (let index = 0; index < 40; index++) {
      headers.push({
        key: `header${index + 1}`,
        type: mySQLdataTypes[index % mySQLdataTypes.length],
      });
    }

    await dataSource.query(`
        CREATE TABLE IF NOT EXISTS mightyTable (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ${headers.map((header) => `${header.key} ${header.type}`).join(', ')}
        )
      `);

    const values: string[] = [];

    for (let index = 0; index < 100_000; index++) {
      const value = headers
        .map((header) => {
          switch (header.type) {
            case 'INT':
              return Math.floor(Math.random() * 100);
            case 'VARCHAR(255)':
            case 'TEXT':
              return `'Random text ${Math.floor(Math.random() * 1000)}'`;
            case 'DATE':
              return `'${new Date().toISOString().split('T')[0]}'`;
            case 'DATETIME':
              return `'${new Date().toISOString().replace('T', ' ').substring(0, 19)}'`;
            case 'BOOLEAN':
              return Math.random() < 0.5 ? 'TRUE' : 'FALSE';
            case 'FLOAT':
            case 'DOUBLE':
            case 'DECIMAL(10,2)':
              return (Math.random() * 100).toFixed(2);
            default:
              return 'NULL';
          }
        })
        .join(', ');
      values.push(`(${value})`);
    }

    await dataSource.query(`
      INSERT INTO mightyTable (${headers.map((header) => header.key).join(', ')})
      VALUES ${values.join(', ')}
    `);
  }
}
