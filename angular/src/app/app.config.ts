import { FrameworkConfig } from '@bibi2400/electron-angular-framework/angular';
import { routes } from './app.routes';
import consumerConfig from '../../../eaf.config.json';

/**
 * Configurazione globale della persistenza.
 * Ogni valore è il default per tutta l'app; può essere sovrascritto
 * componente per componente tramite gli input tableStateStorageType,
 * tableScrollStorageType e storageType.
 *
 * Esempi di override locali:
 *   <eaf-table tableStateStorageType="session" ... />
 *   <eaf-table tableScrollStorageType="none" ... />
 *   <eaf-scroll-restorer storageType="local" />
 */
const frameworkConfig = new FrameworkConfig({
  routes,
  databaseUi: consumerConfig.databaseUi,
  notificationConfig: {
    persistHistory: true, // false: history exists only while the application is open
    maxHistory: 500,
    maxVisibleToasts: 3,
  },
  storageConfig: {
    tableStateStorageType: 'local',    // stato tabelle (colonne, sort, filtri) → localStorage
    tableScrollStorageType: 'local', // scroll tabelle → localStorage
    scrollStorageType: 'local',      // ScrollRestorer standalone → localStorage
  },
});

export const appConfig = frameworkConfig.toApplicationConfig();
