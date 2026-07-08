import { inject, Injectable } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { EafDialog, EafDialogData } from '../components/dialogs/eaf-dialog/eaf-dialog';
import { EafPromptDialog, EafPromptDialogData } from '../components/dialogs/eaf-prompt-dialog/eaf-prompt-dialog';

export type UnsavedChangesChoice = 'keep' | 'discard' | 'cancel' | 'save';
export type UnsavedChangesMode = 'create' | 'edit';

@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(MatDialog);

  /**
   * Apre un EafDialog generico configurabile.
   * Risolve con il `value` del pulsante premuto, o `undefined` se chiuso senza scelta.
   */
  async open<T>(data: EafDialogData<T>, options?: MatDialogConfig): Promise<T | undefined> {
    const ref = this.dialog.open(EafDialog<T>, { data, ...options });
    return firstValueFrom(ref.afterClosed());
  }

  /**
   * Dialog di conferma standard.
   * Risolve `true` se l'utente conferma, `false` altrimenti.
   */
  async confirm(title: string, message: string): Promise<boolean> {
    const result = await this.open<boolean>({
      title,
      message,
      buttons: [
        { label: 'Annulla', value: false },
        { label: 'Conferma', value: true, variant: 'flat', color: 'primary' },
      ],
    });
    return result === true;
  }

  /**
   * Dialog "modifiche non salvate".
   * Risolve con la scelta dell'utente, o `undefined` se chiuso senza scelta
   * (non dovrebbe accadere con disableClose: true).
   *
   * - `'create'` (default): [Annulla] [Scarta modifiche] [Mantieni in memoria]
   * - `'edit'`: [Annulla] [Scarta modifiche] [Salva]
   */
  async unsavedChanges(mode: UnsavedChangesMode = 'create'): Promise<UnsavedChangesChoice | undefined> {
    const buttons =
      mode === 'edit'
        ? ([
            { label: 'Annulla', value: 'cancel', icon: 'close' },
            { label: 'Scarta modifiche', value: 'discard', variant: 'stroked', color: 'warn', icon: 'delete_outline' },
            { label: 'Salva', value: 'save', variant: 'flat', color: 'primary', icon: 'save' },
          ] satisfies EafDialogData<UnsavedChangesChoice>['buttons'])
        : ([
            { label: 'Annulla', value: 'cancel', icon: 'close' },
            { label: 'Scarta modifiche', value: 'discard', variant: 'stroked', color: 'warn', icon: 'delete_outline' },
            { label: 'Mantieni in memoria', value: 'keep', variant: 'flat', color: 'primary', icon: 'save_alt' },
          ] satisfies EafDialogData<UnsavedChangesChoice>['buttons']);

    return this.open<UnsavedChangesChoice>(
      {
        title: 'Modifiche non salvate',
        titleIcon: 'warning',
        titleIconColor: '#f57c00',
        message: ['Hai modifiche non salvate nel form.', 'Cosa vuoi fare?'],
        buttons,
      },
      { disableClose: true, width: '480px' },
    );
  }

  /**
   * Dialog di input testo. Sostituisce `window.prompt()`, non supportato da Electron.
   * Risolve con la stringa inserita (trimmed), o `undefined` se l'utente annulla.
   *
   * @example
   * const name = await this.dialogService.prompt({ title: 'Nome sessione' });
   * if (!name) return;
   *
   * @example
   * const renamed = await this.dialogService.prompt({
   *   title: 'Rinomina',
   *   message: 'Inserisci il nuovo nome.',
   *   defaultValue: currentName,
   *   placeholder: 'Nuovo nome...',
   * });
   */
  async prompt(options: EafPromptDialogData): Promise<string | undefined> {
    const ref = this.dialog.open<EafPromptDialog, EafPromptDialogData, string | undefined>(
      EafPromptDialog,
      { data: options, width: '400px' },
    );
    return firstValueFrom(ref.afterClosed());
  }
}
