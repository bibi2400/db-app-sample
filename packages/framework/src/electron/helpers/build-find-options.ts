import {
  Between,
  Equal,
  FindManyOptions,
  FindOptionsOrder,
  FindOptionsWhere,
  In,
  LessThanOrEqual,
  Like,
  MoreThanOrEqual,
  ObjectLiteral,
  Repository,
} from "typeorm";
import { EafTableServerEvent } from "../../shared/types/eaf-table";
import { Logger } from "./logger";

/**
 * Forma del valore filtro per colonne `number` con range/equal,
 * cos\u00ec come emesso da `EafTable` lato Angular.
 */
interface NumberFilterValue {
  mode?: "equal" | "range";
  equal?: number | null;
  min?: number | null;
  max?: number | null;
}

/**
 * Forma del valore filtro per colonne `date` con range/equal.
 * I valori sono ISO string serializzabili via IPC.
 */
interface DateFilterValue {
  mode?: "equal" | "range";
  equal?: string | null;
  from?: string | null;
  to?: string | null;
}

/**
 * Converte un evento server-side della `EafTable` in `FindManyOptions` di TypeORM.
 *
 * USO TIPICO (Electron service):
 * ```ts
 * async getProducts(event: EafTableServerEvent): Promise<EafTableResult<Product>> {
 *   const repo = this.dataSourceService.getRepo(Product);
 *   const options = buildFindOptions(event, repo);
 *   const [items, total] = await repo.findAndCount(options);
 *   return { items, total };
 * }
 * ```
 *
 * REGOLE DI CONVERSIONE FILTRI:
 *  - stringa                                    \u2192 ILike('%value%')   (case-insensitive contains)
 *  - array (anche con un solo elemento)         \u2192 In([...])
 *  - boolean                                    \u2192 Equal(true|false)
 *  - { mode:'equal', equal: number }            \u2192 Equal(number)
 *  - { mode:'range', min?, max? }               \u2192 Between / MoreThanOrEqual / LessThanOrEqual
 *  - { mode:'equal', equal: ISOString }         \u2192 Equal(Date)
 *  - { mode:'range', from?, to? }               \u2192 Between / MoreThanOrEqual / LessThanOrEqual su Date
 *  - null / undefined / ''                      \u2192 ignorato
 *
 * SICUREZZA:
 *  - Sia le chiavi dei filtri sia `sort.column` vengono validate contro le colonne
 *    reali dell'entit\u00e0 (lette dalla metadata di TypeORM). Chiavi sconosciute vengono
 *    silenziosamente ignorate (con warning nei log) per prevenire SQL injection
 *    su nomi di colonna interpolati.
 *
 * LIMITI NOTI:
 *  - I filtri di tipo `custom` o `predicateOptions` (logica JS arbitraria) non sono
 *    convertibili: il consumer deve gestirli a parte (es. costruendo query con QueryBuilder
 *    e mergiando con il `where` qui ritornato).
 *  - Le colonne calcolate (`valueGetter`) non possono essere ordinate/filtrate server-side.
 */
export function buildFindOptions<T extends ObjectLiteral>(
  event: EafTableServerEvent,
  repo: Repository<T>,
): FindManyOptions<T> {
  const allowedColumns = new Set(repo.metadata.columns.map(c => c.propertyName));
  const entityName = repo.metadata.targetName;

  const where = buildWhere<T>(event.filters, allowedColumns, entityName);
  const order = buildOrder<T>(event.sort, allowedColumns, entityName);

  const skip = Math.max(0, event.pageIndex) * Math.max(1, event.pageSize);
  const take = Math.max(1, event.pageSize);

  const options: FindManyOptions<T> = { skip, take };
  if (where) options.where = where;
  if (order) options.order = order;
  return options;
}

function buildWhere<T extends ObjectLiteral>(
  filters: Record<string, unknown>,
  allowedColumns: Set<string>,
  entityName: string,
): FindOptionsWhere<T> | undefined {
  const where: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(filters ?? {})) {
    if (raw == null || raw === "") continue;
    if (!allowedColumns.has(key)) {
      Logger.warn(`[buildFindOptions] Filter key '${key}' is not a column of '${entityName}', ignoring.`);
      continue;
    }
    const op = toFindOperator(raw);
    if (op !== undefined) where[key] = op;
  }

  return Object.keys(where).length ? (where as FindOptionsWhere<T>) : undefined;
}

function buildOrder<T extends ObjectLiteral>(
  sort: EafTableServerEvent["sort"],
  allowedColumns: Set<string>,
  entityName: string,
): FindOptionsOrder<T> | undefined {
  if (!sort || !sort.direction) return undefined;
  if (!allowedColumns.has(sort.column)) {
    Logger.warn(`[buildFindOptions] Sort column '${sort.column}' is not a column of '${entityName}', ignoring.`);
    return undefined;
  }
  const dir = sort.direction === "desc" ? "DESC" : "ASC";
  return { [sort.column]: dir } as FindOptionsOrder<T>;
}

/**
 * Inferisce l'operatore TypeORM corretto a partire dalla forma del valore filtro.
 * Ritorna `undefined` se il valore non rappresenta un filtro applicabile.
 */
function toFindOperator(value: unknown): unknown {
  // Array \u2192 IN (anche per select singolo se passato come [val])
  if (Array.isArray(value)) {
    return value.length ? In(value) : undefined;
  }

  // Boolean
  if (typeof value === "boolean") {
    return Equal(value);
  }

  // Stringa \u2192 contains case-insensitive (filtro 'text')
  // Nota: usiamo Like(); su SQLite il LIKE è già case-insensitive per ASCII.
  if (typeof value === "string") {
    return Like(`%${value}%`);
  }

  // Numero plain (caso raro, ma supportato)
  if (typeof value === "number") {
    return Equal(value);
  }

  // Oggetto strutturato: number/date con mode equal/range
  if (typeof value === "object" && value !== null) {
    const v = value as NumberFilterValue & DateFilterValue;

    if (v.mode === "equal") {
      // Numero
      if (typeof v.equal === "number") return Equal(v.equal);
      // Data (ISO string)
      if (typeof v.equal === "string" && v.equal) {
        const d = new Date(v.equal);
        return isNaN(d.getTime()) ? undefined : Equal(d);
      }
      return undefined;
    }

    if (v.mode === "range") {
      // Range numerico
      const hasMin = typeof v.min === "number";
      const hasMax = typeof v.max === "number";
      if (hasMin && hasMax) return Between(v.min as number, v.max as number);
      if (hasMin) return MoreThanOrEqual(v.min as number);
      if (hasMax) return LessThanOrEqual(v.max as number);

      // Range date
      const from = typeof v.from === "string" && v.from ? new Date(v.from) : null;
      const to = typeof v.to === "string" && v.to ? new Date(v.to) : null;
      const fromValid = from && !isNaN(from.getTime()) ? from : null;
      const toValid = to && !isNaN(to.getTime()) ? to : null;
      if (fromValid && toValid) return Between(fromValid, toValid);
      if (fromValid) return MoreThanOrEqual(fromValid);
      if (toValid) return LessThanOrEqual(toValid);
      return undefined;
    }
  }

  return undefined;
}
