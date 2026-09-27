import {
  ChangeDetectionStrategy,
  Component,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import {
  EafCellDefDirective,
  EafTable,
} from '@bibi2400/electron-angular-framework/angular';
import type {
  EafColumnDef,
  EafTableHorizontalDensity,
  EafTableState,
} from '@bibi2400/electron-angular-framework/angular';

interface LayoutDemoRow {
  id: number;
  customer: string;
  description: string;
  project: string;
  department: string;
  owner: string;
  city: string;
  region: string;
  status: string;
  reference: string;
  amount: number;
  notes: string;
}

@Component({
  selector: 'app-table-layout-demo',
  imports: [
    EafTable,
    EafCellDefDirective,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  templateUrl: './table-layout-demo.html',
  styleUrl: './table-layout-demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableLayoutDemo {
  private readonly table = viewChild.required(EafTable<LayoutDemoRow>);

  // Omessi al primo rendering: EafTable può ripristinare le preferenze salvate.
  protected readonly horizontalDensity =
    signal<EafTableHorizontalDensity | undefined>(undefined);
  protected readonly tableZoom = signal<number | undefined>(undefined);
  protected readonly selectedRow = signal<number | null>(null);
  protected readonly tableVisible = signal(true);

  protected readonly columns: EafColumnDef<LayoutDemoRow>[] = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      filter: { type: 'number', modes: ['equal'] },
    },
    { key: 'customer', header: 'Cliente', sortable: true, filter: true },
    { key: 'description', header: 'Descrizione', sortable: true, filter: true },
    { key: 'project', header: 'Progetto', sortable: true, filter: true },
    { key: 'department', header: 'Reparto', sortable: true, filter: true },
    { key: 'owner', header: 'Responsabile', sortable: true, filter: true },
    { key: 'city', header: 'Città', sortable: true, filter: true },
    { key: 'region', header: 'Regione', sortable: true, filter: true },
    {
      key: 'status',
      header: 'Stato',
      sortable: true,
      filter: { type: 'select-distinct' },
    },
    { key: 'reference', header: 'Riferimento', sortable: true, filter: true },
    {
      key: 'amount',
      header: 'Importo',
      sortable: true,
      filter: { type: 'number' },
    },
    { key: 'notes', header: 'Note operative', sortable: true, filter: true },
  ];

  protected readonly rows: LayoutDemoRow[] = Array.from(
    { length: 40 },
    (_, index) => ({
      id: index + 1,
      customer: `Cliente ${index + 1} — Servizi industriali`,
      description: `Fornitura e manutenzione impianto ${index + 1}`,
      project: `Rinnovamento stabilimento ${2026 + index % 3}`,
      department: 'Operations e assistenza tecnica',
      owner: index % 2 ? 'Alessandro Bianchi' : 'Francesca Rossi',
      city: index % 2 ? 'Milano' : 'Bologna',
      region: index % 2 ? 'Lombardia' : 'Emilia-Romagna',
      status: index % 3 ? 'In lavorazione' : 'Da approvare',
      reference: `COMMESSA-2026-${String(index + 1).padStart(4, '0')}`,
      amount: 1250 + index * 175,
      notes: 'Concordare consegna e collaudo con il referente di stabilimento',
    }),
  );

  protected onStateChange(state: EafTableState): void {
    this.horizontalDensity.set(state.horizontalDensity);
    this.tableZoom.set(state.tableZoom);
  }

  protected closeTable(): void {
    this.tableVisible.set(false);
    this.horizontalDensity.set(undefined);
    this.tableZoom.set(undefined);
    this.selectedRow.set(null);
  }

  protected resetState(): void {
    this.horizontalDensity.set(undefined);
    this.tableZoom.set(undefined);
    this.table().resetState();
  }
}
