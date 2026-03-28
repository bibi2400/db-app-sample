import { Component, ChangeDetectionStrategy, inject, computed, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ShortcutDefinition, KeyBinding } from '../../types/shortcut';
import {
  ShortcutRecordDialog,
  ShortcutRecordDialogData,
} from '../../components/dialogs/shortcut-record-dialog/shortcut-record-dialog';
import { NavigationService } from '../../services/navigation.service';
import { ShortcutService } from '../../services/shortcut.service';

@Component({
  selector: 'app-shortcut-management',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  templateUrl: './shortcut-management.html',
  styleUrl: './shortcut-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShortcutManagement implements AfterViewInit {
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private route = inject(ActivatedRoute);
  private navigationService = inject(NavigationService);
  readonly shortcutService = inject(ShortcutService);

  readonly categories = computed(() => {
    const defs = this.shortcutService.definitions();
    const cats = new Map<string, ShortcutDefinition[]>();
    for (const d of defs) {
      const list = cats.get(d.category) ?? [];
      list.push(d);
      cats.set(d.category, list);
    }
    return Array.from(cats.entries());
  });

  constructor() {
    this.navigationService.setTitle('Scorciatoie da Tastiera', 'keyboard');
  }

  ngAfterViewInit(): void {
    const highlightId = this.route.snapshot.queryParamMap.get('highlight');
    if (!highlightId) return;

    setTimeout(() => {
      const el = document.getElementById(`shortcut-${highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('highlight');
      }

      const shortcut = this.shortcutService.definitions().find(d => d.id === highlightId);
      if (shortcut && !shortcut.currentBinding.key) {
        this.editShortcut(shortcut);
      }
    }, 300);
  }

  editShortcut(shortcut: ShortcutDefinition): void {
    this.shortcutService.suspend();

    const dialogRef = this.dialog.open(ShortcutRecordDialog, {
      data: { shortcut } satisfies ShortcutRecordDialogData,
      width: '420px',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result: KeyBinding | null) => {
      this.shortcutService.resume();
      if (result) {
        this.shortcutService.updateBinding(shortcut.id, result);
        this.snackBar.open(
          `Scorciatoia "${shortcut.name}" aggiornata a ${this.shortcutService.formatBinding(result)}`,
          'OK',
          { duration: 3000 },
        );
      }
    });
  }

  resetShortcut(shortcut: ShortcutDefinition): void {
    this.shortcutService.resetBinding(shortcut.id);
    this.snackBar.open(`Scorciatoia "${shortcut.name}" ripristinata`, 'OK', { duration: 3000 });
  }

  resetAll(): void {
    this.shortcutService.resetAll();
    this.snackBar.open('Tutte le scorciatoie ripristinate ai valori predefiniti', 'OK', { duration: 3000 });
  }

  isModified(shortcutId: string): boolean {
    return this.shortcutService.isModified(shortcutId);
  }

  formatBinding(binding: KeyBinding): string {
    return this.shortcutService.formatBinding(binding);
  }
}
