import * as fs from 'fs';
import * as path from 'path';

export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

export function toPascalCase(str: string): string {
  return toKebabCase(str)
    .split('-')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function writeIfNotExists(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    console.error(`❌ Il file esiste già: ${path.relative(process.cwd(), filePath)}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log(`  ✅ ${path.relative(process.cwd(), filePath)}`);
}
