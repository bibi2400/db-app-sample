import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import "reflect-metadata";
import { Logger } from "./src/helpers/logger";
import { Injector } from "./src/helpers/mini-pie/injector";
import { SERVICES } from "./src/services";
import { AppBootstrapService } from "./src/services/app-bootstrap.service";

// Main application entry point (async to support dynamic import of ESM-only packages)
async function main() {
  // electron-serve: must be initialized before app.ready()
  // (handles registerSchemesAsPrivileged internally via queueMicrotask)
  const { default: serve } = await import('electron-serve');
  const pkg = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf-8'));
  serve({ directory: `dist/${pkg.name}/browser` });

  await app.whenReady();

  try {
    // Load all injectable services
    await Injector.load(SERVICES);

    // Run bootstrap sequence
    const bootstrapService = Injector.inject(AppBootstrapService);
    await bootstrapService.bootstrap();

    Logger.info('✓ Application started successfully');
  } catch (error) {
    Logger.error('✗ Application failed to start:', error);
    app.quit();
  }
}

main();

// Window close and app quit events are handled by LifecycleService
