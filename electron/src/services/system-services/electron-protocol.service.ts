import { net, protocol } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Injectable } from '../../helpers/mini-pie/decorators';
import { Logger } from '../../helpers/logger';
import { AppConfigService } from './app-config.service';

/**
 * Service that manages Electron's custom protocol for serving local files.
 * Enables Angular SPA routing without hash routing by serving index.html
 * for all non-file routes.
 * 
 * NOTE: `protocol.registerSchemesAsPrivileged` must be called BEFORE app.ready()
 * and cannot be in a service. Use the static method `getPrivilegedSchemes()` 
 * in main.ts before app.ready().
 */
@Injectable()
export class ElectronProtocolService {
  constructor(private readonly appConfigService: AppConfigService) {}

  /**
   * Returns the scheme configuration that must be registered
   * BEFORE app.ready() using protocol.registerSchemesAsPrivileged().
   * Call this static method from main.ts.
   */
  static getPrivilegedSchemes(): Electron.CustomScheme[] {
    return [
      {
        scheme: 'app',
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          corsEnabled: true,
        },
      },
    ];
  }

  /**
   * Registers the protocol handler for serving local files.
   * Must be called AFTER app.ready() and after services are loaded.
   */
  registerHandler(): void {
    protocol.handle('app', (request) => this.handleRequest(request));
    Logger.info('[Protocol] Custom "app://" protocol handler registered');
  }

  /**
   * Handles incoming protocol requests.
   * Serves static files or falls back to index.html for SPA routing.
   */
  private handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    let pathname = url.pathname;

    // Remove leading slash
    if (pathname.startsWith('/')) {
      pathname = pathname.substring(1);
    }

    // If pathname is empty or root, serve index.html
    if (!pathname || pathname === './' || pathname === '.') {
      pathname = 'index.html';
    }

    const distPath = this.appConfigService.getDistPath();
    let filePath = path.join(distPath, pathname);

    // If it's an Angular route (not a physical file), serve index.html
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distPath, 'index.html');
    }

    return net.fetch(filePath);
  }
}
