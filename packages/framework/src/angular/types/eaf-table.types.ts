import { Observable, Subject } from 'rxjs';
import { TemplateRef } from '@angular/core';

// ─── Column Filter Types ─────────────────────────────────────────────────────

export type EafFilterType = 'text' | 'number' | 'date' | 'select' | 'select-distinct' | 'boolean' | 'custom';

export interface EafSelectOption {
  value: unknown;
  label: string;
}

/**
 * Opzione per filtro 'select' con predicato custom.
 * Ogni opzione definisce una funzione che filtra le righe.
 * Utile per filtri semantici: "Scaduti", "In scadenza", "Attivi", ecc.
 */
export interface EafSelectPredicateOption<T = unknown> {
  /** Valore identificativo dell'opzione (serializzato nello state) */
  value: string;
  /** Label mostrata nel dropdown */
  label: string;
  /** Funzione predicato: ritorna true se la riga passa il filtro */
  filterFn: (row: T) => boolean;
}

export interface EafFilterConfig {
  /** Tipo di filtro auto-generato */
  type: EafFilterType;

  /**
   * Per filtro 'number' e 'date': modalità abilitate.
   * Default: ['equal', 'range'] (entrambe).
   * Es. ['equal'] per mostrare solo il campo uguale, ['range'] per solo min/max o da/a.
   */
  modes?: ('equal' | 'range')[];

  /**
   * Per filtro 'select' e 'select-distinct': abilita selezione multipla.
   * Default: false (selezione singola).
   */
  multiple?: boolean;

  /**
   * Per filtro 'select' e 'select-distinct': abilita ricerca autocomplete nel dropdown.
   * Default: false.
   */
  autocomplete?: boolean;

  /**
   * Per filtro 'select-distinct': opzioni statiche.
   * Se non fornite, vengono estratte automaticamente dai dati della colonna.
   */
  options?: EafSelectOption[];

  /**
   * Per filtro 'select-distinct': caricamento opzioni da endpoint esterno.
   * Ha priorità su `options` e sull'estrazione automatica.
   */
  loadOptions?: () => Observable<EafSelectOption[]> | Promise<EafSelectOption[]>;

  /**
   * Per filtro 'select': opzioni con predicato custom.
   * Ogni opzione ha una funzione filterFn che riceve la riga e ritorna boolean.
   */
  predicateOptions?: EafSelectPredicateOption<any>[];
}

// ─── Column Definition ───────────────────────────────────────────────────────

export interface EafColumnDef<T = unknown> {
  /** Chiave della proprietà nell'oggetto dati (usata come columnDef di mat-table) */
  key: string & keyof T | string;

  /** Header della colonna */
  header: string;

  /**
   * Larghezza in flex (numero) o CSS (es. '200px', '20%').
   * Default: 1 (flex equidistribuito)
   */
  width?: number | string;

  /** La colonna è ordinabile. Default: true */
  sortable?: boolean;

  /**
   * Configurazione filtro. `false` = nessun filtro (default).
   * `true` = filtro testo automatico.
   * Oppure un `EafFilterConfig` per specificare tipo e opzioni.
   */
  filter?: boolean | EafFilterConfig;

  /** La colonna è visibile. Default: true */
  visible?: boolean;

  /** Funzione custom per estrarre il valore dalla riga (utile per colonne calcolate) */
  valueGetter?: (row: T) => unknown;

  /** Funzione custom di ordinamento */
  sortFn?: (a: T, b: T) => number;

  /** Funzione custom di filtro per questa colonna */
  filterFn?: (row: T, filterValue: unknown) => boolean;

  /** Colonna sticky (fissa a sinistra o destra) */
  sticky?: 'start' | 'end';
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface EafPaginationConfig {
  /** Abilita la paginazione. Default: false */
  enabled: boolean;

  /** Dimensione pagina iniziale. Default: 10 */
  pageSize?: number;

  /** Opzioni dimensione pagina. Default: [5, 10, 25, 50, 100] */
  pageSizeOptions?: number[];

  /** Mostra il selettore "prima/ultima pagina". Default: true */
  showFirstLastButtons?: boolean;
}

export interface EafPageEvent {
  pageIndex: number;
  pageSize: number;
  /** Numero totale di righe (utile per server-side) */
  totalRows: number;
}

// ─── Selection ───────────────────────────────────────────────────────────────

export type EafSelectionMode = 'none' | 'single' | 'multiple';

// ─── Sort ────────────────────────────────────────────────────────────────────

export interface EafSortState {
  column: string;
  direction: 'asc' | 'desc' | '';
}

// ─── Filter State ────────────────────────────────────────────────────────────

export interface EafFilterValue {
  /** Chiave della colonna */
  column: string;
  /** Valore del filtro (tipo dipende dal filtro) */
  value: unknown;
}

// ─── Persisted State ─────────────────────────────────────────────────────────

/** Stato persistito di una singola colonna */
export interface EafColumnState {
  /** Chiave della colonna */
  key: string;
  /** Ordine di visualizzazione (0-based) */
  order: number;
  /** Se la colonna è visibile */
  visible: boolean;
}

export interface EafTableState {
  /** Stato delle colonne (ordine + visibilità) */
  columns?: EafColumnState[];

  /** Stato ordinamento attivo */
  sort?: EafSortState;

  /** Filtri attivi */
  filters?: Record<string, unknown>;

  /** Dimensione pagina */
  pageSize?: number;

  /** Posizione scroll verticale (salvata solo se saveScrollPosition è abilitato) */
  scrollTop?: number;
}

// ─── Server-Side Events ──────────────────────────────────────────────────────

export interface EafTableServerEvent {
  sort?: EafSortState;
  filters: Record<string, unknown>;
  pageIndex: number;
  pageSize: number;
}

// ─── Template Context ────────────────────────────────────────────────────────

export interface EafCellContext<T = unknown> {
  /** Riga corrente */
  $implicit: T;
  /** Valore della cella */
  value: unknown;
  /** Chiave della colonna */
  column: string;
}

export interface EafFilterContext {
  /** Chiave della colonna */
  $implicit: string;
  /** Valore corrente del filtro */
  value: unknown;
  /** Subject per emettere cambiamenti del filtro */
  filterChange: Subject<unknown>;
}

export interface EafActionsContext<T = unknown> {
  /** Riga corrente */
  $implicit: T;
}
