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
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SelectionModel } from '@angular/cdk/collections';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Observable, Subject, Subscription, isObservable } from 'rxjs';

import { EafTableFilter } from '../eaf-table-filter/eaf-table-filter';
import { EafCellDefDirective, EafFilterDefDirective, EafActionsDefDirective } from '../../directives/eaf-table.directives';
import { EafTableStorageService } from '../../services/eaf-table-storage.service';
import {
  EafColumnDef,
  EafColumnState,
  EafFilterConfig,
  EafFilterType,
  EafPaginationConfig,
  EafPageEvent,
  EafSelectionMode,
  EafSortState,
  EafTableServerEvent,
  EafTableState,
} from '../../types/eaf-table.types';

@Component({
  selector: 'eaf-table',
  imports: [
    NgTemplateOutlet,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatCheckboxModule,
    MatIconModule,
    MatButtonModule,
    DragDropModule,
    EafTableFilter,
  ],
  templateUrl: './eaf-table.html',
  styleUrl: './eaf-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EafTable<T = unknown> implements OnInit, OnDestroy {
  private readonly storageService = inject(EafTableStorageService);

  // ─── Inputs ──────────────────────────────────────────────────────────────

  /** ID univoco della tabella, usato come chiave nel localStorage */
  readonly tableId = input.required<string>();

  /** Definizioni delle colonne */
  readonly columns = input.required<EafColumnDef<T>[]>();

  /** Dati: array statico o Observable */
  readonly data = input<T[] | Observable<T[]>>([]);

  /** Configurazione paginazione */
  readonly pagination = input<EafPaginationConfig | null>(null);

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
  protected readonly filterPosition = signal<{ top: number; left: number }>({ top: 0, left: 0 });

  /** Subject per filtri custom (uno per colonna) */
  private readonly filterSubjects = new Map<string, Subject<unknown>>();

  /** Tutti i dati caricati (per client-side) */
  private allData: T[] = [];
  private dataSub?: Subscription;
  private filterSubs: Subscription[] = [];
  private initialized = false;

  // ─── Computed ────────────────────────────────────────────────────────────

  /** Column defs filtrate per visibilità, ordinate */
  protected readonly visibleColumnDefs = computed(() => {
    const order = this.columnOrder();
    const visible = new Set(this.visibleColumnKeys());
    const cols = this.columns();

    const ordered = order
      .map(key => cols.find(c => c.key === key))
      .filter((c): c is EafColumnDef<T> => c != null && visible.has(c.key));

    return ordered;
  });

  /** Array finale di colonne mostrate (incluse select e actions) */
  protected readonly displayedColumns = computed(() => {
    const cols = this.visibleColumnDefs().map(c => c.key);
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

  // ─── Persist state on changes ────────────────────────────────────────────

  constructor() {
    effect(() => {
      if (!this.initialized) return;
      const state: EafTableState = {
        columns: this.buildColumnStates(),
        sort: this.activeSort() ?? undefined,
        filters: this.activeFilters(),
        pageSize: this.currentPageSize(),
      };
      untracked(() => {
        this.storageService.save(this.tableId(), state);
        this.stateChange.emit(state);
      });
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
    this.filterSubs.forEach(s => s.unsubscribe());
    this.filterSubjects.forEach(s => s.complete());
  }

  // ─── Initialization ─────────────────────────────────────────────────────

  private initializeState(): void {
    const cols = this.columns();
    const allKeys = cols.map(c => c.key);
    const validKeys = new Set(allKeys);

    // 1. Carica da localStorage
    const stored = this.storageService.load(this.tableId());

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
      const visible = saved != null ? saved.visible : (col.visible !== false);
      if (visible) visibleKeys.push(col.key);
    }

    // Ordina per order crescente
    orderEntries.sort((a, b) => a.order - b.order);
    this.columnOrder.set(orderEntries.map(e => e.key));
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
    const pageSize = ext?.pageSize ?? stored?.pageSize ?? this.pagination()?.pageSize ?? 10;
    this.currentPageSize.set(pageSize);
  }

  private setupDataSource(): void {
    const dataInput = this.data();

    if (isObservable(dataInput)) {
      this.dataSub = dataInput.subscribe(data => {
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

        const col = cols.find(c => c.key === key);
        if (!col) continue;

        // Custom filter function
        if (col.filterFn) {
          if (!col.filterFn(row, filterValue)) return false;
          continue;
        }

        const filterConfig = this.resolveFilterConfig(col);

        // Filtro 'select' con predicateOptions
        if (filterConfig.type === 'select' && filterConfig.predicateOptions?.length) {
          if (Array.isArray(filterValue)) {
            // Multiselect: la riga passa se soddisfa almeno un predicato selezionato
            const preds = filterConfig.predicateOptions.filter(o => (filterValue as unknown[]).includes(o.value));
            if (preds.length && !preds.some(p => p.filterFn(row))) return false;
          } else {
            const predOpt = filterConfig.predicateOptions.find(o => o.value === filterValue);
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
    this.tableDataSource.data = this.allData;
    // Trigger filter
    this.tableDataSource.filter = JSON.stringify(this.activeFilters());
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
    return col.filter !== false && col.filter !== undefined && col.filter !== null;
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
      const sub = subject.subscribe(value => this.onFilterValueChange(key, value));
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
      this.tableDataSource.filter = JSON.stringify(filters);
    }
  }

  getCustomFilterTemplate(key: string): TemplateRef<unknown> | null {
    const def = this.filterDefs().find(d => d.columnKey() === key);
    return def?.templateRef ?? null;
  }

  getColumnData(key: string): unknown[] {
    return this.allData.map(row => (row as Record<string, unknown>)[key]);
  }

  private resolveFilterConfig(col: EafColumnDef<T>): EafFilterConfig {
    if (typeof col.filter === 'object') return col.filter;
    return { type: 'text' };
  }

  private matchesFilter(cellValue: unknown, filterValue: unknown, filterType: EafFilterType): boolean {
    switch (filterType) {
      case 'text': {
        const cell = String(cellValue ?? '').toLowerCase();
        const filter = String(filterValue).toLowerCase();
        return cell.includes(filter);
      }

      case 'number': {
        const num = Number(cellValue);
        const nf = filterValue as { mode?: string; min?: number | null; max?: number | null; equal?: number | null };
        if (nf.mode === 'equal') return nf.equal != null && num === nf.equal;
        if (nf.min != null && num < nf.min) return false;
        if (nf.max != null && num > nf.max) return false;
        return true;
      }

      case 'date': {
        const dateVal = cellValue instanceof Date ? cellValue : new Date(String(cellValue));
        const df = filterValue as { mode?: string; from?: string | null; to?: string | null; equal?: string | null };
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
    this.currentPageSize.set(event.pageSize);
    this.currentPageIndex.set(event.pageIndex);

    if (this.serverSide()) {
      this.emitServerEvent();
    }
  }

  // ─── Selection ───────────────────────────────────────────────────────────

  isAllSelected(): boolean {
    return this.selection.selected.length === this.tableDataSource.filteredData.length
      && this.selection.selected.length > 0;
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
    const def = this.cellDefs().find(d => d.columnKey() === key);
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
      this.visibleColumnKeys.set(current.filter(k => k !== key));
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
