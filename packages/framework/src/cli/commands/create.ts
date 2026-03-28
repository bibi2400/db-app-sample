import * as fs from 'fs';
import * as path from 'path';
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
    'src/app/components',
    'src/app/services',
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

  console.log(`\n✨ Progetto "${productName}" creato con successo!\n`);
  console.log('Prossimi passi:');
  console.log(`  1. cd ${kebab}`);
  console.log('  2. Configura autenticazione GitHub Packages:');
  console.log('     npm login --scope=@bibi2400 --registry=https://npm.pkg.github.com');
  console.log('  3. npm install');
  console.log('  4. npm run dev');
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
