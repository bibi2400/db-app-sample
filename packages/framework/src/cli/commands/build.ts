import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * eaf build — builds the full app: framework → Angular → Electron.
 * eaf build framework — builds only the framework.
 * eaf build angular — builds only the Angular frontend.
 * eaf build electron — builds only the Electron backend.
 */
export function build(target?: string): void {
  const cwd = process.cwd();

  const hasFramework = fs.existsSync(path.join(cwd, 'packages', 'framework', 'tsconfig.json'));

  const steps: Record<string, { label: string; cmd: string; condition?: boolean }> = {
    framework: {
      label: 'Framework (TypeScript)',
      cmd: 'cd packages/framework && npx tsc -p tsconfig.json',
      condition: hasFramework,
    },
    angular: {
      label: 'Angular',
      cmd: 'npx ng build',
    },
    electron: {
      label: 'Electron (TypeScript)',
      cmd: 'npx tsc -p electron/tsconfig.json',
    },
  };

  const targets = target ? [target] : ['framework', 'angular', 'electron'];

  for (const t of targets) {
    const step = steps[t];
    if (!step) {
      console.error(`\n❌ Target sconosciuto: "${t}"`);
      console.error('Targets disponibili: framework, angular, electron');
      process.exit(1);
    }
    if (step.condition === false) continue;

    console.log(`\n🔨 Building ${step.label}...`);
    try {
      execSync(step.cmd, { stdio: 'inherit', cwd });
    } catch {
      console.error(`\n❌ Build fallita: ${step.label}`);
      process.exit(1);
    }
  }

  console.log('\n✅ Build completata!\n');
}

/**
 * eaf clean — removes the release directory.
 */
export function clean(): void {
  const releaseDir = path.join(process.cwd(), 'release');
  fs.rmSync(releaseDir, { recursive: true, force: true });
  console.log('🧹 Cartella release eliminata');
}

/**
 * eaf package — full packaging pipeline: clean → inject-token → build → electron-builder.
 * eaf package --no-token — skips inject-token step.
 */
export function packageWin(args: string[]): void {
  const noToken = args.includes('--no-token');

  console.log('\n📦 Packaging per Windows...\n');

  clean();

  if (!noToken) {
    console.log('\n🔑 Inject update token...');
    try {
      execSync('npx eaf inject-token', { stdio: 'inherit' });
    } catch {
      console.error('\n❌ inject-token fallito');
      process.exit(1);
    }
  }

  build();

  console.log('\n📦 Electron Builder...');
  try {
    execSync('npx electron-builder build --win', { stdio: 'inherit' });
  } catch {
    console.error('\n❌ Electron Builder fallito');
    process.exit(1);
  }

  console.log('\n✅ Package completato!\n');
}
