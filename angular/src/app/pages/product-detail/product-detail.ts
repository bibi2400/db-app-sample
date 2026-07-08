import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { EafNotes } from '@bibi2400/electron-angular-framework/angular';
import { ElectronProductService } from '../../services/electron-product.service';
import type { Product } from '../../types/product';

/**
 * Pagina di dettaglio di un prodotto.
 * Mostra le informazioni del prodotto e il componente `EafNotes` per gestire
 * le note associate.
 *
 * Rotta: `/product-detail/:id`
 * Navigazione: da `/products` → click su riga o pulsante "Apri dettaglio"
 */
@Component({
  selector: 'app-product-detail',
  imports: [
    EafNotes,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
  ],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productService = inject(ElectronProductService);

  protected readonly product = signal<Product | null>(null);
  protected readonly loading = signal<boolean>(true);

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id || isNaN(id)) {
      this.router.navigate(['/products']);
      return;
    }
    this.loading.set(true);
    this.product.set(await this.productService.getById(id));
    this.loading.set(false);
  }

  protected goBack(): void {
    this.router.navigate(['/products']);
  }

  protected formatPrice(price: number): string {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  }

  protected formatDate(isoString: string): string {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(isoString));
  }
}
