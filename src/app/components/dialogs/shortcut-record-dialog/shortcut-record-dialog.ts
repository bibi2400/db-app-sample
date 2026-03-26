import { Component, ChangeDetectionStrategy, inject, signal, HostListener } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { KeyBinding, ShortcutDefinition } from '../../../types/shortcut';
import { ShortcutService } from 'src/app/services/system-services/shortcut.service';

export interface ShortcutRecordDialogData {
  shortcut: ShortcutDefinition;
}

@Component({
  selector: 'app-shortcut-record-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './shortcut-record-dialog.html',
  styleUrl: './shortcut-record-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShortcutRecordDialog {
  private dialogRef = inject(MatDialogRef<ShortcutRecordDialog>);
  private shortcutService = inject(ShortcutService);
  data = inject<ShortcutRecordDialogData>(MAT_DIALOG_DATA);

  recording = signal<KeyBinding | null>(null);
  conflict = signal<ShortcutDefinition | null>(null);
  waiting = signal(true);

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return;

    const binding: KeyBinding = { key: event.key };
    if (event.ctrlKey) binding.ctrl = true;
    if (event.shiftKey) binding.shift = true;
    if (event.altKey) binding.alt = true;
    if (event.metaKey) binding.meta = true;

    this.recording.set(binding);
    this.waiting.set(false);
    this.conflict.set(
      this.shortcutService.findConflict(binding, this.data.shortcut.id) ?? null
    );
  }

  confirm(): void {
    const binding = this.recording();
    if (binding) {
      this.dialogRef.close(binding);
    }
  }

  formatBinding(binding: KeyBinding): string {
    return this.shortcutService.formatBinding(binding);
  }
}
