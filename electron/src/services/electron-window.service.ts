import { BrowserWindow, BrowserWindowConstructorOptions, app } from 'electron';
import { Injectable } from '../helpers/mini-pie/decorators';
import { Logger } from '../helpers/logger';

export interface WindowConfig extends BrowserWindowConstructorOptions {
  /** Unique identifier for the window */
  id?: string;
}

/**
 * Base service for creating and managing Electron BrowserWindows.
 * Provides common utilities for window creation, tracking, and lifecycle management.
 */
@Injectable()
export class ElectronWindowService {
  private windows: Map<string, BrowserWindow> = new Map();
  private windowCounter = 0;

  /**
   * Creates a new BrowserWindow with the given configuration.
   * @param config Window configuration options
   * @returns The created BrowserWindow instance
   */
  createWindow(config: WindowConfig): BrowserWindow {
    const windowId = config.id ?? `window-${++this.windowCounter}`;

    const win = new BrowserWindow({
      ...config,
    });

    this.windows.set(windowId, win);

    win.on('closed', () => {
      this.windows.delete(windowId);
      Logger.debug(`[WindowService] Window "${windowId}" closed and removed from tracking`);
    });

    Logger.debug(`[WindowService] Window "${windowId}" created`);
    return win;
  }

  /**
   * Gets a tracked window by its ID.
   */
  getWindow(id: string): BrowserWindow | undefined {
    return this.windows.get(id);
  }

  /**
   * Checks if a window exists and is not destroyed.
   */
  isWindowValid(win: BrowserWindow | null | undefined): win is BrowserWindow {
    return win != null && !win.isDestroyed();
  }

  /**
   * Safely closes a window if it exists and is valid.
   */
  closeWindow(win: BrowserWindow | null | undefined): void {
    if (this.isWindowValid(win)) {
      win.close();
    }
  }

  /**
   * Closes a window by its ID.
   */
  closeWindowById(id: string): void {
    const win = this.windows.get(id);
    this.closeWindow(win);
  }

  /**
   * Gets all currently tracked windows.
   */
  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values()).filter(win => !win.isDestroyed());
  }

  /**
   * Closes all tracked windows.
   */
  closeAllWindows(): void {
    for (const win of this.getAllWindows()) {
      this.closeWindow(win);
    }
  }

  /**
   * Gets the application's base path.
   */
  getAppPath(): string {
    return app.getAppPath();
  }

  /**
   * Gets the resources path (useful for production builds).
   */
  getResourcesPath(): string {
    return process.resourcesPath;
  }
}
