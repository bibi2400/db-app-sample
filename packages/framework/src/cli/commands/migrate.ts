import { MIGRATIONS } from '../migrations';
import { getPendingMigrations, getAppliedMigrations, runMigrations, markAllAsApplied } from '../migrations/runner';

export async function migrate(args: string[]): Promise<void> {
  const projectDir = process.cwd();
  const listOnly = args.includes('--list');
  const dryRun = args.includes('--dry-run');
  const status = args.includes('--status');
  const init = args.includes('--init');

  if (init) {
    markAllAsApplied(projectDir, MIGRATIONS);
    return;
  }

  if (status) {
    const applied = getAppliedMigrations(projectDir);
    if (applied.length === 0) {
      console.log('\n📋 Nessuna migrazione applicata.\n');
    } else {
      console.log(`\n📋 ${applied.length} migrazione/i applicata/e:\n`);
      for (const m of applied) {
        console.log(`  ✅ [${m.id}] applicata il ${new Date(m.appliedAt).toLocaleString('it-IT')}`);
      }
      console.log('');
    }

    const pending = getPendingMigrations(projectDir, MIGRATIONS);
    if (pending.length > 0) {
      console.log(`⏳ ${pending.length} migrazione/i in attesa:\n`);
      for (const m of pending) {
        console.log(`  - [${m.id}] ${m.description}`);
      }
      console.log('');
    }
    return;
  }

  if (listOnly) {
    const pending = getPendingMigrations(projectDir, MIGRATIONS);
    if (pending.length === 0) {
      console.log('\n✅ Nessuna migrazione da applicare.\n');
    } else {
      console.log(`\n📋 ${pending.length} migrazione/i disponibile/i:\n`);
      for (const m of pending) {
        console.log(`  ⏳ [${m.id}] ${m.description}`);
      }
      console.log('\nEsegui "eaf migrate" per applicarle.\n');
    }
    return;
  }

  await runMigrations(projectDir, MIGRATIONS, { dryRun });
}
