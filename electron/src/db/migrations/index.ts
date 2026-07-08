import { DbMigrationDefinition } from '@bibi2400/electron-angular-framework/shared';
import { CreateLogTableMigration } from './001_create_log_table';
import { TestNotesMigration } from './002_test_notes';
import { CreateHugeTableMigration } from './003_create_huge_table';
import { CreateMightyTableMigration } from './004_create_mighty_table';
import { CreateVengeanceTableMigration } from './005_create_vengeance_table';
import { SeedProductsMigration } from './006_seed_products';

export const DB_MIGRATIONS: DbMigrationDefinition[] = [
  new CreateLogTableMigration(),
  new TestNotesMigration(),
  new CreateHugeTableMigration(),
  new CreateMightyTableMigration(),
  new CreateVengeanceTableMigration(),
  new SeedProductsMigration(),
];
