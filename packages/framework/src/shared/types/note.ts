/**
 * Tipo condiviso per una nota persistita a DB.
 *
 * Le note sono polimorfiche: ogni nota può essere associata a un owner
 * tramite la coppia (ownerType, ownerId). Le note senza owner hanno entrambi i
 * campi a null.
 *
 * Esempio — caricare le note di un prodotto:
 * ```ts
 * // Electron service
 * const notes = await this.noteService.listByOwner('product', product.id);
 *
 * // Angular (via ElectronNoteService)
 * const notes = await this.electronNote.listByOwner('product', product.id);
 * ```
 */
export interface NoteInfo {
  id: number;
  content: string;
  /** Data/ora della nota in formato ISO 8601. Può essere nel passato. */
  noteDate: string;
  pinned: boolean;
  ownerType: string | null;
  ownerId: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload per la creazione di una nuova nota.
 *
 * Esempio:
 * ```ts
 * await this.noteService.createNote({
 *   content: 'Nota di esempio',
 *   noteDate: new Date().toISOString(),
 *   ownerType: 'product',
 *   ownerId: 42,
 * });
 * ```
 */
export interface CreateNoteRequest {
  content: string;
  noteDate: string;
  pinned?: boolean;
  ownerType?: string;
  ownerId?: number;
}

/**
 * Payload per l'aggiornamento di una nota esistente.
 * Tutti i campi tranne `id` sono opzionali (patch parziale).
 */
export interface UpdateNoteRequest {
  id: number;
  content?: string;
  noteDate?: string;
  pinned?: boolean;
}

/** Campi su cui è possibile ordinare le note. */
export type NoteSortField = 'noteDate' | 'createdAt' | 'content';

/** Direzione di ordinamento. */
export type NoteSortDirection = 'ASC' | 'DESC';

/**
 * Opzioni di ricerca/ordinamento per `listByOwner`.
 *
 * Esempio:
 * ```ts
 * await this.noteService.listByOwner('product', 1, {
 *   search: 'urgente',
 *   sortField: 'noteDate',
 *   sortDirection: 'DESC',
 * });
 * ```
 */
export interface NoteQueryOptions {
  /** Testo libero: filtra su `content` con LIKE case-insensitive. */
  search?: string;
  /** Campo di ordinamento (default: `noteDate`). */
  sortField?: NoteSortField;
  /** Direzione di ordinamento (default: `DESC`). */
  sortDirection?: NoteSortDirection;
}
