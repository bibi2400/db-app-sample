import { DbMigrationDefinition } from '@bibi2400/electron-angular-framework/shared';
import { CREATE_LOG_TABLE_SQL } from './001_create_log_table';
import { TEST_NOTES } from './002_test_notes';
import { CREATE_HUGE_TABLE } from './003_create_huge_table';
import { CREATE_MIGHTY_TABLE } from './004_create_mighty_table';

export const DB_MIGRATIONS: DbMigrationDefinition[] = [
  CREATE_LOG_TABLE_SQL,
  TEST_NOTES,
  CREATE_HUGE_TABLE,
  CREATE_MIGHTY_TABLE,
];
