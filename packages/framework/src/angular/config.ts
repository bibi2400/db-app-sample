import {
  ApplicationConfig,
  InjectionToken,
  LOCALE_ID,
  Provider,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, Routes } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import localeIt from '@angular/common/locales/it';
import { EafStorageConfig } from './types/storage.types';
import { NotificationConfig } from './types/notification';
import { DatabaseUiConfig } from './types/database-ui';

export type { EafStorageConfig } from './types/storage.types';

/** Token di iniezione per la configurazione globale della persistenza. */
export const EAF_STORAGE_CONFIG = new InjectionToken<EafStorageConfig>('EAF_STORAGE_CONFIG');

export const EAF_NOTIFICATION_CONFIG = new InjectionToken<NotificationConfig>('EAF_NOTIFICATION_CONFIG');

export const EAF_DATABASE_UI_CONFIG = new InjectionToken<DatabaseUiConfig>('EAF_DATABASE_UI_CONFIG', {
  providedIn: 'root',
  factory: () => ({}),
});

export interface FrameworkConfigOptions {
  /** Route Angular complete (stock + consumer, tipicamente da FrameworkRoutes.build()) */
  routes: Routes;
  /** Provider aggiuntivi del consumer (opzionale) */
  providers?: Provider[];
  /**
   * Configurazione globale della persistenza (localStorage/sessionStorage).
   * Può essere sovrascritto a livello di singolo componente tramite i suoi input.
   */
  storageConfig?: EafStorageConfig;
  /** Notification history persistence and toast limits. */
  notificationConfig?: NotificationConfig;
  /** Visibility of database administration controls; the internal database remains active. */
  databaseUi?: DatabaseUiConfig;
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
    const storageProviders: Provider[] = this.options.storageConfig
      ? [{ provide: EAF_STORAGE_CONFIG, useValue: this.options.storageConfig }]
      : [];

    return {
      providers: [
        provideBrowserGlobalErrorListeners(),
        provideRouter(this.options.routes),
        provideAnimationsAsync(),
        provideHttpClient(withInterceptorsFromDi()),
        { provide: LOCALE_ID, useValue: 'it' },
        ...storageProviders,
        {
          provide: EAF_NOTIFICATION_CONFIG,
          useValue: this.options.notificationConfig ?? {},
        },
        {
          provide: EAF_DATABASE_UI_CONFIG,
          useValue: this.options.databaseUi ?? {},
        },
        ...(this.options.providers ?? []),
      ]
    };
  }
}
