/**
 * Custom dev script for Electron with proper process management.
 * - Watches TypeScript files and recompiles on change
 * - Restarts Electron after successful compilation
 * - Terminates all processes when Electron is closed by the user
 */

const { spawn, execSync } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';
let electronProcess = null;
let isShuttingDown = false;
let outputBuffer = '';

/**
 * Kill a process and its entire tree.
 * On Windows, uses taskkill /T to kill the tree since SIGTERM only kills the direct process.
 */
function killProcessTree(childProcess) {
  if (!childProcess || !childProcess.pid) return;
  const pid = childProcess.pid;
  try {
    if (isWindows) {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      childProcess.kill('SIGTERM');
    }
  } catch {
    // Process may have already exited
  }
}

// Start tsc in watch mode
const tscProcess = spawn('npx', ['tsc', '-p', 'electron/tsconfig.json', '--watch', '--preserveWatchOutput'], {
  stdio: ['inherit', 'pipe', 'inherit'],
  shell: true
});

console.log('[dev] TypeScript watch started');

// Listen for tsc output to detect successful compilation
tscProcess.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);

  // Buffer output to handle partial messages
  outputBuffer += output;

  // Check if compilation was successful (Found 0 errors appears at end of successful build)
  if (outputBuffer.includes('Found 0 errors')) {
    outputBuffer = ''; // Reset buffer
    if (!isShuttingDown) {
      restartElectron();
    }
  }

  // Clear buffer on new compilation start to avoid stale matches
  if (output.includes('File change detected') || output.includes('Starting compilation')) {
    outputBuffer = '';
  }
});

function restartElectron() {
  // Kill existing electron process if running
  if (electronProcess) {
    console.log('[dev] Stopping Electron for restart...');
    const oldProcess = electronProcess;
    electronProcess = null; // Clear reference first to prevent shutdown trigger
    killProcessTree(oldProcess);

    // Wait a bit for the process to fully terminate (longer on Windows)
    setTimeout(() => {
      startElectron();
    }, isWindows ? 1000 : 300);
  } else {
    startElectron();
  }
}

function startElectron() {
  if (isShuttingDown) return;

  console.log('[dev] Starting Electron...');

  const electronPath = require('electron');
  const extraArgs = process.argv.slice(2);
  electronProcess = spawn(electronPath, ['--inspect=9229', '.', '--serve', ...extraArgs], {
    stdio: 'inherit',
  });

  electronProcess.on('close', (code) => {
    console.log(`[dev] Electron exited with code ${code}`);

    // Only trigger shutdown if this was a user-initiated close (not a restart)
    if (electronProcess !== null) {
      electronProcess = null;

      // If electron exits normally (user closed the window), shutdown everything
      if (code === 0 && !isShuttingDown) {
        console.log('[dev] Electron closed normally, shutting down dev environment...');
        shutdown();
      }
    }
  });

  electronProcess.on('error', (err) => {
    console.error('[dev] Failed to start Electron:', err);
  });
}

function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('[dev] Shutting down...');

  killProcessTree(electronProcess);
  killProcessTree(tscProcess);

  // Force exit after a short delay
  setTimeout(() => {
    process.exit(0);
  }, isWindows ? 1000 : 500);
}

// Handle process signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

tscProcess.on('close', (code) => {
  console.log(`[dev] TypeScript watch exited with code ${code}`);
  if (!isShuttingDown) {
    shutdown();
  }
});
