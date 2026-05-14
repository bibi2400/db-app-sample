import {
  buildFindOptions,
  DataSourceService,
  Injectable,
} from "@bibi2400/electron-angular-framework/electron";
import type { EafTableResult, EafTableServerEvent } from "@bibi2400/electron-angular-framework/shared";
import { MightyTableRow } from "../db/entities/mighty-table";

/**
 * Service per la `table-demo`: interroga `mightyTable` (100.000 righe, 40 colonne).
 * Pattern server-side: riceve `EafTableServerEvent`, usa `buildFindOptions` per
 * costruire la query TypeORM e ritorna `EafTableResult<MightyTableRow>`.
 */
@Injectable()
export class TableDemoService {
  constructor(private readonly dataSourceService: DataSourceService) {}

  async getRows(event: EafTableServerEvent): Promise<EafTableResult<MightyTableRow>> {
    const repo = this.dataSourceService.model(MightyTableRow);
    const options = buildFindOptions<MightyTableRow>(event, repo);
    const [items, total] = await repo.findAndCount(options);
    return { items, total };
  }
}