import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { NoteInfo, NoteSortDirection, NoteSortField } from '../../../shared/types/note';
import { DialogService } from '../../services/dialog.service';
import { ElectronNoteService } from '../../services/electron-api/electron-note.service';
import {
  EafNoteFormDialog,
  type EafNoteFormDialogData,
  type EafNoteFormDialogResult,
} from '../dialogs/eaf-note-form-dialog/eaf-note-form-dialog';

/**
 * Componente per la gestione delle note associate a un owner polimorfico.
 *
 * Funzionalità incluse:
 * - Lista note con pin (note pinnate sempre in cima), data e contenuto
 * - Aggiunta, modifica ed eliminazione di singole note
 * - Data nota liberamente impostabile nel passato
 * - Pin/unpin rapido con ripristino dell'ordinamento
 * - Copia contenuto negli appunti (un click)
 * - Selezione multipla + bulk delete
 * - Ricerca sul contenuto (debounce 300ms)
 * - Ordinamento per `noteDate`, `createdAt` o `content` con direzione asc/desc
 * - Modalità `inline` (form espandibile) o `dialog` (MatDialog)
 * - Opzione `maxLength` con contatore caratteri
 *
 * Uso minimo:
 * ```html
 * <eaf-notes ownerType="product" [ownerId]="product.id" />
 * ```
 *
 * Uso completo:
 * ```html
 * <eaf-notes
 *   ownerType="product"
 *   [ownerId]="product.id"
 *   title="Note sul prodotto"
 *   mode="dialog"
 *   [maxLength]="500"
 *   [readonly]="!canEdit()"
 * />
 * ```
 */
@Component({
  selector: 'eaf-notes',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './eaf-notes.html',
  styleUrl: './eaf-notes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EafNotes {
  // ─── Inputs ───────────────────────────────────────────────────────────────

  /** Tipo dell'owner (es. `'product'`, `'customer'`). */
  readonly ownerType = input.required<string>();

  /** ID numerico dell'owner. */
  readonly ownerId = input.required<number>();

  /** Titolo mostrato nell'header del componente. */
  readonly title = input<string>('Note');

  /**
   * Modalità di inserimento/modifica:
   * - `'inline'` (default) — form espandibile sotto la toolbar
   * - `'dialog'` — form in MatDialog
   */
  readonly mode = input<'inline' | 'dialog'>('inline');

  /** Se `true`, nasconde i controlli di modifica (sola lettura). */
  readonly readonly = input<boolean>(false);

  /** Numero massimo di caratteri del contenuto (null = nessun limite). */
  readonly maxLength = input<number | null>(null);

  // ─── Services ─────────────────────────────────────────────────────────────

  private readonly electronNote = inject(ElectronNoteService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogService = inject(DialogService);

  // ─── State ────────────────────────────────────────────────────────────────

  protected readonly notes = signal<NoteInfo[]>([]);
  protected readonly loading = signal<boolean>(false);

  // Toolbar
  protected readonly searchText = signal<string>('');
  protected readonly sortField = signal<NoteSortField>('noteDate');
  protected readonly sortDirection = signal<NoteSortDirection>('DESC');

  // Selezione (bulk delete)
  protected readonly selectedIds = signal<Set<number>>(new Set());

  // Form inline
  protected readonly showInlineForm = signal<boolean>(false);
  protected readonly editingNote = signal<NoteInfo | null>(null);
  protected readonly formContent = signal<string>('');
  protected readonly formDate = signal<string>('');
  protected readonly formPinned = signal<boolean>(false);

  // Debounce ricerca
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  constructor() {
    /**
     * Ricarica le note automaticamente quando ownerType o ownerId cambiano.
     * Gestisce anche il caricamento iniziale (si esegue dopo il primo rendering).
     */
    effect(() => {
      this.ownerType();
      this.ownerId();
      untracked(() => {
        this.showInlineForm.set(false);
        this.editingNote.set(null);
        this.selectedIds.set(new Set());
        this.load();
      });
    });
  }

  // ─── Caricamento ──────────────────────────────────────────────────────────

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const notes = await this.electronNote.listByOwner(this.ownerType(), this.ownerId(), {
        search: this.searchText() || undefined,
        sortField: this.sortField(),
        sortDirection: this.sortDirection(),
      });
      this.notes.set(notes);
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Toolbar ──────────────────────────────────────────────────────────────

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.searchText.set(value);
      this.load();
    }, 300);
  }

  protected onSortFieldChange(value: NoteSortField): void {
    this.sortField.set(value);
    this.load();
  }

  protected toggleSortDirection(): void {
    this.sortDirection.update((d) => (d === 'DESC' ? 'ASC' : 'DESC'));
    this.load();
  }

  // ─── Add / Edit ───────────────────────────────────────────────────────────

  protected addNote(): void {
    if (this.mode() === 'dialog') {
      this.openFormDialog(null);
    } else {
      this.editingNote.set(null);
      this.formContent.set('');
      this.formDate.set(this.toDatetimeLocal(new Date()));
      this.formPinned.set(false);
      this.showInlineForm.set(true);
    }
  }

  protected editNote(note: NoteInfo): void {
    if (this.mode() === 'dialog') {
      this.openFormDialog(note);
    } else {
      this.editingNote.set(note);
      this.formContent.set(note.content);
      this.formDate.set(this.toDatetimeLocal(new Date(note.noteDate)));
      this.formPinned.set(note.pinned);
      this.showInlineForm.set(true);
    }
  }

  protected async saveInlineForm(): Promise<void> {
    const content = this.formContent().trim();
    if (!content) return;
    const noteDate = new Date(this.formDate()).toISOString();
    const pinned = this.formPinned();
    const editing = this.editingNote();

    if (editing) {
      await this.electronNote.update({ id: editing.id, content, noteDate, pinned });
    } else {
      await this.electronNote.create({
        content,
        noteDate,
        pinned,
        ownerType: this.ownerType(),
        ownerId: this.ownerId(),
      });
    }

    this.cancelInlineForm();
    await this.load();
  }

  protected cancelInlineForm(): void {
    this.showInlineForm.set(false);
    this.editingNote.set(null);
  }

  private async openFormDialog(note: NoteInfo | null): Promise<void> {
    const data: EafNoteFormDialogData = { note, maxLength: this.maxLength() };
    const ref = this.dialog.open<EafNoteFormDialog, EafNoteFormDialogData, EafNoteFormDialogResult | undefined>(
      EafNoteFormDialog,
      { data, width: '500px', disableClose: false },
    );
    const result = await ref.afterClosed().toPromise();
    if (!result) return;

    if (note) {
      await this.electronNote.update({ id: note.id, ...result });
    } else {
      await this.electronNote.create({
        ...result,
        ownerType: this.ownerType(),
        ownerId: this.ownerId(),
      });
    }
    await this.load();
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  protected async deleteNote(note: NoteInfo): Promise<void> {
    const confirmed = await this.dialogService.confirm(
      'Elimina nota',
      'Sei sicuro di voler eliminare questa nota?',
    );
    if (!confirmed) return;
    await this.electronNote.deleteOne(note.id);
    this.notes.update((ns) => ns.filter((n) => n.id !== note.id));
    this.selectedIds.update((ids) => {
      const s = new Set(ids);
      s.delete(note.id);
      return s;
    });
  }

  protected async bulkDelete(): Promise<void> {
    const count = this.selectedIds().size;
    const confirmed = await this.dialogService.confirm(
      'Elimina note',
      `Sei sicuro di voler eliminare ${count} ${count === 1 ? 'nota' : 'note'}?`,
    );
    if (!confirmed) return;
    const ids = Array.from(this.selectedIds());
    await this.electronNote.deleteMany(ids);
    this.notes.update((ns) => ns.filter((n) => !ids.includes(n.id)));
    this.selectedIds.set(new Set());
  }

  // ─── Pin ──────────────────────────────────────────────────────────────────

  protected async togglePin(note: NoteInfo): Promise<void> {
    await this.electronNote.update({ id: note.id, pinned: !note.pinned });
    // Reload per rispettare l'ordinamento (pinnate in cima)
    await this.load();
  }

  // ─── Copia negli appunti ──────────────────────────────────────────────────

  protected copyContent(note: NoteInfo): void {
    navigator.clipboard.writeText(note.content).catch(() => {
      /* Electron supporta clipboard API, errore improbabile */
    });
  }

  // ─── Selezione (bulk) ─────────────────────────────────────────────────────

  protected toggleSelect(id: number): void {
    this.selectedIds.update((ids) => {
      const s = new Set(ids);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  protected get allSelected(): boolean {
    const n = this.notes();
    return n.length > 0 && this.selectedIds().size === n.length;
  }

  protected get someSelected(): boolean {
    return this.selectedIds().size > 0 && this.selectedIds().size < this.notes().length;
  }

  protected toggleSelectAll(): void {
    if (this.allSelected) {
      this.selectedIds.set(new Set());
    } else {
      this.selectedIds.set(new Set(this.notes().map((n) => n.id)));
    }
  }

  // ─── Utilità ──────────────────────────────────────────────────────────────

  /**
   * Formatta una data ISO in formato italiano leggibile (es. `15/01/2024 10:30`).
   */
  protected formatDate(isoString: string): string {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString));
  }

  /**
   * Converte un oggetto Date nel formato `YYYY-MM-DDTHH:mm` per
   * `<input type="datetime-local">` usando il fuso orario locale.
   */
  private toDatetimeLocal(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
  }
}
