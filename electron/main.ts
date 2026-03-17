import "reflect-metadata";
import { app, BrowserWindow, ipcMain, net, protocol } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { autoUpdater } from 'electron-updater';
import { registerAllControllers } from './src/controllers';
import { AppDataSource } from './src/db/data-source';
import { BackupService } from "./src/services/backup.service";
import { RUNTIME_CONFIG } from './src/config/runtime-config';
import { Logger } from "./src/helpers/logger";

let win: BrowserWindow | null;
let splash: BrowserWindow | null;
let loadedUrl: string | null = null; // URL per dev mode
let indexFilePath: string | null = null; // Path del file index.html per reload in prod

const args = process.argv.slice(1);
const serve = args.some(val => val === '--serve');

const pkg = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf-8'));

const appConfig = {
  name: pkg.build?.productName || pkg.name,
  slug: pkg.name,
  mainWindow: {
    width: 1200,
    height: 800,
  },
  splashScreen: {
    width: 600,
    height: 400,
  }
}


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

autoUpdater.autoDownload = true; // scarica solo se l'utente accetta

app.whenReady().then(async () => {
  // Registra protocollo custom per servire file locali senza hash routing
  protocol.handle('app', (request) => {
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
    const distPath = path.join(basePath, 'dist', appConfig.slug, 'browser');
    let filePath = path.join(distPath, pathname);

    // Se è una route Angular (non un file fisico), serve index.html
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distPath, 'index.html');
    }

    return net.fetch(filePath);
  });

  autoUpdater.checkForUpdates().then((updateCheckResult) => {
    Logger.info('Update check completed:', updateCheckResult);
    if (updateCheckResult?.isUpdateAvailable) {
      Logger.info('New version available:', updateCheckResult.updateInfo.version);
      // Il download parte automaticamente grazie ad autoDownload = true
      // quitAndInstall verrà chiamato da update-downloaded
    }
  }).catch((err) => {
    Logger.error('Errore durante il controllo degli aggiornamenti:', err);
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

// Gestione aggiornamenti
// Nuovo aggiornamento disponibile
autoUpdater.on('update-available', (info) => {
  Logger.info('Aggiornamento disponibile:', info);
});

// Nessun aggiornamento disponibile
autoUpdater.on('update-not-available', () => {
  Logger.info('App is up to date.');
});

// Progresso download
autoUpdater.on('download-progress', (progress) => {
  Logger.info(`Download progress: ${progress.percent.toFixed(2)}%`);
});

autoUpdater.on('update-downloaded', () => {
  Logger.info('Update downloaded, installing...');
  autoUpdater.quitAndInstall(false, true);
});

// Errore
autoUpdater.on('error', (error) => {
  Logger.error('Update error:', error);
});

// Nuovo aggiornamento disponibile
autoUpdater.setFeedURL({
  provider: 'github',
  owner: pkg.publish?.owner ?? '',
  repo: pkg.publish?.repo ?? pkg.name,
  private: true,
  token: RUNTIME_CONFIG.GH_TOKEN,
});

//// Functions

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
      Logger.info('Dev server is ready!');
      return;
    } catch (error) {
      Logger.info(`Waiting for dev server... (attempt ${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Dev server did not start in time');
}

function createSplashScreen() {
  splash = new BrowserWindow({
    width: appConfig.splashScreen.width,
    height: appConfig.splashScreen.height,
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
    Logger.error('Failed to load splash:', err);
  });
}

async function createWindow() {
  win = new BrowserWindow({
    width: appConfig.mainWindow.width,
    height: appConfig.mainWindow.height,
    title: appConfig.name,
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
    Logger.info('✓ Window ready to show');
    setTimeout(() => {
      if (splash && !splash.isDestroyed()) {
        splash.close();
        splash = null;
        Logger.info('✓ Splash closed');
      }
      if (win && !win.isDestroyed()) {
        win.show();
        win.focus();
        Logger.info('✓ Main window shown');
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
    Logger.info('=== LOADING APP ===');
    Logger.info('Loading URL:', appUrl);
    await win.loadURL(appUrl);
    Logger.info('✓ App loaded successfully');
  }

  win.on('closed', () => { win = null; });
}

async function initializeApp() {
  try {
    Logger.info('=== STARTING DATABASE INITIALIZATION ===');
    Logger.info('Process resource path:', process.resourcesPath);
    Logger.info('__dirname:', __dirname);

    await AppDataSource.initialize();
    Logger.info("✓ Connessione a SQLite stabilita.");

    registerAllControllers();
    Logger.info("✓ Controllers registered");

    // TODO: make this a controller
    // Registra l'handler per il reload dell'app
    ipcMain.handle('app:reload', async () => {
      if (win && !win.isDestroyed()) {
        Logger.info('Reloading app...');
        if (serve && loadedUrl) {
          win.reload();
        } else if (indexFilePath) {
          Logger.info('Reloading from:', indexFilePath);
          await win.loadURL(indexFilePath);
        }
      }
    });
    Logger.info("✓ App handlers registered");

    const backupService = new BackupService();
    await backupService.autoBackup();
    Logger.info("✓ Startup backup completed");

    Logger.info('=== DATABASE INITIALIZATION COMPLETED ===');
  } catch (error) {
    Logger.error("✗ ERRORE inizializzazione database:", error);
    if (error instanceof Error) {
      Logger.error("Error stack:", error.stack);
    }
  }
}
