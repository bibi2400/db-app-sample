const fs = require('fs');
const path = require('path');

// In CI usa ELECTRON_UPDATE_TOKEN (PAT dedicato), in locale usa GH_TOKEN dal .env
const token = process.env.ELECTRON_UPDATE_TOKEN ||  '';

if (!token) {
  console.error('⚠️ Nessun token trovato. Il controllo aggiornamenti non funzionerà.');
  process.exit(1);
}

const content = `// Auto-generated at build time. Do not edit manually.
export const RUNTIME_CONFIG = {
  GH_TOKEN: '${token}',
};
`;

const outDir = path.join(__dirname, '..', 'electron', 'src', 'config');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'runtime-config.ts'), content);
console.log('✓ runtime-config.ts injected');