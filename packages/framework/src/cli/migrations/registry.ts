import { Migration } from './types';

// Importa le definizioni delle migrazioni qui
import { migration as m001 } from './definitions/001-runtime-config-to-consumer';

/**
 * Registry di tutte le migrazioni disponibili.
 * Aggiungere le nuove migrazioni IN FONDO all'array, mantenendo l'ordine cronologico.
 */
export const MIGRATIONS: Migration[] = [
  m001,
];
