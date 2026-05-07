/**
 * Full dev orchestrator: runs ng serve + electron-dev in parallel.
 * Replaces concurrently to avoid cmd.exe "Terminare il processo batch" prompts on Windows.
 * All child processes are spawned directly via node (no shell wrappers).
 *
 * Usage: node scripts/dev.js [-- extra-args-for-electron]
 */

const { spawn, execSync } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';
let ngProcess = null;
let electronDevProcess = null;
let isShuttingDown = false;

function killProcessTree(childProcess) {
  if (!childProcess || !childProcess.pid) return;
  try {
    if (isWindows) {
      execSync(`taskkill /F /T /PID ${childProcess.pid}`, { stdio: 'ignore', timeout: 5000 });
    } else {
      process.kill(-childProcess.pid, 'SIGKILL');
    }
  } catch {
    try { childProcess.kill('SIGKILL'); } catch {}
  }
}

function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n[dev] Shutting down...');
  killProcessTree(electronDevProcess);
  killProcessTree(ngProcess);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Resolve ng CLI binary directly — bypasses npx.cmd / cmd.exe on Windows
let ngBin;
try {
  ngBin = require.resolve('@angular/cli/bin/ng.js');
} catch {
  ngBin = path.join(process.cwd(), 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
}

const rawArgs = process.argv.slice(2);

// Parse --port <number> from args; remaining args are forwarded to Electron
let devPort = 4202;
const extraArgs = [];
for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === '--port' && rawArgs[i + 1]) {
    devPort = parseInt(rawArgs[++i], 10);
  } else {
    extraArgs.push(rawArgs[i]);
  }
}

// Pipe child stdio through Node instead of inheriting the terminal directly.
// This prevents Electron/Chromium from altering the Windows console code page,
// which would corrupt multi-byte UTF-8 characters (box-drawing, etc.).

function pipeOutput(child, label) {
  if (child.stdout) child.stdout.on('data', (d) => process.stdout.write(d));
  if (child.stderr) child.stderr.on('data', (d) => process.stderr.write(d));
}

// Start Angular dev server
ngProcess = spawn(process.execPath, [ngBin, 'serve', '--port', String(devPort)], {
  stdio: ['inherit', 'pipe', 'pipe'],
});
pipeOutput(ngProcess, 'ng');

ngProcess.on('error', (err) => {
  console.error('[dev] Failed to start Angular dev server:', err);
});

ngProcess.on('close', (code) => {
  console.log(`[dev] Angular dev server exited with code ${code}`);
  if (!isShuttingDown) shutdown();
});

// Start Electron watch (reuses framework's electron-dev.js)
const electronDevScript = path.join(__dirname, 'electron-dev.js');
electronDevProcess = spawn(process.execPath, [electronDevScript, ...extraArgs], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env, DEV_PORT: String(devPort) },
});
pipeOutput(electronDevProcess, 'electron');

electronDevProcess.on('error', (err) => {
  console.error('[dev] Failed to start Electron dev:', err);
});

electronDevProcess.on('close', (code) => {
  console.log(`[dev] Electron dev exited with code ${code}`);
  if (!isShuttingDown) shutdown();
});
