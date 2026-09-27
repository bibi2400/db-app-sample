const path = require('node:path');
const { spawn } = require('node:child_process');

const environment = { ...process.env };
delete environment['ELECTRON_RUN_AS_NODE'];
const child = spawn(require('electron'), [
  path.join(__dirname, 'eaf-table-layout.test.cjs'),
], {
  env: environment,
  stdio: 'inherit',
  windowsHide: true,
});
child.on('error', error => {
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', code => {
  process.exitCode = code ?? 1;
});
