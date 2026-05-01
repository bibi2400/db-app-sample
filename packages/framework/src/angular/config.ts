import { ApplicationConfig, LOCALE_ID, Provider, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, Routes } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import localeIt from '@angular/common/locales/it';

export interface FrameworkConfigOptions {
  /** Route Angular complete (stock + consumer, tipicamente da FrameworkRoutes.build()) */
  routes: Routes;
  /** Provider aggiuntivi del consumer (opzionale) */
  providers?: Provider[];
}

/**
 * Configurazione Angular del framework.
 * Registra il locale italiano e produce un `ApplicationConfig` pronto all'uso.
 */
export class FrameworkConfig {
  private readonly options: FrameworkConfigOptions;

  constructor(options: FrameworkConfigOptions) {
    this.options = options;

    // Inizializzazioni una-tantum
    registerLocaleData(localeIt);
  }

  /** Genera l'ApplicationConfig per `bootstrapApplication()` */
  toApplicationConfig(): ApplicationConfig {
    return {
      providers: [
        provideBrowserGlobalErrorListeners(),
        provideRouter(this.options.routes),
        provideAnimationsAsync(),
        provideHttpClient(withInterceptorsFromDi()),
        { provide: LOCALE_ID, useValue: 'it' },
        ...(this.options.providers ?? []),
      ]
    };
  }
}
