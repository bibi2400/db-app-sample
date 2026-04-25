import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  ElementRef,
  viewChild,
  OnDestroy,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { CommandPaletteItem } from '../../types/command-palette';
import { CommandPaletteService } from '../../services/command-palette.service';

@Component({
  selector: 'eaf-command-palette',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: './command-palette.html',
  styleUrl: './command-palette.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class CommandPalette implements OnDestroy {
  readonly paletteService = inject(CommandPaletteService);
  private router = inject(Router);
  private inputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly isOpen = this.paletteService.isOpen;
  readonly query = signal('');
  readonly selectedIndex = signal(0);

  readonly filteredItems = computed(() => {
    const q = this.query().toLowerCase().trim();
    const items = this.paletteService.items();
    if (!q) return items;
    return items.filter(item => this.fuzzyMatch(q, item));
  });

  readonly groupedItems = computed(() => {
    const items = this.filteredItems();
    const groups: { category: string; items: CommandPaletteItem[] }[] = [];
    let current: { category: string; items: CommandPaletteItem[] } | null = null;

    for (const item of items) {
      if (!current || current.category !== item.category) {
        current = { category: item.category, items: [] };
        groups.push(current);
      }
      current.items.push(item);
    }
    return groups;
  });

  private focusEffect = effect(() => {
    if (this.isOpen()) {
      // Delay to ensure DOM is rendered
      setTimeout(() => this.inputRef()?.nativeElement.focus(), 0);
    } else {
      this.query.set('');
      this.selectedIndex.set(0);
    }
  });

  ngOnDestroy(): void {
    this.focusEffect.destroy();
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    this.selectedIndex.set(0);
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) return;

    const items = this.filteredItems();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex.update(i => (i + 1) % Math.max(items.length, 1));
        this.scrollToSelected();
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex.update(i => (i - 1 + items.length) % Math.max(items.length, 1));
        this.scrollToSelected();
        break;

      case 'Enter':
        event.preventDefault();
        if (items[this.selectedIndex()]) {
          this.paletteService.execute(items[this.selectedIndex()].id);
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.paletteService.close();
        break;
    }
  }

  executeItem(item: CommandPaletteItem): void {
    this.paletteService.execute(item.id);
  }

  goToShortcut(item: CommandPaletteItem, event: MouseEvent): void {
    event.stopPropagation();
    this.paletteService.close();
    this.router.navigate(['/shortcuts'], { queryParams: { highlight: item.shortcutId } });
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('command-palette-backdrop')) {
      this.paletteService.close();
    }
  }

  getFlatIndex(item: CommandPaletteItem): number {
    return this.filteredItems().indexOf(item);
  }

  private fuzzyMatch(query: string, item: CommandPaletteItem): boolean {
    const haystack = `${item.label} ${item.description ?? ''} ${item.category}`.toLowerCase();
    // Simple substring match per token
    return query.split(/\s+/).every(token => haystack.includes(token));
  }

  private scrollToSelected(): void {
    setTimeout(() => {
      const el = document.querySelector('.command-palette-item.selected');
      el?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }
}
