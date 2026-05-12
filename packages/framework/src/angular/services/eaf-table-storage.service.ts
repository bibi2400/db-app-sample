import { Injectable } from '@angular/core';
import { EafTableState } from '../types/eaf-table.types';
import { StorageType } from '../types/storage.types';

const STORAGE_PREFIX = 'eaf-table:';

@Injectable({
  providedIn: 'root'
})
export class EafTableStorageService {

  /** Carica lo stato di una tabella dallo storage specificato */
  load(tableId: string, storageType: StorageType): EafTableState | null {
    if (storageType === 'none') return null;
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    try {
      const raw = storage.getItem(STORAGE_PREFIX + tableId);
      return raw ? JSON.parse(raw) as EafTableState : null;
    } catch {
      return null;
    }
  }

  /** Salva lo stato di una tabella nello storage specificato */
  save(tableId: string, state: EafTableState, storageType: StorageType): void {
    if (storageType === 'none') return;
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    try {
      storage.setItem(STORAGE_PREFIX + tableId, JSON.stringify(state));
    } catch {
      // quota exceeded — ignora silenziosamente
    }
  }

  /** Rimuove lo stato di una tabella da entrambi gli storage */
  clear(tableId: string): void {
    try { localStorage.removeItem(STORAGE_PREFIX + tableId); } catch { /* ignore */ }
    try { sessionStorage.removeItem(STORAGE_PREFIX + tableId); } catch { /* ignore */ }
  }
}
