import { FrameworkConfig } from '@bibi2400/electron-angular-framework/angular';
import { routes } from './app.routes';

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
  storageConfig: {
    tableStateStorageType: 'local',    // stato tabelle (colonne, sort, filtri) → localStorage
    tableScrollStorageType: 'local', // scroll tabelle → localStorage
    scrollStorageType: 'local',      // ScrollRestorer standalone → localStorage
  },
});

export const appConfig = frameworkConfig.toApplicationConfig();
