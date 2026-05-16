import { In, Like } from "typeorm";
import { Injectable } from "../../helpers/mini-pie/decorators";
import { Note } from "../../entities/note";
import { DataSourceService } from "./data-source.service";
import type {
  NoteInfo,
  CreateNoteRequest,
  UpdateNoteRequest,
  NoteQueryOptions,
  NoteSortField,
  NoteSortDirection,
} from "../../../shared/types/note";
import type { EafTableServerEvent, EafTableResult } from "../../../shared/types/eaf-table";
import { buildFindOptions } from "../../helpers/build-find-options";

/**
 * Servizio Electron per la gestione delle note.
 *
 * Le note sono polimorfiche: ogni nota può essere associata a un owner
 * tramite (ownerType, ownerId). Le note orfane hanno entrambi i campi null.
 *
 * Uso tipico in un controller consumer:
 * ```ts
 * @Controller({ prefix: 'product' })
 * export class ProductController extends BaseController {
 *   constructor(private readonly noteService: NoteService) { super(); }
 *
 *   @IpcHandler('get-notes')
 *   async getNotes(ownerId: number) {
 *     const notes = await this.noteService.listByOwner('product', ownerId);
 *     return this.success(notes);
 *   }
 * }
 * ```
 */
@Injectable()
export class NoteService {
  constructor(private readonly dataSourceService: DataSourceService) {}

  // ─── Private helpers ────────────────────────────────────────────────────────

  private repo() {
    return this.dataSourceService.model(Note);
  }

  private toInfo(note: Note): NoteInfo {
    return {
      id: note.id,
      content: note.content,
      noteDate: note.noteDate.toISOString(),
      pinned: note.pinned,
      ownerType: note.ownerType,
      ownerId: note.ownerId,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  /**
   * Crea una nuova nota.
   *
   * @example
   * ```ts
   * const note = await noteService.createNote({
   *   content: 'Riunione cliente',
   *   noteDate: '2024-01-15T10:30:00.000Z',
   *   ownerType: 'product',
   *   ownerId: 5,
   * });
   * ```
   */
  async createNote(req: CreateNoteRequest): Promise<NoteInfo> {
    const repo = this.repo();
    const note = repo.create({
      content: req.content,
      noteDate: new Date(req.noteDate),
      pinned: req.pinned ?? false,
      ownerType: req.ownerType ?? null,
      ownerId: req.ownerId ?? null,
    });
    const saved = await repo.save(note);
    return this.toInfo(saved);
  }

  /**
   * Aggiorna parzialmente una nota esistente (patch).
   * Lancia errore se la nota non esiste.
   */
  async updateNote(req: UpdateNoteRequest): Promise<NoteInfo> {
    const repo = this.repo();
    const note = await repo.findOneBy({ id: req.id });
    if (!note) throw new Error(`Note ${req.id} not found`);
    if (req.content !== undefined) note.content = req.content;
    if (req.noteDate !== undefined) note.noteDate = new Date(req.noteDate);
    if (req.pinned !== undefined) note.pinned = req.pinned;
    const saved = await repo.save(note);
    return this.toInfo(saved);
  }

  /** Elimina una nota per ID. Nessun errore se non esiste. */
  async deleteNote(id: number): Promise<void> {
    await this.repo().delete(id);
  }

  /**
   * Elimina più note in una sola operazione.
   * Usato per il bulk delete.
   *
   * @example
   * ```ts
   * await noteService.deleteMany([1, 2, 3]);
   * ```
   */
  async deleteMany(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await this.repo().delete(ids);
  }

  /** Recupera una nota per ID. Ritorna null se non trovata. */
  async getNote(id: number): Promise<NoteInfo | null> {
    const note = await this.repo().findOneBy({ id });
    return note ? this.toInfo(note) : null;
  }

  // ─── Query per owner ────────────────────────────────────────────────────────

  /**
   * Restituisce tutte le note di un owner con supporto a ricerca e ordinamento.
   *
   * - Le note pinnate sono sempre mostrate in cima.
   * - Se `options.search` è presente, filtra su `content` con LIKE.
   * - `sortField` default: `noteDate`; `sortDirection` default: `DESC`.
   *
   * @example
   * ```ts
   * const notes = await noteService.listByOwner('product', 5, {
   *   search: 'urgente',
   *   sortField: 'noteDate',
   *   sortDirection: 'DESC',
   * });
   * ```
   */
  async listByOwner(
    ownerType: string,
    ownerId: number,
    options?: NoteQueryOptions,
  ): Promise<NoteInfo[]> {
    const repo = this.repo();
    const sortField: NoteSortField = options?.sortField ?? "noteDate";
    const sortDir: NoteSortDirection = options?.sortDirection ?? "DESC";

    const qb = repo
      .createQueryBuilder("note")
      .where("note.ownerType = :ownerType AND note.ownerId = :ownerId", {
        ownerType,
        ownerId,
      });

    if (options?.search) {
      qb.andWhere("note.content LIKE :search", {
        search: `%${options.search}%`,
      });
    }

    // Pinnate sempre in cima, poi ordina per il campo richiesto
    qb.orderBy("note.pinned", "DESC").addOrderBy(`note.${sortField}`, sortDir);

    const notes = await qb.getMany();
    return notes.map((n: Note) => this.toInfo(n));
  }

  /** Conta le note di un owner. Utile per mostrare badge. */
  async countByOwner(ownerType: string, ownerId: number): Promise<number> {
    return this.repo().countBy({ ownerType, ownerId });
  }

  /** Elimina tutte le note di un owner. Usato alla cancellazione dell'owner. */
  async deleteByOwner(ownerType: string, ownerId: number): Promise<void> {
    await this.repo().delete({ ownerType, ownerId });
  }

  // ─── Global list (server-side, feature E) ───────────────────────────────────

  /**
   * Restituisce tutte le note con paginazione/sort/filter server-side.
   * Da usare con `EafTable [serverSide]="true"`.
   *
   * Le colonne filtrabili/ordinabili dalla EafTable sono quelle dell'entity Note:
   * `id`, `content`, `noteDate`, `pinned`, `ownerType`, `ownerId`, `createdAt`, `updatedAt`.
   *
   * @example
   * ```ts
   * // In un controller
   * @IpcHandler('list-all')
   * async listAll(event: EafTableServerEvent) {
   *   return this.success(await this.noteService.listAll(event));
   * }
   * ```
   */
  async listAll(event: EafTableServerEvent): Promise<EafTableResult<NoteInfo>> {
    const repo = this.repo();
    const options = buildFindOptions(event, repo);
    const [items, total] = await repo.findAndCount(options);
    return { items: items.map((n: Note) => this.toInfo(n)), total };
  }
}
