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
  template: `
    <h2 mat-dialog-title>
      @if (data.titleIcon) {
        <mat-icon [style.color]="data.titleIconColor ?? null">{{ data.titleIcon }}</mat-icon>
      }
      {{ data.title }}
    </h2>
    @if (messages.length) {
      <mat-dialog-content>
        @for (line of messages; track $index) {
          <p>{{ line }}</p>
        }
      </mat-dialog-content>
    }
    <mat-dialog-actions align="end">
      @for (btn of data.buttons; track btn.label) {
        @switch (btn.variant) {
          @case ('stroked') {
            <button mat-stroked-button [color]="btn.color ?? null" (click)="close(btn.value)">
              @if (btn.icon) { <mat-icon>{{ btn.icon }}</mat-icon> }
              {{ btn.label }}
            </button>
          }
          @case ('flat') {
            <button mat-flat-button [color]="btn.color ?? null" (click)="close(btn.value)">
              @if (btn.icon) { <mat-icon>{{ btn.icon }}</mat-icon> }
              {{ btn.label }}
            </button>
          }
          @default {
            <button mat-button [color]="btn.color ?? null" (click)="close(btn.value)">
              @if (btn.icon) { <mat-icon>{{ btn.icon }}</mat-icon> }
              {{ btn.label }}
            </button>
          }
        }
      }
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; }
    h2 { display: flex; align-items: center; gap: 8px; margin: 0; }
    mat-dialog-content p { margin: 8px 0; white-space: pre-line; }
    mat-dialog-actions { gap: 8px; }
  `],
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
