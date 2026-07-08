import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface EafPromptDialogData {
  title: string;
  /** Una o più righe di testo mostrate sopra il campo di input. */
  message?: string | string[];
  /** Label del campo di testo (default: uguale a `title`). */
  label?: string;
  /** Valore pre-compilato nel campo. */
  defaultValue?: string;
  /** Placeholder del campo. */
  placeholder?: string;
  /** Label del bottone di conferma (default: 'Conferma'). */
  confirmLabel?: string;
  /** Label del bottone di annulla (default: 'Annulla'). */
  cancelLabel?: string;
  /**
   * Se `true` (default), il bottone Conferma è disabilitato finché il campo è vuoto.
   * Imposta `false` per consentire la conferma con campo vuoto.
   */
  required?: boolean;
}

/**
 * Dialog di input testo, da aprire tramite `DialogService.prompt()`.
 *
 * @example
 * const name = await this.dialogService.prompt({
 *   title: 'Nome sessione',
 *   message: 'Inserisci il nome della nuova sessione.',
 *   placeholder: 'es. Sessione 2026-07',
 * });
 * if (!name) return; // utente ha annullato
 */
@Component({
  selector: 'eaf-prompt-dialog',
  imports: [
    A11yModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './eaf-prompt-dialog.html',
  styleUrl: './eaf-prompt-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EafPromptDialog {
  private readonly dialogRef = inject(
    MatDialogRef<EafPromptDialog, string | undefined>,
  );
  protected readonly data = inject<EafPromptDialogData>(MAT_DIALOG_DATA);

  /** Valore corrente del campo di input. */
  protected readonly value = signal<string>(this.data.defaultValue ?? '');

  /**
   * `true` se il bottone Conferma deve essere abilitato.
   * Dipende da `required` (default: true) e dal contenuto del campo.
   */
  protected readonly canConfirm = computed(
    () => this.data.required === false || this.value().trim().length > 0,
  );

  protected get messages(): string[] {
    if (!this.data.message) return [];
    return Array.isArray(this.data.message)
      ? this.data.message
      : [this.data.message];
  }

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected confirm(): void {
    if (!this.canConfirm()) return;
    const trimmed = this.value().trim();
    this.dialogRef.close(trimmed || undefined);
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
