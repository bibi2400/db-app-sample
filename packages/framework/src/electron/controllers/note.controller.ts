import { BaseController } from "./base.controller";
import { Controller } from "../decorators/controller.decorator";
import { IpcHandler } from "../decorators/ipc-handler.decorator";
import { NoteService } from "../services/system-services/note.service";
import type { CreateNoteRequest, UpdateNoteRequest, NoteQueryOptions } from "../../shared/types/note";
import type { EafTableServerEvent } from "../../shared/types/eaf-table";

/**
 * Controller IPC per la gestione delle note.
 *
 * Prefisso: `note`
 *
 * Canali disponibili:
 * - `note:create`          — crea una nuova nota
 * - `note:update`          — aggiorna parzialmente una nota
 * - `note:delete`          — elimina una nota per ID
 * - `note:delete-many`     — elimina più note (bulk delete)
 * - `note:get`             — recupera una nota per ID
 * - `note:list-by-owner`   — lista note di un owner (con sort/filter)
 * - `note:count-by-owner`  — conta note di un owner
 * - `note:delete-by-owner` — elimina tutte le note di un owner
 * - `note:list-all`        — lista globale server-side (EafTableServerEvent)
 *
 * Esempio Angular:
 * ```ts
 * const notes = await window.electronAPI.invoke<IpcResponse<NoteInfo[]>>(
 *   'note:list-by-owner',
 *   { ownerType: 'product', ownerId: 5 }
 * );
 * ```
 */
@Controller({ prefix: "note" })
export class NoteController extends BaseController {
  constructor(private readonly noteService: NoteService) {
    super();
  }

  @IpcHandler("create")
  async create(req: CreateNoteRequest) {
    try {
      const note = await this.noteService.createNote(req);
      return this.success(note);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("update")
  async update(req: UpdateNoteRequest) {
    try {
      const note = await this.noteService.updateNote(req);
      return this.success(note);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("delete")
  async deleteOne(id: number) {
    try {
      await this.noteService.deleteNote(id);
      return this.success(true);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("delete-many")
  async deleteMany(ids: number[]) {
    try {
      await this.noteService.deleteMany(ids);
      return this.success(true);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("get")
  async getOne(id: number) {
    try {
      const note = await this.noteService.getNote(id);
      return this.success(note);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("list-by-owner")
  async listByOwner(params: { ownerType: string; ownerId: number; options?: NoteQueryOptions }) {
    try {
      const notes = await this.noteService.listByOwner(
        params.ownerType,
        params.ownerId,
        params.options,
      );
      return this.success(notes);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("count-by-owner")
  async countByOwner(params: { ownerType: string; ownerId: number }) {
    try {
      const count = await this.noteService.countByOwner(params.ownerType, params.ownerId);
      return this.success(count);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("delete-by-owner")
  async deleteByOwner(params: { ownerType: string; ownerId: number }) {
    try {
      await this.noteService.deleteByOwner(params.ownerType, params.ownerId);
      return this.success(true);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("list-all")
  async listAll(event: EafTableServerEvent) {
    try {
      const result = await this.noteService.listAll(event);
      return this.success(result);
    } catch (error) {
      return this.error(error);
    }
  }
}
