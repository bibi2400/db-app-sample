import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

function writeFile(relativePath: string, content: string): void {
  fs.writeFileSync(path.join(ROOT, relativePath), content, 'utf-8');
}

function toArtifactName(displayName: string): string {
  return displayName
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('-');
}

function replaceInFile(relativePath: string, replacements: [string | RegExp, string][]): void {
  let content = readFile(relativePath);
  for (const [search, replace] of replacements) {
    if (typeof search === 'string') {
      content = content.replaceAll(search, replace);
    } else {
      content = content.replace(search, replace);
    }
  }
  writeFile(relativePath, content);
}

function main() {
  const [slug, displayName] = process.argv.slice(2);

  if (!slug || !displayName) {
    console.error('Usage: npm run rename-app -- <slug> "<Display Name>"');
    console.error('Example: npm run rename-app -- my-cool-app "My Cool App"');
    process.exit(1);
  }

  // Validate slug format
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    console.error('Error: slug must be lowercase alphanumeric with hyphens (e.g. "my-cool-app")');
    process.exit(1);
  }

  const artifactPrefix = toArtifactName(displayName);

  // Read current values from package.json to use as search targets
  const pkg = JSON.parse(readFile('package.json'));
  const oldSlug = pkg.name as string;
  const oldProductName = (pkg.productName || pkg.build?.productName) as string;
  const oldArtifactName = pkg.build?.artifactName as string;
  const oldAppId = pkg.build?.appId as string;
  const oldRepo = pkg.publish?.repo as string;

  console.log(`Renaming app: "${oldSlug}" → "${slug}"`);
  console.log(`Display name: "${oldProductName}" → "${displayName}"`);
  console.log();

  // 1. package.json
  console.log('  Updating package.json...');
  replaceInFile('package.json', [
    [`"name": "${oldSlug}"`, `"name": "${slug}"`],
    [`"productName": "${oldProductName}"`, `"productName": "${displayName}"`],
    [oldArtifactName, `${artifactPrefix}-Setup-\${version}.\${ext}`],
    [oldAppId, `com.${slug}.app`],
    [`"repo": "${oldRepo}"`, `"repo": "${slug}"`],
  ]);

  // 2. package-lock.json (if exists)
  if (fs.existsSync(path.join(ROOT, 'package-lock.json'))) {
    console.log('  Updating package-lock.json...');
    let lockContent = readFile('package-lock.json');
    // Replace the top-level name fields (first two occurrences)
    lockContent = lockContent.replaceAll(`"name": "${oldSlug}"`, `"name": "${slug}"`);
    writeFile('package-lock.json', lockContent);
  }

  // 3. angular.json
  console.log('  Updating angular.json...');
  let angularContent = readFile('angular.json');
  angularContent = angularContent.replaceAll(oldSlug, slug);
  writeFile('angular.json', angularContent);

  // 4. src/index.html
  console.log('  Updating src/index.html...');
  replaceInFile('src/index.html', [
    [`<title>${oldProductName}</title>`, `<title>${displayName}</title>`],
  ]);

  console.log();
  console.log(`Done! App renamed to "${displayName}" (${slug}).`);
  console.log();
  console.log('Note: You may also want to update:');
  console.log('  - publish.owner in package.json (GitHub username/org)');
  console.log('  - Icons and splash screen assets');
}

main();
