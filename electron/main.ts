import { app, protocol } from 'electron';
import "reflect-metadata";
import { Logger } from "./src/helpers/logger";
import { Injector } from "./src/helpers/mini-pie/injector";
import { SERVICES } from "./src/services";
import { AppBootstrapService } from "./src/services/app-bootstrap.service";
import { ElectronProtocolService } from "./src/services/electron-protocol.service";
import { DevModeService } from "./src/services/dev-mode.service";

// Register protocol schemes as privileged BEFORE app.ready()
// This enables History API support (pushState, replaceState) for Angular routing
protocol.registerSchemesAsPrivileged(ElectronProtocolService.getPrivilegedSchemes());

// Main application entry point
app.whenReady().then(async () => {
  try {
    // Load all injectable services
    await Injector.load(SERVICES);

    const devMode = Injector.inject(DevModeService);
    if (devMode.isDev) {
      Logger.info("App is in dev mode")
    } else {
      Logger.info("App is in prod mode", process.argv.slice(1))
    }

    // Run bootstrap sequence
    const bootstrapService = Injector.inject(AppBootstrapService);
    await bootstrapService.bootstrap();

    Logger.info('✓ Application started successfully');
  } catch (error) {
    Logger.error('✗ Application failed to start:', error);
    app.quit();
  }
});

// Window close and app quit events are handled by LifecycleService
