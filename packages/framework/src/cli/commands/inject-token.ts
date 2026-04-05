import * as fs from 'fs';
import * as path from 'path';

/**
 * Injects the GitHub update token into the framework's runtime-config.ts.
 * Used by CI/CD pipelines to enable auto-update functionality.
 *
 * Reads from environment variable ELECTRON_UPDATE_TOKEN.
 * Writes to packages/framework/src/electron/config/runtime-config.ts
 */
export function injectToken(): void {
  const token = process.env['ELECTRON_UPDATE_TOKEN'] || '';

  if (!token) {
    console.error('⚠️ Nessun token trovato (ELECTRON_UPDATE_TOKEN).');
    console.error('   Il controllo aggiornamenti non funzionerà.');
    process.exit(1);
  }

  const content = `// Auto-generated at build time. Do not edit manually.
export const RUNTIME_CONFIG = {
  GH_TOKEN: '${token}',
};
`;

  console.log(content);

  // Find the framework package relative to the project root
  const frameworkConfigDir = path.join(process.cwd(), 'packages', 'framework', 'src', 'electron', 'config');
  fs.mkdirSync(frameworkConfigDir, { recursive: true });
  fs.writeFileSync(path.join(frameworkConfigDir, 'runtime-config.ts'), content);
  console.log('✓ runtime-config.ts injected (packages/framework/src/electron/config/)');
}
