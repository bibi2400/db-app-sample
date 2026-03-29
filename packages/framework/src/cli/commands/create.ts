import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import { toKebabCase, toPascalCase } from '../helpers';

const PKG = '@bibi2400/electron-angular-framework';
const TEMPLATES_DIR = path.join(__dirname, '..', '..', '..', 'src', 'cli', 'templates');

/**
 * Scaffolds a new Electron + Angular + SQLite project using the framework.
 */
export function create(name: string | undefined): void {
  if (!name) {
    console.error('\nUso: eaf create <nome-progetto>\n');
    console.error('Esempio: eaf create my-app');
    process.exit(1);
  }

  const kebab = toKebabCase(name);
  const pascal = toPascalCase(name);
  const productName = pascal.replace(/([A-Z])/g, ' $1').trim();
  const dir = path.resolve(process.cwd(), kebab);

  if (fs.existsSync(dir)) {
    console.error(`\n❌ La cartella "${kebab}" esiste già.`);
    process.exit(1);
  }

  console.log(`\n🚀 Creazione progetto "${productName}" in ${dir}\n`);

  // Create extra empty directories not covered by templates
  const extraDirs = [
    'angular/src/app/components',
    'angular/src/app/services',
    'public',
    'build',
  ];

  for (const d of extraDirs) {
    fs.mkdirSync(path.join(dir, d), { recursive: true });
  }

  // Copy and process all .tmpl templates
  const replacements: Record<string, string> = {
    '{{KEBAB}}': kebab,
    '{{PASCAL}}': pascal,
    '{{PRODUCT_NAME}}': productName,
    '{{PKG}}': PKG,
  };

  copyTemplates(TEMPLATES_DIR, dir, replacements);

  // Initialize git repository with main and staging branches
  initGitRepo(dir);

  // Open VS Code (non-blocking)
  openVSCode(dir);

  // Install dependencies
  installDependencies(dir);

  console.log(`\n✨ Progetto "${productName}" creato con successo!\n`);
  console.log('Prossimi passi:');
  console.log(`  1. cd ${kebab}`);
  console.log('  2. npm run dev');
  console.log('');
}

/**
 * Recursively walks the templates directory, reads each .tmpl file,
 * replaces placeholders, and writes the result (without .tmpl extension).
 */
function copyTemplates(srcDir: string, destDir: string, replacements: Record<string, string>): void {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);

    if (entry.isDirectory()) {
      copyTemplates(srcPath, path.join(destDir, entry.name), replacements);
      continue;
    }

    if (!entry.name.endsWith('.tmpl')) continue;

    // Strip the .tmpl extension for the output file name
    const outputName = entry.name.slice(0, -5);
    const destPath = path.join(destDir, outputName);

    let content = fs.readFileSync(srcPath, 'utf-8');
    for (const [placeholder, value] of Object.entries(replacements)) {
      content = content.split(placeholder).join(value);
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, content);

    const relPath = path.relative(path.resolve(destDir, '..', path.basename(destDir)), destPath)
      || outputName;
    console.log(`  ✅ ${relPath}`);
  }
}

/**
 * Initializes a git repository with an initial commit on main,
 * then creates a staging branch.
 */
function initGitRepo(dir: string): void {
  const git = (args: string) => execSync(`git ${args}`, { cwd: dir, stdio: 'pipe' });

  try {
    console.log('\n📦 Inizializzazione repository Git...');
    git('init -b main');
    git('add -A');
    git('commit -m "Initial commit"');
    git('branch staging');
    console.log('  ✅ Repository creata con branch main e staging');
  } catch {
    console.warn('  ⚠️  Impossibile inizializzare la repository Git (git non disponibile?)');
  }
}

/**
 * Opens VS Code in the project directory (non-blocking, detached).
 */
function openVSCode(dir: string): void {
  try {
    console.log('\n💻 Apertura VS Code...');
    const child = spawn('code', ['.'], { cwd: dir, stdio: 'ignore', detached: true, shell: true });
    child.unref();
    console.log('  ✅ VS Code avviato');
  } catch {
    console.warn('  ⚠️  Impossibile aprire VS Code (comando "code" non disponibile?)');
  }
}

/**
 * Runs npm install in the project directory.
 */
function installDependencies(dir: string): void {
  try {
    console.log('\n📦 Installazione dipendenze (npm install)...');
    execSync('npm ci', { cwd: dir, stdio: 'inherit' });
    console.log('  ✅ Dipendenze installate');
  } catch {
    console.warn('  ⚠️  npm install fallito. Esegui manualmente: cd ' + path.basename(dir) + ' && npm install');
  }
}
