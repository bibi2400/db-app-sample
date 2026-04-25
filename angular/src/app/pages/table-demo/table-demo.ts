import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EafTable, EafCellDefDirective, EafFilterDefDirective, EafActionsDefDirective, ScrollRestorer } from '@bibi2400/electron-angular-framework/angular';
import type {
  EafColumnDef,
  EafPaginationConfig,
  EafSelectPredicateOption,
  EafTableState,
} from '@bibi2400/electron-angular-framework/angular';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
  status: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = ['Elettronica', 'Abbigliamento', 'Casa', 'Sport', 'Alimentari'];
const STATUSES = [
  'Disponibile',
  'Esaurito',
  'In arrivo',
  'Fuori produzione',
  "Lorem",
  "Ipsum",
  "has",
  "been",
  "the",
  "industrys",
  "standard",
  "dummy",
  "text",
  "ever",
  "since",
  "the",
  "1500s",
  "when",
  "an",
  "unknown",
  "printer",
  "took",
  "a",
  "galley",
  "of",
  "type",
  "and",
  "scrambled",
  "it",
  "to",
  "make",
  "a",
  "type",
  "specimen",
  "book",
  "It",
  "has",
  "survived",
  "not",
  "only",
  "five",
  "centuries",
];

function generateProducts(count: number): Product[] {
  const products: Product[] = [];
  for (let i = 1; i <= count; i++) {
    products.push({
      id: i,
      name: `Prodotto ${i}`,
      category: CATEGORIES[i % CATEGORIES.length],
      price: Math.round((Math.random() * 500 + 5) * 100) / 100,
      stock: Math.floor(Math.random() * 200),
      rating: Math.floor(Math.random() * 5) + 1,
      status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
      active: Math.random() > 0.3,
      createdAt: new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
      updatedAt: new Date(2026, Math.floor(Math.random() * 4), Math.floor(Math.random() * 28) + 1).toISOString(),
    });
  }
  return products;
}

@Component({
  selector: 'app-table-demo',
  imports: [
    EafTable,
    EafCellDefDirective,
    EafFilterDefDirective,
    EafActionsDefDirective,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatCheckboxModule,
    ScrollRestorer
],
  templateUrl: './table-demo.html',
  styleUrl: './table-demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableDemo {
  private readonly route = inject(ActivatedRoute);

  protected readonly products = signal<Product[]>(generateProducts(80));

  protected readonly initialState: Partial<EafTableState> | null;

  constructor() {
    const params = this.route.snapshot.queryParams;
    const filters: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(params)) {
      try { filters[key] = JSON.parse(raw as string); }
      catch { filters[key] = raw; }
    }
    this.initialState = Object.keys(filters).length ? { filters } : null;
  }

  protected readonly categories = CATEGORIES;
  protected readonly selectedCategories = signal<Set<string>>(new Set());

  protected readonly columns: EafColumnDef<Product>[] = [
    // number — solo equal
    { key: 'id', header: 'ID', width: '80px', sortable: true, filter: { type: 'number', modes: ['equal'] } },
    // text
    { key: 'name', header: 'Nome', width: 2, sortable: true, filter: true },
    // custom (checkbox multi-select)
    {
      key: 'category', header: 'Categoria', width: 1, sortable: true,
      filter: { type: 'custom' },
      filterFn: (row, value) => {
        const selected = value as string[];
        return !selected?.length || selected.includes(row.category);
      },
    },
    // number — entrambe le modalità (default)
    { key: 'price', header: 'Prezzo (€)', width: 1, sortable: true, filter: { type: 'number' } },
    // number — solo range
    { key: 'stock', header: 'Giacenza', width: 1, sortable: true, filter: { type: 'number', modes: ['range'] } },
    // number — solo equal (rating 1-5)
    { key: 'rating', header: 'Voto', width: '80px', sortable: true, filter: { type: 'number', modes: ['equal'] } },
    // select-distinct multiselect con autocomplete (valori unici estratti automaticamente)
    { key: 'status', header: 'Stato', width: 1, sortable: true, filter: { type: 'select-distinct', multiple: true, autocomplete: true } },
    // boolean
    { key: 'active', header: 'Attivo', width: '100px', sortable: true, filter: { type: 'boolean' } },
    // select con predicateOptions
    {
      key: 'createdAt', header: 'Data creazione', width: 1, sortable: true,
      filter: {
        type: 'select',
        predicateOptions: [
          {
            value: 'recent',
            label: 'Ultimi 3 mesi',
            filterFn: (row: Product) => {
              const d = new Date(row.createdAt);
              const threeMonthsAgo = new Date();
              threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
              return d >= threeMonthsAgo;
            },
          },
          {
            value: 'old',
            label: 'Più di 6 mesi fa',
            filterFn: (row: Product) => {
              const d = new Date(row.createdAt);
              const sixMonthsAgo = new Date();
              sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
              return d < sixMonthsAgo;
            },
          },
          {
            value: 'this-year',
            label: 'Anno corrente',
            filterFn: (row: Product) => new Date(row.createdAt).getFullYear() === new Date().getFullYear(),
          },
        ] as EafSelectPredicateOption<Product>[],
      },
    },
    // date — solo equal
    { key: 'updatedAt', header: 'Ultimo aggiornamento', width: 1, sortable: true, filter: { type: 'date', modes: ['equal'] } },
  ];

  protected readonly pagination: EafPaginationConfig = {
    enabled: true,
    pageSize: 10,
    pageSizeOptions: [5, 10, 25, 50],
  };

  protected onEdit(product: Product): void {
    console.log('Edit:', product);
  }

  protected onDelete(product: Product): void {
    console.log('Delete:', product);
    this.products.update(list => list.filter(p => p.id !== product.id));
  }

  protected onSelectionChange(selected: Product[]): void {
    console.log('Selezione:', selected.length, 'prodotti');
  }

  protected onRowClick(product: Product): void {
    console.log('Click riga:', product);
  }

  protected onCategoryToggle(category: string, filterChange: { next: (v: unknown) => void }): void {
    this.selectedCategories.update(set => {
      const copy = new Set(set);
      if (copy.has(category)) copy.delete(category); else copy.add(category);
      return copy;
    });
    const arr = [...this.selectedCategories()];
    filterChange.next(arr.length ? arr : null);
  }

  protected isCategorySelected(category: string): boolean {
    return this.selectedCategories().has(category);
  }

  protected formatPrice(value: unknown): string {
    return typeof value === 'number' ? `€ ${value.toFixed(2)}` : String(value);
  }

  protected formatDate(value: unknown): string {
    if (!value) return '';
    const d = new Date(String(value));
    return d.toLocaleDateString('it-IT');
  }

  protected statusClass(status: string): string {
    const map: Record<string, string> = {
      'Disponibile': 'available',
      'Esaurito': 'out-of-stock',
      'In arrivo': 'incoming',
      'Fuori produzione': 'discontinued',
    };
    return map[status] ?? 'default';
  }
}
