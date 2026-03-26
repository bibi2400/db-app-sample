import { app, BrowserWindow } from "electron";
import { execSync } from "child_process";
import { Injectable } from "../helpers/mini-pie/decorators";
import { Logger } from "../helpers/logger";
import { AppDataSource } from "../db/data-source";
import { DevModeService } from "./dev-mode.service";

type CleanupCallback = () => void | Promise<void>;

/**
 * Service that manages application lifecycle and graceful shutdown.
 * Handles cleanup of resources when the main window is closed.
 * Works in both dev and production modes.
 */
@Injectable()
export class LifecycleService {
  private win: BrowserWindow | null = null;
  private isQuitting = false;
  private cleanupCallbacks: CleanupCallback[] = [];

  constructor(private readonly devModeService: DevModeService) {}

  /**
   * Initialize the lifecycle service with the main window.
   * Sets up all necessary event listeners for graceful shutdown.
   */
  init(win: BrowserWindow): void {
    this.win = win;

    this.setupWindowEvents();
    this.setupAppEvents();

    Logger.info(`✓ LifecycleService initialized (mode: ${this.devModeService.isDev ? 'dev' : 'prod'})`);
  }

  /**
   * Register a cleanup callback to be called during shutdown.
   * Callbacks are executed in the order they were registered.
   */
  onCleanup(callback: CleanupCallback): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Trigger application quit programmatically.
   */
  quit(): void {
    Logger.info('[Lifecycle] Quit requested');
    this.isQuitting = true;
    app.quit();
  }

  private setupWindowEvents(): void {
    if (!this.win) return;

    // Handle window close event
    this.win.on('close', (event) => {
      if (!this.isQuitting) {
        Logger.info('[Lifecycle] Window close requested');
        // In dev mode, we might want to confirm before closing
        // For now, just proceed with quit
        this.isQuitting = true;

        // Prevent default close to handle cleanup first
        event.preventDefault();
        this.performCleanup().then(() => {
          if (this.devModeService.isDev) {
            // In dev mode, force process exit to stop nodemon
            Logger.info('[Lifecycle] Dev mode: forcing process exit');
            process.exit(0);
          } else {
            app.quit();
          }
        });
      }
    });

    // Handle window closed event (after window is destroyed)
    this.win.on('closed', () => {
      Logger.info('[Lifecycle] Window closed');
      this.win = null;
    });
  }

  private setupAppEvents(): void {
    // Handle all windows closed
    app.on('window-all-closed', () => {
      Logger.info('[Lifecycle] All windows closed');
      if (process.platform !== 'darwin') {
        this.isQuitting = true;
        app.quit();
      }
    });

    // Handle before-quit event for final cleanup
    app.on('before-quit', async (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.isQuitting = true;
        await this.performCleanup();
        if (this.devModeService.isDev) {
          process.exit(0);
        } else {
          app.quit();
        }
      }
    });

    // Handle app quit
    app.on('quit', () => {
      Logger.info('[Lifecycle] Application quit');
    });

    // Handle unexpected errors
    process.on('uncaughtException', (error) => {
      Logger.error('[Lifecycle] Uncaught exception:', error);
      this.emergencyShutdown();
    });

    process.on('unhandledRejection', (reason) => {
      Logger.error('[Lifecycle] Unhandled rejection:', reason);
    });

    // Handle SIGINT (Ctrl+C) - especially important in dev mode
    process.on('SIGINT', () => {
      Logger.info('[Lifecycle] SIGINT received');
      this.quit();
    });

    // Handle SIGTERM
    process.on('SIGTERM', () => {
      Logger.info('[Lifecycle] SIGTERM received');
      this.quit();
    });
  }

  private async performCleanup(): Promise<void> {
    Logger.info('[Lifecycle] Starting cleanup...');

    // Execute all registered cleanup callbacks
    for (const callback of this.cleanupCallbacks) {
      try {
        await callback();
      } catch (error) {
        Logger.error('[Lifecycle] Cleanup callback error:', error);
      }
    }

    // Close database connection
    await this.closeDatabase();

    // Close dev tools if open (dev mode)
    if (this.devModeService.isDev && this.win && !this.win.isDestroyed()) {
      try {
        this.win.webContents.closeDevTools();
      } catch {
        // Ignore errors when closing dev tools
      }
    }

    // In dev mode, kill parent process (concurrently/nodemon) to stop all dev processes
    if (this.devModeService.isDev) {
      this.killParentProcessGroup();
    }

    Logger.info('[Lifecycle] Cleanup completed');
  }

  /**
   * Kill the parent process group to stop concurrently and nodemon in dev mode.
   * This ensures all dev server processes are terminated when electron closes.
   */
  private killParentProcessGroup(): void {
    try {
      Logger.info('[Lifecycle] Killing parent process group (dev mode)');

      // Get parent process ID (concurrently or nodemon)
      const ppid = process.ppid;

      if (ppid && ppid > 1) {
        // On Unix-like systems, we can kill the process group
        // The negative PID sends signal to the entire process group
        if (process.platform !== 'win32') {
          try {
            // Try to kill the process group first
            process.kill(-ppid, 'SIGTERM');
          } catch {
            // If process group kill fails, try killing parent directly
            process.kill(ppid, 'SIGTERM');
          }
        } else {
          // On Windows, kill the entire process tree using taskkill
          // SIGTERM/process.kill only terminates a single process on Windows,
          // leaving child processes (tsc, ng serve, etc.) orphaned
          try {
            execSync(`taskkill /F /T /PID ${ppid}`, { stdio: 'ignore' });
          } catch {
            // Fallback: try killing the single process
            process.kill(ppid, 'SIGTERM');
          }
        }
        Logger.info(`[Lifecycle] Sent SIGTERM to parent process ${ppid}`);
      }
    } catch (error) {
      Logger.warn('[Lifecycle] Could not kill parent process:', error);
      // Force exit if we can't kill parent - this will still cause concurrently to stop
      // if it's configured with --kill-others-on-fail
    }
  }

  private async closeDatabase(): Promise<void> {
    try {
      if (AppDataSource.instance.isInitialized) {
        await AppDataSource.instance.destroy();
        Logger.info('[Lifecycle] Database connection closed');
      }
    } catch (error) {
      Logger.error('[Lifecycle] Error closing database:', error);
    }
  }

  private emergencyShutdown(): void {
    Logger.error('[Lifecycle] Emergency shutdown initiated');

    // Try to close database synchronously-ish
    try {
      if (AppDataSource.instance.isInitialized) {
        AppDataSource.instance.destroy().catch(() => {});
      }
    } catch {
      // DataSource may not have been initialized
    }

    // Force exit after a short delay
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
}
