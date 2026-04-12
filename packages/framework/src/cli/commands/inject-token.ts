import * as fs from 'fs';
import * as path from 'path';

/**
 * Injects the GitHub update token into the consumer project's runtime-config.ts.
 * Used by CI/CD pipelines to enable auto-update functionality.
 *
 * Reads from environment variable ELECTRON_UPDATE_TOKEN.
 * Writes to <projectRoot>/electron/src/config/runtime-config.ts
 */
export function injectToken(): void {
  const token = (process.env['ELECTRON_UPDATE_TOKEN'] || '').trim();

  if (!token) {
    console.error('⚠️ Nessun token trovato (ELECTRON_UPDATE_TOKEN).');
    console.error('   Il controllo aggiornamenti non funzionerà.');
    process.exit(1);
  }

  const content = `// Auto-generated at build time. Do not edit manually.
import { RuntimeConfig } from '@bibi2400/electron-angular-framework/electron';

export const RUNTIME_CONFIG: RuntimeConfig = {
  GH_TOKEN: '${token}',
};
`;

  console.log(content)

  const configDir = path.join(process.cwd(), 'electron', 'src', 'config');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, 'runtime-config.ts'), content);
  console.log('✓ runtime-config.ts injected (electron/src/config/)');
}
