import { Injectable } from '@angular/core';
import { EafTableState } from '../types/eaf-table.types';

const STORAGE_PREFIX = 'eaf-table:';

@Injectable({
  providedIn: 'root'
})
export class EafTableStorageService {

  /** Carica lo stato di una tabella dal localStorage */
  load(tableId: string): EafTableState | null {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + tableId);
      return raw ? JSON.parse(raw) as EafTableState : null;
    } catch {
      return null;
    }
  }

  /** Salva lo stato di una tabella nel localStorage */
  save(tableId: string, state: EafTableState): void {
    try {
      localStorage.setItem(STORAGE_PREFIX + tableId, JSON.stringify(state));
    } catch {
      // quota exceeded — ignora silenziosamente
    }
  }

  /** Rimuove lo stato di una tabella dal localStorage */
  clear(tableId: string): void {
    localStorage.removeItem(STORAGE_PREFIX + tableId);
  }

  /** Salva la posizione di scroll di una tabella nel localStorage */
  saveScrollTop(tableId: string, scrollTop: number): void {
    try {
      const existing = this.load(tableId) ?? {};
      existing.scrollTop = scrollTop;
      localStorage.setItem(STORAGE_PREFIX + tableId, JSON.stringify(existing));
    } catch {
      // quota exceeded — ignora silenziosamente
    }
  }

  /** Carica la posizione di scroll di una tabella dal localStorage */
  loadScrollTop(tableId: string): number {
    return this.load(tableId)?.scrollTop ?? 0;
  }
}
