/**
 * Syncs the version from the root package.json to packages/framework/package.json.
 * Used as a pre-commit hook so the framework version always matches the app version.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const rootPkg = resolve(__dirname, '..', 'package.json');
const fwPkg = resolve(__dirname, '..', 'packages', 'framework', 'package.json');

const rootVersion: string = JSON.parse(readFileSync(rootPkg, 'utf8')).version;
const fw = JSON.parse(readFileSync(fwPkg, 'utf8'));

if (fw.version !== rootVersion) {
  fw.version = rootVersion;
  writeFileSync(fwPkg, JSON.stringify(fw, null, 2) + '\n');
  execSync('git add packages/framework/package.json', { stdio: 'inherit' });
  console.log(`[sync-version] Framework version synced to ${rootVersion}`);
}
