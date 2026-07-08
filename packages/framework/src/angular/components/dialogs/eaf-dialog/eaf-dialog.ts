import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface EafDialogButton<T = unknown> {
  label: string;
  /** Valore restituito da afterClosed() quando si clicca questo pulsante. */
  value: T;
  variant?: 'text' | 'stroked' | 'flat';
  color?: 'primary' | 'warn' | 'accent';
  icon?: string;
}

export interface EafDialogData<T = unknown> {
  title: string;
  /** Icona Material mostrata accanto al titolo. */
  titleIcon?: string;
  /** Colore CSS dell'icona del titolo (es. '#f57c00'). */
  titleIconColor?: string;
  /** Una o più righe di testo nel body del dialog. */
  message?: string | string[];
  buttons: EafDialogButton<T>[];
}

@Component({
  selector: 'eaf-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './eaf-dialog.html',
  styleUrls: ['./eaf-dialog.scss'],
})
export class EafDialog<T = unknown> {
  private readonly dialogRef = inject(MatDialogRef<EafDialog<T>, T>);
  protected readonly data = inject<EafDialogData<T>>(MAT_DIALOG_DATA);

  protected get messages(): string[] {
    if (!this.data.message) return [];
    return Array.isArray(this.data.message) ? this.data.message : [this.data.message];
  }

  close(value: T): void {
    this.dialogRef.close(value);
  }
}
