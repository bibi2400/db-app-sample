#!/usr/bin/env node

// @bibi2400/electron-angular-framework CLI

import { generate } from './commands/generate';
import { injectToken } from './commands/inject-token';
import { create } from './commands/create';
import { build, clean, packageWin } from './commands/build';

const command = process.argv[2];

const COMMANDS: Record<string, string> = {
  'create': 'Scaffold a new project',
  'generate': 'Generate Angular/Electron components',
  'build': 'Build the app (framework + Angular + Electron)',
  'clean': 'Remove the release directory',
  'package': 'Full packaging pipeline (clean + build + electron-builder)',
  'inject-token': 'Inject GitHub update token into runtime config',
};

if (!command || !COMMANDS[command]) {
  console.log('\n@bibi2400/electron-angular-framework CLI\n');
  console.log('Usage: eaf <command> [options]\n');
  console.log('Commands:');
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    console.log(`  ${cmd.padEnd(16)} ${desc}`);
  }
  console.log('\nExamples:');
  console.log('  eaf create my-app');
  console.log('  eaf generate angular-page user-profile');
  console.log('  eaf build');
  console.log('  eaf build electron');
  console.log('  eaf package');
  console.log('  eaf package --no-token');
  console.log('  eaf inject-token');
  process.exit(1);
}

if (command === 'create') {
  create(process.argv[3]);
}

if (command === 'generate') {
  const [type, ...nameParts] = process.argv.slice(3);
  generate(type, nameParts.join(' '));
}

if (command === 'build') {
  build(process.argv[3]);
}

if (command === 'clean') {
  clean();
}

if (command === 'package') {
  packageWin(process.argv.slice(3));
}

if (command === 'inject-token') {
  injectToken();
}
