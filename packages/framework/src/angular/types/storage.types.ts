/**
 * Tipo di storage per la persistenza dello stato.
 * - 'none'    → nessuna persistenza
 * - 'session' → sessionStorage (dura la sessione del browser/app)
 * - 'local'   → localStorage (persistente tra sessioni)
 */
export type StorageType = 'none' | 'session' | 'local';

/**
 * Configurazione globale della persistenza.
 * Fornita tramite il token EAF_STORAGE_CONFIG in FrameworkConfig.
 *
 * Gerarchia di risoluzione (da meno a più specifica):
 * 1. Default del componente: 'none'
 * 2. Config globale (questo oggetto)
 * 3. Input del singolo componente (ha la priorità)
 */
export interface EafStorageConfig {
  /** StorageType di default per ScrollRestorer standalone */
  scrollStorageType?: StorageType;
  /** StorageType di default per lo stato delle tabelle (colonne, sort, filtri, paginazione) */
  tableStateStorageType?: StorageType;
  /** StorageType di default per lo scroll delle tabelle */
  tableScrollStorageType?: StorageType;
}
