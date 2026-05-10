import { Migration } from './types';

import { Migration001 } from './definitions/001-runtime-config-to-consumer';
import { Migration002 } from './definitions/002-styles-theme-mixin';
import { Migration003 } from './definitions/003-eaf-background-mixin';

/**
 * Registry di tutte le migrazioni disponibili.
 * Aggiungere le nuove migrazioni IN FONDO all'array, mantenendo l'ordine cronologico.
 */
export const MIGRATIONS: Migration[] = [
  new Migration001(),
  new Migration002(),
  new Migration003(),
];
