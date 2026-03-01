import "reflect-metadata";

import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { registerAllControllers } from './src/controllers';
import { AppDataSource, getDbPath } from './src/db/data-source';
import { BackupService } from "./src/services/backup.service";

let win: BrowserWindow | null;
let splash: BrowserWindow | null;
let loadedUrl: string | null = null; // URL per dev mode
let indexFilePath: string | null = null; // Path del file index.html per reload in prod

const args = process.argv.slice(1);
const serve = args.some(val => val === '--serve');

// Registra il protocollo come privilegiato PRIMA di app.ready()
// Questo permette l'uso della History API (pushState, replaceState)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

async function waitForDevServer(url: string, maxAttempts = 30): Promise<void> {
  const http = await import('http');

  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        http.get(url, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Status: ${res.statusCode}`));
          }
        }).on('error', reject);
      });
      console.log('Dev server is ready!');
      return;
    } catch (error) {
      console.log(`Waiting for dev server... (attempt ${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Dev server did not start in time');
}

function createSplashScreen() {
  splash = new BrowserWindow({
    width: 600,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const splashPath = serve
    ? path.join(__dirname, '../../src/assets/splash.html')
    : path.join(process.resourcesPath, 'splash.html');

  splash.loadFile(splashPath).catch((err) => {
    console.error('Failed to load splash:', err);
  });
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'KATO Quality Manager',
    icon: path.join(__dirname, '../../src/assets/icon.png'),
    show: false, // Non mostrare subito, mostra dopo splash screen
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Registra l'evento PRIMA di caricare la pagina
  win.once('ready-to-show', () => {
    console.log('✓ Window ready to show');
    setTimeout(() => {
      if (splash && !splash.isDestroyed()) {
        splash.close();
        splash = null;
        console.log('✓ Splash closed');
      }
      if (win && !win.isDestroyed()) {
        win.show();
        win.focus();
        console.log('✓ Main window shown');
      }
    }, 300);
  });

  // Blocca completamente TUTTE le navigazioni dopo il caricamento iniziale
  // Angular gestisce il routing internamente, Electron non deve seguire i cambi di URL
  let initialLoadComplete = false;

  win.webContents.on('did-finish-load', () => {
    initialLoadComplete = true;
  });

  win.webContents.on('will-navigate', (event, url) => {
    // Dopo il caricamento iniziale, blocca tutte le navigazioni
    // Angular cambia l'URL ma non deve triggerare una nuova navigazione di Electron
    if (initialLoadComplete) {
      event.preventDefault();
    }
  });

  if (serve) {
    await waitForDevServer('http://localhost:4202');
    loadedUrl = 'http://localhost:4202';
    win.loadURL(loadedUrl);
    win.webContents.openDevTools();
  } else {
    // In produzione, usa il protocollo custom 'app://' per routing senza hash
    const appUrl = 'app://./';
    indexFilePath = appUrl; // Salva per i reload
    console.log('=== LOADING APP ===');
    console.log('Loading URL:', appUrl);
    await win.loadURL(appUrl);
    console.log('✓ App loaded successfully');
  }

  win.on('closed', () => { win = null; });
}

async function initializeApp() {
  try {
    console.log('=== STARTING DATABASE INITIALIZATION ===');
    console.log('Process resource path:', process.resourcesPath);
    console.log('__dirname:', __dirname);

    await AppDataSource.initialize();
    console.log("✓ Connessione a SQLite stabilita.");

    registerAllControllers();
    console.log("✓ Controllers registered");

    // Registra l'handler per il reload dell'app
    ipcMain.handle('app:reload', async () => {
      if (win && !win.isDestroyed()) {
        console.log('Reloading app...');
        if (serve && loadedUrl) {
          win.reload();
        } else if (indexFilePath) {
          console.log('Reloading from:', indexFilePath);
          await win.loadURL(indexFilePath);
        }
      }
    });
    console.log("✓ App handlers registered");

    const backupService = new BackupService();
    await backupService.autoBackup();
    console.log("✓ Startup backup completed");

    console.log('=== DATABASE INITIALIZATION COMPLETED ===');
  } catch (error) {
    console.error("✗ ERRORE inizializzazione database:", error);
    if (error instanceof Error) {
      console.error("Error stack:", error.stack);
    }
  }
}

app.whenReady().then(async () => {
  // Registra protocollo custom per servire file locali senza hash routing
  protocol.registerFileProtocol('app', (request, callback) => {
    // Parse URL correttamente per gestire pathnames
    const url = new URL(request.url);
    let pathname = url.pathname;

    // Rimuovi lo slash iniziale
    if (pathname.startsWith('/')) {
      pathname = pathname.substring(1);
    }

    // Se pathname è vuoto o è solo './', servi index.html
    if (!pathname || pathname === './' || pathname === '.') {
      pathname = 'index.html';
    }

    const basePath = app.getAppPath();
    const distPath = path.join(basePath, 'dist', 'mighty-quality-manager', 'browser');
    let filePath = path.join(distPath, pathname);

    // Se è una route Angular (non un file fisico), serve index.html
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distPath, 'index.html');
    }

    callback({ path: filePath });
  });

  // Inizializza il database DOPO che l'app è pronta
  await initializeApp();

  createSplashScreen();
  // Aspetta un attimo per mostrare la splash prima di caricare tutto
  setTimeout(() => {
    createWindow();
  }, 100);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});