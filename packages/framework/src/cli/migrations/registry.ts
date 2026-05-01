import { Migration } from './types';

// Importa le definizioni delle migrazioni qui
import { migration as m001 } from './definitions/001-runtime-config-to-consumer';
import { migration as m002 } from './definitions/002-styles-theme-mixin';
import { migration as m003 } from './definitions/003-eaf-background-mixin';

/**
 * Registry di tutte le migrazioni disponibili.
 * Aggiungere le nuove migrazioni IN FONDO all'array, mantenendo l'ordine cronologico.
 */
export const MIGRATIONS: Migration[] = [
  m001,
  m002,
  m003,
];
