import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import type {
  EafColumnDef,
  EafPaginationConfig,
  EafTableServerEvent,
  EafTableState,
} from '@bibi2400/electron-angular-framework/angular';
import {
  EafActionsDefDirective,
  EafTable,
} from '@bibi2400/electron-angular-framework/angular';

import { ElectronTableDemoService } from '../../services/electron-table-demo.service';
import type { MightyTableRow } from '../../types/mighty-table';

import { toObservable } from '@angular/core/rxjs-interop';

/**
 * DEMO TABELLA SERVER-SIDE.
 *
 * Pattern raccomandato per tabelle con dati provenienti dal DB:
 *  1. `[serverSide]="true"` disabilita filter/sort/pagination client-side
 *  2. La tabella emette `(serverEvent)` ad ogni cambio di paginazione, sort o filtri
 *  3. L'handler chiama un service Angular (wrapper IPC) che richiama un controller
 *     Electron il quale, tramite `buildFindOptions(event, repo)`, esegue la query
 *     TypeORM e ritorna `{ items, total }`.
 *  4. La pagina aggiorna i signal `products` e `totalRows` e li passa alla tabella.
 *
 * Per i filtri `select-distinct` (es. `status`) i valori unici NON sono inferibili
 * dalla pagina corrente: si usa `loadOptions` per recuperarli con un IPC dedicato.
 */
@Component({
  selector: 'app-table-demo',
  imports: [
    EafTable,
    EafActionsDefDirective,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatCheckboxModule,
  ],
  templateUrl: './table-demo.html',
  styleUrl: './table-demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableDemo implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly tableDemoService = inject(ElectronTableDemoService);

  protected readonly products = signal<MightyTableRow[]>([]);
  protected readonly products$ = toObservable(this.products);
  protected readonly totalRows = signal<number>(0);
  protected readonly loading = signal<boolean>(false);

  protected readonly initialState: Partial<EafTableState> | null;

  constructor() {
    const params = this.route.snapshot.queryParams;
    const filters: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(params)) {
      try {
        filters[key] = JSON.parse(raw as string);
      } catch {
        filters[key] = raw;
      }
    }
    this.initialState = Object.keys(filters).length ? { filters } : null;
  }

  /**
   * `loadOptions` per il filtro `select-distinct` su `status`.
   * Restituito come Observable (la EafFilterConfig accetta sia Promise che Observable).
   */

  protected readonly columns: EafColumnDef<MightyTableRow>[] = [
    {
      key: 'id',
      header: 'ID',
      width: '70px',
      sortable: true,
      filter: { type: 'number', modes: ['equal'] },
    },
    {
      key: 'header1',
      header: 'Int',
      width: 1,
      sortable: true,
      filter: { type: 'number' },
    },
    {
      key: 'header2',
      header: 'Varchar',
      width: 2,
      sortable: true,
      filter: true,
    },
    { key: 'header3', header: 'Text', width: 2, sortable: true, filter: true },
    {
      key: 'header4',
      header: 'Date',
      width: 1,
      sortable: true,
      filter: { type: 'date' },
    },
    {
      key: 'header5',
      header: 'Datetime',
      width: 1,
      sortable: true,
      filter: { type: 'date' },
    },
    {
      key: 'header6',
      header: 'Boolean',
      width: '100px',
      sortable: true,
      filter: { type: 'boolean' },
    },
    {
      key: 'header7',
      header: 'Float',
      width: 1,
      sortable: true,
      filter: { type: 'number', modes: ['range'] },
    },
    {
      key: 'header8',
      header: 'Double',
      width: 1,
      sortable: true,
      filter: { type: 'number', modes: ['range'] },
    },
  ];

  protected readonly pagination: EafPaginationConfig = {
    enabled: true,
    pageSize: 10,
    pageSizeOptions: [5, 10, 25, 50],
  };

  ngOnInit(): void {
    // Caricamento iniziale: emula l'evento server-side con paginazione default.
    this.fetch({
      filters: this.initialState?.filters ?? {},
      pageIndex: 0,
      pageSize: this.pagination.pageSize ?? 10,
    });
  }

  /** Handler dell'output `(serverEvent)` della `EafTable`. */
  protected onServerEvent(event: EafTableServerEvent): void {
    this.fetch(event);
  }

  private async fetch(event: EafTableServerEvent): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.tableDemoService.getRows(event);
      this.products.set(result.items);
      this.totalRows.set(result.total);
    } catch (err) {
      console.error('[TableDemo] fetch failed:', err);
    } finally {
      this.loading.set(false);
    }
  }

  protected onEdit(row: MightyTableRow): void {
    console.log('Edit:', row);
  }

  protected onDelete(row: MightyTableRow): void {
    console.log('Delete:', row);
  }

  protected onSelectionChange(row: MightyTableRow[]): void {
    console.log('Selezione:', row.length, 'prodotti');
  }

  protected onRowClick(row: MightyTableRow): void {
    console.log('Click riga:', row);
  }

  protected formatDate(value: unknown): string {
    if (!value) return '';
    const d = new Date(String(value));
    return d.toLocaleDateString('it-IT');
  }
}
