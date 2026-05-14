// Tipi condivisi tra Angular (componente EafTable) ed Electron (helper buildFindOptions).
// Vivono in `shared/` per essere accessibili da entrambi i lati senza duplicazione.

/**
 * Tipi di filtro supportati dalla colonna `EafColumnDef.filter`.
 * Vedi `EafFilterConfig` (in angular/types/eaf-table.types.ts) per la configurazione completa.
 */
export type EafFilterType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'select-distinct'
  | 'boolean'
  | 'custom';

/**
 * Stato di ordinamento corrente della tabella.
 * `direction === ''` indica nessun ordinamento attivo.
 */
export interface EafSortState {
  column: string;
  direction: 'asc' | 'desc' | '';
}

/**
 * Payload emesso da `EafTable` (output `serverEvent`) ogni volta che l'utente
 * cambia paginazione, ordinamento o filtri in modalità server-side.
 *
 * Il consumer lo passa al proprio Electron service che lo traduce in una query
 * TypeORM tramite `buildFindOptions(event, repo)`.
 */
export interface EafTableServerEvent {
  /** Ordinamento corrente. Assente o `direction === ''` = nessun sort. */
  sort?: EafSortState;
  /**
   * Mappa `columnKey -> valoreFiltro`. Il formato del valore dipende dal tipo:
   * - text:       string
   * - number:     { mode: 'equal', equal: number } | { mode: 'range', min?: number, max?: number }
   * - date:       { mode: 'equal', equal: ISOString } | { mode: 'range', from?: ISOString, to?: ISOString }
   * - select:     unknown | unknown[]  (singolo o multiplo)
   * - boolean:    boolean
   */
  filters: Record<string, unknown>;
  /** Indice pagina (0-based). */
  pageIndex: number;
  /** Numero di righe per pagina. */
  pageSize: number;
}

/**
 * Risultato standard di una query server-side, ritornato dai service Electron
 * e atteso dal componente `EafTable` quando in modalità server-side.
 */
export interface EafTableResult<T> {
  /** Righe della pagina corrente. */
  items: T[];
  /** Numero totale di righe che soddisfano i filtri (ignora paginazione). */
  total: number;
}
