import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import type { NoteInfo } from '../../../../shared/types/note';

/** Dati in ingresso al dialog di aggiunta/modifica nota. */
export interface EafNoteFormDialogData {
  /** Nota da modificare; `null` indica la creazione di una nuova nota. */
  note: NoteInfo | null;
  /** Limite massimo di caratteri per il contenuto (null = nessun limite). */
  maxLength: number | null;
}

/** Risultato restituito dal dialog alla chiusura. */
export interface EafNoteFormDialogResult {
  content: string;
  /** Data/ora della nota in formato ISO 8601. */
  noteDate: string;
  pinned: boolean;
}

/**
 * Dialog interno di `EafNotes` per la creazione/modifica di una nota.
 * Non è necessario esportarlo dall'angular index: viene usato solo da EafNotes.
 *
 * @internal
 */
@Component({
  selector: 'eaf-note-form-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatCheckboxModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: `./eaf-note-form-dialog.html`,
  styleUrls: [`./eaf-note-form-dialog.scss`],
})
export class EafNoteFormDialog {
  protected readonly data = inject<EafNoteFormDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(
    MatDialogRef<EafNoteFormDialog, EafNoteFormDialogResult | undefined>,
  );

  protected readonly formContent = signal<string>(this.data.note?.content ?? '');
  protected readonly formDate = signal<string>(
    this.data.note
      ? this.toDatetimeLocal(new Date(this.data.note.noteDate))
      : this.toDatetimeLocal(new Date()),
  );
  protected readonly formPinned = signal<boolean>(this.data.note?.pinned ?? false);

  protected save(): void {
    const content = this.formContent().trim();
    if (!content) return;
    this.dialogRef.close({
      content,
      noteDate: new Date(this.formDate()).toISOString(),
      pinned: this.formPinned(),
    });
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }

  /**
   * Converte un oggetto Date nel formato atteso da `<input type="datetime-local">`.
   * Usa il fuso orario locale del sistema (utente Electron).
   */
  private toDatetimeLocal(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
  }
}
