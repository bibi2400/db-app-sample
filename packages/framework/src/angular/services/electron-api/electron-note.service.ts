import { Injectable } from '@angular/core';
import { IpcResponse } from '../../types/global';
import type {
  NoteInfo,
  CreateNoteRequest,
  UpdateNoteRequest,
  NoteQueryOptions,
  EafTableServerEvent,
  EafTableResult,
} from '@bibi2400/electron-angular-framework/shared';

/**
 * Angular wrapper attorno ai canali IPC `note:*`.
 *
 * Tutti i metodi delegano a `window.electronAPI.invoke` e restituiscono il dato
 * direttamente (null in caso di errore) per semplificare l'uso nel template.
 *
 * Uso base:
 * ```ts
 * // In un component/page Angular
 * private readonly electronNote = inject(ElectronNoteService);
 *
 * // Lista note di un prodotto
 * const notes = await this.electronNote.listByOwner('product', 5);
 *
 * // Crea una nota
 * await this.electronNote.create({
 *   content: 'Prima nota',
 *   noteDate: new Date().toISOString(),
 *   ownerType: 'product',
 *   ownerId: 5,
 * });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ElectronNoteService {
  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(req: CreateNoteRequest): Promise<NoteInfo | null> {
    const r = await window.electronAPI.invoke<IpcResponse<NoteInfo>>('note:create', req);
    return r.success && r.data ? r.data : null;
  }

  async update(req: UpdateNoteRequest): Promise<NoteInfo | null> {
    const r = await window.electronAPI.invoke<IpcResponse<NoteInfo>>('note:update', req);
    return r.success && r.data ? r.data : null;
  }

  async deleteOne(id: number): Promise<boolean> {
    const r = await window.electronAPI.invoke<IpcResponse<boolean>>('note:delete', id);
    return r.success;
  }

  /**
   * Elimina più note in una sola chiamata IPC.
   * Usato per il bulk delete dal componente `EafNotes`.
   */
  async deleteMany(ids: number[]): Promise<boolean> {
    const r = await window.electronAPI.invoke<IpcResponse<boolean>>('note:delete-many', ids);
    return r.success;
  }

  async get(id: number): Promise<NoteInfo | null> {
    const r = await window.electronAPI.invoke<IpcResponse<NoteInfo | null>>('note:get', id);
    return r.success && r.data ? r.data : null;
  }

  // ─── Query per owner ──────────────────────────────────────────────────────

  /**
   * Recupera le note di un owner con opzioni di ricerca e ordinamento.
   *
   * Le note pinnate sono sempre restituite in cima.
   *
   * @example
   * ```ts
   * const notes = await this.electronNote.listByOwner('product', 5, {
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
    const r = await window.electronAPI.invoke<IpcResponse<NoteInfo[]>>(
      'note:list-by-owner',
      { ownerType, ownerId, options },
    );
    return r.success && r.data ? r.data : [];
  }

  async countByOwner(ownerType: string, ownerId: number): Promise<number> {
    const r = await window.electronAPI.invoke<IpcResponse<number>>(
      'note:count-by-owner',
      { ownerType, ownerId },
    );
    return r.success && r.data != null ? r.data : 0;
  }

  async deleteByOwner(ownerType: string, ownerId: number): Promise<boolean> {
    const r = await window.electronAPI.invoke<IpcResponse<boolean>>(
      'note:delete-by-owner',
      { ownerType, ownerId },
    );
    return r.success;
  }

  // ─── Global list (server-side, feature E) ─────────────────────────────────

  /**
   * Lista globale di tutte le note con paginazione server-side.
   * Pensato per essere usato con `<eaf-table [serverSide]="true">`.
   *
   * @example
   * ```ts
   * onServerEvent(event: EafTableServerEvent) {
   *   this.electronNote.listAll(event).then(result => {
   *     this.notes.set(result.items);
   *     this.totalRows.set(result.total);
   *   });
   * }
   * ```
   */
  async listAll(event: EafTableServerEvent): Promise<EafTableResult<NoteInfo>> {
    const r = await window.electronAPI.invoke<IpcResponse<EafTableResult<NoteInfo>>>(
      'note:list-all',
      event,
    );
    return r.success && r.data ? r.data : { items: [], total: 0 };
  }
}
