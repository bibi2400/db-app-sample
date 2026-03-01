import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';

import { routes } from './app.routes';

// Register Italian locale
registerLocaleData(localeIt);

// Register ag-Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes), // Rimosso withHashLocation() per routing normale
    { provide: LOCALE_ID, useValue: 'it' }
  ]
};
