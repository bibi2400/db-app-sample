import * as fs from 'fs';
import * as path from 'path';
import { Migration, MigrationState, MigrationRecord } from './types';
import { createMigrationContext } from './context';

const STATE_FILE = '.eaf-migrations.json';

function readState(projectDir: string): MigrationState {
  const filePath = path.join(projectDir, STATE_FILE);
  if (!fs.existsSync(filePath)) {
    return { appliedMigrations: [] };
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeState(projectDir: string, state: MigrationState): void {
  const filePath = path.join(projectDir, STATE_FILE);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2) + '\n');
}

export function getPendingMigrations(projectDir: string, allMigrations: Migration[]): Migration[] {
  const state = readState(projectDir);
  const appliedIds = new Set(state.appliedMigrations.map(m => m.id));
  return allMigrations.filter(m => !appliedIds.has(m.id));
}

export function getAppliedMigrations(projectDir: string): MigrationRecord[] {
  return readState(projectDir).appliedMigrations;
}

export async function runMigrations(
  projectDir: string,
  allMigrations: Migration[],
  options: { dryRun?: boolean } = {}
): Promise<number> {
  const pending = getPendingMigrations(projectDir, allMigrations);

  if (pending.length === 0) {
    console.log('\n✅ Nessuna migrazione da applicare.\n');
    return 0;
  }

  console.log(`\n📋 ${pending.length} migrazione/i da applicare:\n`);
  for (const m of pending) {
    console.log(`  - [${m.id}] ${m.description}`);
  }

  if (options.dryRun) {
    console.log('\n🔍 Modalità dry-run: nessuna modifica applicata.\n');
    return pending.length;
  }

  const state = readState(projectDir);
  const ctx = createMigrationContext(projectDir);
  let applied = 0;

  for (const migration of pending) {
    console.log(`\n🔄 Applicazione: [${migration.id}] ${migration.description}`);
    try {
      await migration.up(ctx);
      state.appliedMigrations.push({
        id: migration.id,
        appliedAt: new Date().toISOString(),
      });
      writeState(projectDir, state);
      applied++;
      console.log(`  ✅ Migrazione completata`);
    } catch (error) {
      console.error(`\n❌ Errore nella migrazione [${migration.id}]:`);
      console.error(`   ${error instanceof Error ? error.message : error}`);
      console.error('\n⚠️  Le migrazioni successive sono state annullate.');
      console.error('   Correggi il problema e riesegui: eaf migrate\n');
      process.exit(1);
    }
  }

  console.log(`\n✅ ${applied} migrazione/i applicata/e con successo!\n`);
  return applied;
}

export function markAllAsApplied(projectDir: string, allMigrations: Migration[]): void {
  const state = readState(projectDir);
  const appliedIds = new Set(state.appliedMigrations.map(m => m.id));

  for (const migration of allMigrations) {
    if (!appliedIds.has(migration.id)) {
      state.appliedMigrations.push({
        id: migration.id,
        appliedAt: new Date().toISOString(),
      });
    }
  }

  writeState(projectDir, state);
  console.log(`\n✅ Tutte le ${allMigrations.length} migrazioni sono state segnate come applicate.\n`);
}
