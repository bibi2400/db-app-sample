import {
  buildFindOptions,
  DataSourceService,
  Injectable,
} from "@bibi2400/electron-angular-framework/electron";
import type {
  EafTableResult,
  EafTableServerEvent,
} from "@bibi2400/electron-angular-framework/shared";
import { Product } from "../db/entities/product";

/**
 * Service per la gestione dei prodotti.
 * Espone query server-side per la tabella e recupero singolo record.
 */
@Injectable()
export class ProductService {
  constructor(private readonly dataSourceService: DataSourceService) {}

  async getRows(event: EafTableServerEvent): Promise<EafTableResult<Product>> {
    const repo = this.dataSourceService.model(Product);
    const options = buildFindOptions<Product>(event, repo);
    const [items, total] = await repo.findAndCount(options);
    return { items, total };
  }

  async getById(id: number): Promise<Product | null> {
    const repo = this.dataSourceService.model(Product);
    return repo.findOneBy({ id });
  }
}
