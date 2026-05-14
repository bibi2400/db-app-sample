import { SelectionModel } from '@angular/cdk/collections';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  effect,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
  TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import { EAF_STORAGE_CONFIG } from '../../config';
import { StorageType } from '../../types/storage.types';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import {
  MatPaginator,
  MatPaginatorModule,
  PageEvent,
} from '@angular/material/paginator';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { isObservable, Observable, Subject, Subscription } from 'rxjs';

import {
  EafActionsDefDirective,
  EafCellDefDirective,
  EafFilterDefDirective,
} from '../../directives/eaf-table.directives';
import { EafTableStorageService } from '../../services/eaf-table-storage.service';
import {
  EafColumnDef,
  EafColumnState,
  EafFilterConfig,
  EafFilterType,
  EafPaginationConfig,
  EafSelectionMode,
  EafSortState,
  EafTableServerEvent,
  EafTableState,
} from '../../types/eaf-table.types';
import { EafTableFilter } from '../eaf-table-filter/eaf-table-filter';
import { ScrollRestorer } from '../scroll-restorer/scroll-restorer';

@Component({
  selector: 'eaf-table',
  imports: [
    NgClass,
    NgTemplateOutlet,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatCheckboxModule,
    MatIconModule,
    MatButtonModule,
    DragDropModule,
    EafTableFilter,
    ScrollRestorer,
  ],
  templateUrl: './eaf-table.html',
  styleUrl: './eaf-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EafTable<T = unknown> implements OnInit, OnDestroy {
  private readonly storageService = inject(EafTableStorageService);
  private readonly globalStorageConfig = inject(EAF_STORAGE_CONFIG, {
    optional: true,
  });

  // ─── Inputs ──────────────────────────────────────────────────────────────

  /** ID univoco della tabella, usato come chiave nel localStorage */
  readonly tableId = input.required<string>();

  /** Definizioni delle colonne */
  readonly columns = input.required<EafColumnDef<T>[]>();

  /** Dati: array statico o Observable */
  readonly data = input<T[] | Observable<T[]>>([]);

  /**
   * StorageType per lo scroll della tabella.
   * `null` → usa il valore da EAF_STORAGE_CONFIG.tableScrollStorageType (default: 'none').
   */
  readonly tableScrollStorageType = input<StorageType | null>(null);

  /**
   * StorageType per lo stato della tabella (colonne, sort, filtri, paginazione).
   * `null` → usa il valore da EAF_STORAGE_CONFIG.tableStateStorageType (default: 'none').
   */
  readonly tableStateStorageType = input<StorageType | null>(null);

  /** Altezza della tabella */
  readonly height = input<string | null>(null);

  /**
   * Configurazione paginazione.
   * - `null` / omesso / `false` → nessuna paginazione (mostra tutte le righe)
   * - `true` → paginazione con default
   * - oggetto `EafPaginationConfig` → configurazione custom
   */
  readonly pagination = input<EafPaginationConfig | boolean | null>(null);

  /** Modalità di selezione righe */
  readonly selectionMode = input<EafSelectionMode>('none');

  /** Colonne spostabili via drag & drop */
  readonly draggable = input(false);

  /** Header sticky */
  readonly stickyHeader = input(true);

  /** Messaggio per tabella vuota */
  readonly emptyMessage = input('Nessun dato disponibile');

  /**
   * Modalità server-side: la tabella non filtra/ordina/pagina i dati,
   * ma emette eventi affinché il consumer li gestisca.
   */
  readonly serverSide = input(false);

  /**
   * Totale righe per paginazione server-side.
   * In client-side viene calcolato automaticamente.
   */
  readonly serverTotalRows = input<number | null>(null);

  /**
   * Stato iniziale della tabella (ha priorità su localStorage).
   * Usalo per impostare filtri/sort/paginazione dall'esterno.
   */
  readonly initialState = input<Partial<EafTableState> | null>(null);

  /**
   * Funzione opzionale per aggiungere classi CSS dinamiche alle righe.
   * Accetta la stessa sintassi di ngClass:
   *   - stringa: 'my-class'
   *   - array:   ['class-a', 'class-b']
   *   - oggetto: { 'class-a': true, 'class-b': false }
   * Ritorna null/undefined per non aggiungere classi.
   */
  readonly rowClass = input<
    | ((
        row: T,
      ) => string | string[] | Record<string, boolean> | null | undefined)
    | null
  >(null);

  // ─── Outputs ─────────────────────────────────────────────────────────────

  /** Emette quando la selezione cambia */
  readonly selectionChange = output<T[]>();

  /** Emette al click su una riga */
  readonly rowClick = output<T>();

  /** Evento server-side: parametri per richiedere nuovi dati */
  readonly serverEvent = output<EafTableServerEvent>();

  /** Emette quando lo stato della tabella cambia */
  readonly stateChange = output<EafTableState>();

  // ─── Content Children (template directives) ──────────────────────────────

  private readonly cellDefs = contentChildren(EafCellDefDirective);
  private readonly filterDefs = contentChildren(EafFilterDefDirective);
  readonly actionsTemplate = contentChild(EafActionsDefDirective);

  // ─── View Children (Material) ────────────────────────────────────────────

  private readonly paginator = viewChild(MatPaginator);
  private readonly matSort = viewChild(MatSort);

  // ─── Internal State ──────────────────────────────────────────────────────

  readonly tableDataSource = new MatTableDataSource<T>([]);
  readonly selection = new SelectionModel<T>(true, []);

  /** Ordine corrente delle colonne (array di chiavi) */
  protected readonly columnOrder = signal<string[]>([]);

  /** Filtri attivi: chiave colonna → valore */
  protected readonly activeFilters = signal<Record<string, unknown>>({});

  /** Sort corrente */
  protected readonly activeSort = signal<EafSortState | null>(null);

  /** Dimensione pagina corrente */
  protected readonly currentPageSize = signal(10);

  /** Pagina corrente */
  protected readonly currentPageIndex = signal(0);

  /** Colonne visibili (chiavi) */
  protected readonly visibleColumnKeys = signal<string[]>([]);

  /** Filtro attualmente aperto */
  protected readonly openFilterKey = signal<string | null>(null);

  /** Posizione del dropdown filtro (fixed) */
  protected readonly filterPosition = signal<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  /** Subject per filtri custom (uno per colonna) */
  private readonly filterSubjects = new Map<string, Subject<unknown>>();

  /** Tutti i dati caricati (per client-side) */
  private allData: T[] = [];
  private dataSub?: Subscription;
  private filterSubs: Subscription[] = [];
  private initialized = false;
  private dataLoaded = false;

  // ─── Computed Storage Types ─────────────────────────────────────────────

  /** StorageType effettivo per lo stato: input locale > config globale > 'none' */
  protected readonly effectiveTableStateType = computed<StorageType>(
    () =>
      this.tableStateStorageType() ??
      this.globalStorageConfig?.tableStateStorageType ??
      'none',
  );

  /** StorageType effettivo per lo scroll: input locale > config globale > 'none' */
  protected readonly effectiveTableScrollType = computed<StorageType>(
    () =>
      this.tableScrollStorageType() ??
      this.globalStorageConfig?.tableScrollStorageType ??
      'none',
  );

  // ─── Computed ────────────────────────────────────────────────────────────

  /** Column defs filtrate per visibilità, ordinate */
  protected readonly visibleColumnDefs = computed(() => {
    const order = this.columnOrder();
    const visible = new Set(this.visibleColumnKeys());
    const cols = this.columns();

    const ordered = order
      .map((key) => cols.find((c) => c.key === key))
      .filter((c): c is EafColumnDef<T> => c != null && visible.has(c.key));

    return ordered;
  });

  /** Array finale di colonne mostrate (incluse select e actions) */
  protected readonly displayedColumns = computed(() => {
    const cols = this.visibleColumnDefs().map((c) => c.key);
    const result: string[] = [];

    if (this.selectionMode() !== 'none') {
      result.push('__select');
    }
    result.push(...cols);
    if (this.actionsTemplate()) {
      result.push('__actions');
    }

    return result;
  });

  /** Numero totale di righe (per paginator) */
  protected readonly totalRows = computed(() => {
    if (this.serverSide() && this.serverTotalRows() != null) {
      return this.serverTotalRows()!;
    }
    return this.tableDataSource.filteredData?.length ?? this.allData.length;
  });

  /** Configurazione paginazione normalizzata: null se disabilitata */
  protected readonly paginationConfig = computed<EafPaginationConfig | null>(
    () => {
      const p = this.pagination();
      if (p == null || p === false) return null;
      if (p === true) return { enabled: true };
      if (p.enabled === false) return null;
      return p;
    },
  );

  // ─── Persist state on changes ────────────────────────────────────────────

  constructor() {
    effect(() => {
      if (!this.initialized) return;
      const state: EafTableState = {
        columns: this.buildColumnStates(),
        sort: this.activeSort() ?? undefined,
        filters: this.activeFilters(),
        pageSize: this.currentPageSize(),
        pageIndex: this.currentPageIndex(),
      };
      untracked(() => {
        this.storageService.save(
          this.tableId(),
          state,
          this.effectiveTableStateType(),
        );
        this.stateChange.emit(state);
      });
    });

    // Wire paginator e sort al MatTableDataSource (solo client-side)
    effect(() => {
      if (this.serverSide()) {
        this.tableDataSource.paginator = null;
        return;
      }
      const p = this.paginator() ?? null;
      this.tableDataSource.paginator = p;
    });

    effect(() => {
      if (this.serverSide()) {
        this.tableDataSource.sort = null;
        return;
      }
      const s = this.matSort() ?? null;
      this.tableDataSource.sort = s;
    });
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.initializeState();
    this.setupFilterPredicate();
    this.setupDataSource();
    this.initialized = true;
  }

  ngOnDestroy(): void {
    this.dataSub?.unsubscribe();
    this.filterSubs.forEach((s) => s.unsubscribe());
    this.filterSubjects.forEach((s) => s.complete());
  }

  // ─── Initialization ─────────────────────────────────────────────────────

  private initializeState(): void {
    const cols = this.columns();
    const allKeys = cols.map((c) => c.key);
    const validKeys = new Set(allKeys);

    // 1. Carica dallo storage
    const stored = this.storageService.load(
      this.tableId(),
      this.effectiveTableStateType(),
    );

    // 2. initialState ha priorità su stored
    const ext = this.initialState();

    // Mappa stato salvato delle colonne (key → EafColumnState)
    const savedCols = ext?.columns ?? stored?.columns ?? [];
    const savedMap = new Map<string, EafColumnState>();
    for (const sc of savedCols) {
      if (validKeys.has(sc.key)) savedMap.set(sc.key, sc);
    }

    // Costruisci ordine e visibilità basandosi sulla configurazione corrente
    const orderEntries: { key: string; order: number }[] = [];
    const visibleKeys: string[] = [];

    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const saved = savedMap.get(col.key);

      // Ordine: usa salvato se presente, altrimenti indice nella configurazione
      const order = saved != null ? saved.order : i;
      orderEntries.push({ key: col.key, order });

      // Visibilità: usa salvata se presente, altrimenti default dalla configurazione
      const visible = saved != null ? saved.visible : col.visible !== false;
      if (visible) visibleKeys.push(col.key);
    }

    // Ordina per order crescente
    orderEntries.sort((a, b) => a.order - b.order);
    this.columnOrder.set(orderEntries.map((e) => e.key));
    this.visibleColumnKeys.set(visibleKeys);

    // Sort: resetta se la colonna non esiste più
    const sort = ext?.sort ?? stored?.sort ?? null;
    this.activeSort.set(sort && validKeys.has(sort.column) ? sort : null);
    if (this.activeSort()?.direction) {
      this.tableDataSource.sort?.sort({
        id: this.activeSort()!.column,
        start: this.activeSort()!.direction as 'asc' | 'desc',
        disableClear: false,
      });
    }

    // Filtri: rimuovi quelli di colonne non più presenti
    const rawFilters = ext?.filters ?? stored?.filters ?? {};
    const filters: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawFilters)) {
      if (validKeys.has(key)) filters[key] = value;
    }
    this.activeFilters.set(filters);

    // Page size
    const pageSize =
      ext?.pageSize ??
      stored?.pageSize ??
      this.paginationConfig()?.pageSize ??
      10;
    this.currentPageSize.set(pageSize);

    // Page index
    const pageIndex = ext?.pageIndex ?? stored?.pageIndex ?? 0;
    this.currentPageIndex.set(pageIndex >= 0 ? pageIndex : 0);
  }

  private setupDataSource(): void {
    const dataInput = this.data();

    if (isObservable(dataInput)) {
      this.dataSub = dataInput.subscribe((data) => {
        this.allData = data;
        this.applyClientData();
      });
    } else {
      this.allData = dataInput as T[];
      this.applyClientData();
    }
  }

  private setupFilterPredicate(): void {
    if (this.serverSide()) return;

    this.tableDataSource.filterPredicate = (row: T) => {
      const filters = this.activeFilters();
      const cols = this.columns();

      for (const [key, filterValue] of Object.entries(filters)) {
        if (filterValue == null) continue;

        const col = cols.find((c) => c.key === key);
        if (!col) continue;

        // Custom filter function
        if (col.filterFn) {
          if (!col.filterFn(row, filterValue)) return false;
          continue;
        }

        const filterConfig = this.resolveFilterConfig(col);

        // Filtro 'select' con predicateOptions
        if (
          filterConfig.type === 'select' &&
          filterConfig.predicateOptions?.length
        ) {
          if (Array.isArray(filterValue)) {
            // Multiselect: la riga passa se soddisfa almeno un predicato selezionato
            const preds = filterConfig.predicateOptions.filter((o) =>
              (filterValue as unknown[]).includes(o.value),
            );
            if (preds.length && !preds.some((p) => p.filterFn(row)))
              return false;
          } else {
            const predOpt = filterConfig.predicateOptions.find(
              (o) => o.value === filterValue,
            );
            if (predOpt && !predOpt.filterFn(row)) return false;
          }
          continue;
        }

        const cellValue = this.getCellValue(row, col);

        if (!this.matchesFilter(cellValue, filterValue, filterConfig.type)) {
          return false;
        }
      }
      return true;
    };
  }

  // ─── Data ────────────────────────────────────────────────────────────────

  private applyClientData(): void {
    const wasLoaded = this.dataLoaded;
    this.tableDataSource.data = this.allData;
    // In server-side mode il filtering è gestito dal backend: non toccare
    // tableDataSource.filter, altrimenti il predicate di default di Material
    // filtrerebbe via tutte le righe (riceverebbe la stringa "{}" e non la troverebbe in nessuna riga).
    if (!this.serverSide()) {
      this.tableDataSource.filter = JSON.stringify(this.activeFilters());
    }
    if (this.allData.length > 0) {
      this.dataLoaded = true;
      // Primo caricamento dati: ripristina il pageIndex sul paginator,
      // perché MatTableDataSource manipola direttamente paginator.pageIndex
      // bypassando il binding Angular [pageIndex]="currentPageIndex()".
      if (!wasLoaded) {
        const target = this.currentPageIndex();
        if (target > 0) {
          queueMicrotask(() => {
            const p = this.paginator();
            if (p && p.pageIndex !== target) {
              const previousPageIndex = p.pageIndex;
              p.pageIndex = target;
              p.page.emit({
                pageIndex: target,
                previousPageIndex,
                pageSize: p.pageSize,
                length: p.length,
              });
            }
          });
        }
      }
    }
  }

  /** Aggiorna i dati (utile per server-side o aggiornamento manuale) */
  updateData(data: T[]): void {
    this.allData = data;
    this.applyClientData();
  }

  // ─── Sort ────────────────────────────────────────────────────────────────

  onSortChange(sort: Sort): void {
    const state: EafSortState = {
      column: sort.active,
      direction: sort.direction,
    };
    this.activeSort.set(sort.direction ? state : null);

    if (this.serverSide()) {
      this.emitServerEvent();
    }
  }

  // ─── Filters ─────────────────────────────────────────────────────────────

  hasFilter(col: EafColumnDef<T>): boolean {
    return (
      col.filter !== false && col.filter !== undefined && col.filter !== null
    );
  }

  isFilterActive(key: string): boolean {
    const val = this.activeFilters()[key];
    return val != null && val !== '';
  }

  toggleFilter(event: Event, key: string): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.openFilterKey() === key) {
      this.openFilterKey.set(null);
    } else {
      const btn = event.currentTarget as HTMLElement;
      const rect = btn.getBoundingClientRect();
      const dropdownWidth = 350; // max-width del dropdown
      const viewportWidth = window.innerWidth;
      const left = Math.min(rect.left, viewportWidth - dropdownWidth - 8);
      this.filterPosition.set({ top: rect.bottom + 4, left });
      this.openFilterKey.set(key);
    }
  }

  closeFilter(): void {
    this.openFilterKey.set(null);
  }

  getFilterValue(key: string): unknown {
    return this.activeFilters()[key] ?? null;
  }

  getFilterConfig(col: EafColumnDef<T>): EafFilterConfig {
    return this.resolveFilterConfig(col);
  }

  getFilterSubject(key: string): Subject<unknown> {
    if (!this.filterSubjects.has(key)) {
      const subject = new Subject<unknown>();
      this.filterSubjects.set(key, subject);
      const sub = subject.subscribe((value) =>
        this.onFilterValueChange(key, value),
      );
      this.filterSubs.push(sub);
    }
    return this.filterSubjects.get(key)!;
  }

  onFilterValueChange(key: string, value: unknown): void {
    const filters = { ...this.activeFilters() };
    if (value == null || value === '') {
      delete filters[key];
    } else {
      filters[key] = value;
    }
    this.activeFilters.set(filters);

    if (this.serverSide()) {
      this.currentPageIndex.set(0);
      this.emitServerEvent();
    } else {
      this.currentPageIndex.set(0);
      this.tableDataSource.filter = JSON.stringify(filters);
    }
  }

  getCustomFilterTemplate(key: string): TemplateRef<unknown> | null {
    const def = this.filterDefs().find((d) => d.columnKey() === key);
    return def?.templateRef ?? null;
  }

  getColumnData(key: string): unknown[] {
    return this.allData.map((row) => (row as Record<string, unknown>)[key]);
  }

  private resolveFilterConfig(col: EafColumnDef<T>): EafFilterConfig {
    if (typeof col.filter === 'object') return col.filter;
    return { type: 'text' };
  }

  private matchesFilter(
    cellValue: unknown,
    filterValue: unknown,
    filterType: EafFilterType,
  ): boolean {
    switch (filterType) {
      case 'text': {
        const cell = String(cellValue ?? '').toLowerCase();
        const filter = String(filterValue).toLowerCase();
        return cell.includes(filter);
      }

      case 'number': {
        const num = Number(cellValue);
        const nf = filterValue as {
          mode?: string;
          min?: number | null;
          max?: number | null;
          equal?: number | null;
        };
        if (nf.mode === 'equal') return nf.equal != null && num === nf.equal;
        if (nf.min != null && num < nf.min) return false;
        if (nf.max != null && num > nf.max) return false;
        return true;
      }

      case 'date': {
        const dateVal =
          cellValue instanceof Date ? cellValue : new Date(String(cellValue));
        const df = filterValue as {
          mode?: string;
          from?: string | null;
          to?: string | null;
          equal?: string | null;
        };
        if (df.mode === 'equal' && df.equal) {
          const eq = new Date(df.equal);
          return dateVal.toDateString() === eq.toDateString();
        }
        if (df.from && dateVal < new Date(df.from)) return false;
        if (df.to && dateVal > new Date(df.to)) return false;
        return true;
      }

      case 'select':
      case 'select-distinct':
        if (Array.isArray(filterValue)) {
          return (filterValue as unknown[]).includes(cellValue);
        }
        return cellValue === filterValue;

      case 'boolean':
        return Boolean(cellValue) === Boolean(filterValue);

      default:
        return true;
    }
  }

  // ─── Pagination ──────────────────────────────────────────────────────────

  onPageChange(event: PageEvent): void {
    // Ignora eventi del paginator emessi prima che i dati siano caricati
    // (es. clamp automatico a pageIndex 0 quando length=0 con dati async)
    if (!this.dataLoaded && !this.serverSide()) {
      return;
    }
    this.currentPageSize.set(event.pageSize);
    this.currentPageIndex.set(event.pageIndex);

    if (this.serverSide()) {
      this.emitServerEvent();
    }
  }

  // ─── Selection ───────────────────────────────────────────────────────────

  isAllSelected(): boolean {
    return (
      this.selection.selected.length ===
        this.tableDataSource.filteredData.length &&
      this.selection.selected.length > 0
    );
  }

  isSomeSelected(): boolean {
    return this.selection.selected.length > 0 && !this.isAllSelected();
  }

  toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.tableDataSource.filteredData);
    }
    this.selectionChange.emit(this.selection.selected);
  }

  toggleRow(row: T): void {
    if (this.selectionMode() === 'single') {
      this.selection.clear();
      this.selection.select(row);
    } else {
      this.selection.toggle(row);
    }
    this.selectionChange.emit(this.selection.selected);
  }

  onRowClick(row: T): void {
    this.rowClick.emit(row);
  }

  // ─── Column Drag & Drop ──────────────────────────────────────────────────

  onColumnDrop(event: CdkDragDrop<string[]>): void {
    const order = [...this.columnOrder()];
    const visibleCols = this.visibleColumnDefs();

    // Mappa indici visibili → indici nell'ordine completo
    const fromKey = visibleCols[event.previousIndex]?.key;
    const toKey = visibleCols[event.currentIndex]?.key;
    if (!fromKey || !toKey) return;

    const fromIdx = order.indexOf(fromKey);
    const toIdx = order.indexOf(toKey);
    if (fromIdx < 0 || toIdx < 0) return;

    moveItemInArray(order, fromIdx, toIdx);
    this.columnOrder.set(order);
  }

  // ─── Cell Templates ──────────────────────────────────────────────────────

  getCellTemplate(key: string): TemplateRef<unknown> | null {
    const def = this.cellDefs().find((d) => d.columnKey() === key);
    return def?.templateRef ?? null;
  }

  getCellValue(row: T, col: EafColumnDef<T>): unknown {
    if (col.valueGetter) return col.valueGetter(row);
    return (row as Record<string, unknown>)[col.key];
  }

  // ─── Column Sizing ──────────────────────────────────────────────────────

  getColumnFlex(col: EafColumnDef<T>): string | null {
    if (typeof col.width === 'string') return null;
    return `${col.width ?? 1} 1 0`;
  }

  getColumnMinWidth(col: EafColumnDef<T>): string | null {
    if (typeof col.width === 'string') return col.width;
    return null;
  }

  getColumnMaxWidth(col: EafColumnDef<T>): string | null {
    if (typeof col.width === 'string') return col.width;
    return null;
  }

  // ─── Server-Side ─────────────────────────────────────────────────────────

  private emitServerEvent(): void {
    this.serverEvent.emit({
      sort: this.activeSort() ?? undefined,
      filters: this.activeFilters(),
      pageIndex: this.currentPageIndex(),
      pageSize: this.currentPageSize(),
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /** Reimposta tutti i filtri */
  clearFilters(): void {
    this.activeFilters.set({});
    if (!this.serverSide()) {
      this.tableDataSource.filter = '';
    } else {
      this.emitServerEvent();
    }
  }

  /** Reimposta lo stato della tabella a quello iniziale */
  resetState(): void {
    this.storageService.clear(this.tableId());
    this.initializeState();
    this.applyClientData();
  }

  /** Imposta la visibilità di una colonna */
  setColumnVisible(key: string, visible: boolean): void {
    const current = this.visibleColumnKeys();
    if (visible && !current.includes(key)) {
      this.visibleColumnKeys.set([...current, key]);
    } else if (!visible) {
      this.visibleColumnKeys.set(current.filter((k) => k !== key));
    }
  }

  /** Restituisce lo stato corrente della tabella */
  getState(): EafTableState {
    return {
      columns: this.buildColumnStates(),
      sort: this.activeSort() ?? undefined,
      filters: this.activeFilters(),
      pageSize: this.currentPageSize(),
    };
  }

  /** Costruisce l'array di EafColumnState dall'ordine e visibilità correnti */
  private buildColumnStates(): EafColumnState[] {
    const order = this.columnOrder();
    const visible = new Set(this.visibleColumnKeys());
    return order.map((key, index) => ({
      key,
      order: index,
      visible: visible.has(key),
    }));
  }

  /**
   * Imposta il valore di un singolo filtro dall'esterno.
   * Passare `null` o `undefined` rimuove il filtro per quella colonna.
   */
  setFilter(key: string, value: unknown): void {
    this.onFilterValueChange(key, value);
  }

  /**
   * Imposta più filtri contemporaneamente dall'esterno.
   * I filtri non presenti nell'oggetto passato restano invariati;
   * usa `clearFilters()` per azzerare tutto prima se necessario.
   */
  setFilters(filters: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(filters)) {
      this.onFilterValueChange(key, value);
    }
  }

  /** Restituisce le righe selezionate */
  getSelection(): T[] {
    return this.selection.selected;
  }

  /** Pulisce la selezione */
  clearSelection(): void {
    this.selection.clear();
    this.selectionChange.emit([]);
  }
}
