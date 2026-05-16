import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import type {
  EafColumnDef,
  EafPaginationConfig,
  EafTableServerEvent,
} from '@bibi2400/electron-angular-framework/angular';
import {
  EafActionsDefDirective,
  EafCellDefDirective,
  EafTable,
} from '@bibi2400/electron-angular-framework/angular';

import { ElectronProductService } from '../../services/electron-product.service';
import type { Product } from '../../types/product';

/**
 * Pagina Prodotti — lista server-side di tutti i prodotti.
 * Cliccando su una riga si naviga alla pagina di dettaglio con le note.
 */
@Component({
  selector: 'app-products',
  imports: [
    EafTable,
    EafActionsDefDirective,
    EafCellDefDirective,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
  ],
  templateUrl: './products.html',
  styleUrl: './products.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Products implements OnInit {
  private readonly productService = inject(ElectronProductService);
  private readonly router = inject(Router);

  protected readonly items = signal<Product[]>([]);
  protected readonly totalRows = signal<number>(0);
  protected readonly loading = signal<boolean>(false);

  protected readonly columns: EafColumnDef<Product>[] = [
    {
      key: 'id',
      header: 'ID',
      width: '65px',
      sortable: true,
      filter: { type: 'number', modes: ['equal'] },
    },
    {
      key: 'name',
      header: 'Nome',
      width: 3,
      sortable: true,
      filter: true,
    },
    {
      key: 'category',
      header: 'Categoria',
      width: 2,
      sortable: true,
      filter: true,
    },
    {
      key: 'price',
      header: 'Prezzo (€)',
      width: 1,
      sortable: true,
      filter: { type: 'number', modes: ['range'] },
    },
    {
      key: 'stock',
      header: 'Stock',
      width: 1,
      sortable: true,
      filter: { type: 'number' },
    },
    {
      key: 'status',
      header: 'Stato',
      width: 1,
      sortable: true,
      filter: true,
    },
    {
      key: 'active',
      header: 'Attivo',
      width: '80px',
      sortable: true,
      filter: { type: 'boolean' },
    },
  ];

  protected readonly pagination: EafPaginationConfig = {
    enabled: true,
    pageSize: 15,
    pageSizeOptions: [10, 15, 25, 50],
  };

  ngOnInit(): void {
    this.fetch({ filters: {}, pageIndex: 0, pageSize: this.pagination.pageSize ?? 15 });
  }

  protected onServerEvent(event: EafTableServerEvent): void {
    this.fetch(event);
  }

  protected openDetail(product: Product): void {
    this.router.navigate(['/product-detail', product.id]);
  }

  private async fetch(event: EafTableServerEvent): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.productService.getRows(event);
      this.items.set(result.items);
      this.totalRows.set(result.total);
    } catch (err) {
      console.error('[Products] fetch failed:', err);
    } finally {
      this.loading.set(false);
    }
  }
}
