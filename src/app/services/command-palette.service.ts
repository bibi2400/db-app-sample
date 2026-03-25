import { Injectable, signal } from '@angular/core';
import { CommandPaletteItem } from '../types/command-palette';

@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private commands = new Map<string, CommandPaletteItem>();

  readonly isOpen = signal(false);
  readonly items = signal<CommandPaletteItem[]>([]);

  register(item: CommandPaletteItem): void {
    this.commands.set(item.id, item);
    this.refreshItems();
  }

  registerMany(items: CommandPaletteItem[]): void {
    for (const item of items) {
      this.commands.set(item.id, item);
    }
    this.refreshItems();
  }

  unregister(id: string): void {
    this.commands.delete(id);
    this.refreshItems();
  }

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    this.isOpen.update(v => !v);
  }

  execute(id: string): void {
    const cmd = this.commands.get(id);
    if (cmd) {
      this.close();
      cmd.action();
    }
  }

  private refreshItems(): void {
    this.items.set(
      Array.from(this.commands.values())
        .sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label))
    );
  }
}
