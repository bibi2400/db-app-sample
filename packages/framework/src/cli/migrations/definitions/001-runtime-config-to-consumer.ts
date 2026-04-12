import { Migration } from '../types';

export const migration: Migration = {
  id: '001',
  description: 'Sposta runtime-config nel progetto consumer e aggiorna main.ts per passare runtimeConfig al bootstrap',
  up: (ctx) => {
    // 1. Crea il file runtime-config.ts nel consumer
    if (!ctx.fileExists('electron/src/config/runtime-config.ts')) {
      ctx.createFile(
        'electron/src/config/runtime-config.ts',
        `// Auto-generated at build time by \`eaf inject-token\`. Do not edit manually.
// Default: empty token (auto-update disabled in dev mode).
import { RuntimeConfig } from '@bibi2400/electron-angular-framework/electron';

export const RUNTIME_CONFIG: RuntimeConfig = {
  GH_TOKEN: '',
};
`
      );
    }

    // 2. Aggiorna electron/main.ts: aggiungi import e runtimeConfig al bootstrap
    if (ctx.fileExists('electron/main.ts')) {
      const content = ctx.readFile('electron/main.ts');

      // Aggiungi import se non presente
      if (!content.includes('runtime-config')) {
        ctx.insertAfter(
          'electron/main.ts',
          /^import.*\/services/,
          "import { RUNTIME_CONFIG } from './src/config/runtime-config';"
        );
      }

      // Aggiungi runtimeConfig al bootstrap se non presente
      if (!content.includes('runtimeConfig')) {
        ctx.replaceInFile(
          'electron/main.ts',
          /services:\s*APP_SERVICES,\n\}/,
          'services: APP_SERVICES,\n  runtimeConfig: RUNTIME_CONFIG,\n}'
        );
      }
    }
  },
};
