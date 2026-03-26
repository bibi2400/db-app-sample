import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommandPaletteItem } from '../../types/command-palette';
import { ShortcutService } from './shortcut.service';

@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private shortcutService = inject(ShortcutService);
  private router = inject(Router);
  private commands = new Map<string, CommandPaletteItem>();

  readonly isOpen = signal(false);
  readonly items = signal<CommandPaletteItem[]>([]);

  formatShortcut(item: CommandPaletteItem): string | undefined {
    if (!item.shortcutId) return undefined;
    const binding = this.shortcutService.getBinding(item.shortcutId);
    return binding ? this.shortcutService.formatBinding(binding, '') : undefined;
  }

  register(item: CommandPaletteItem): void {
    this.ensureShortcut(item);
    this.commands.set(item.id, item);
    this.refreshItems();
  }

  registerMany(items: CommandPaletteItem[]): void {
    for (const item of items) {
      this.ensureShortcut(item);
      this.commands.set(item.id, item);
    }
    this.refreshItems();
  }

  private ensureShortcut(item: CommandPaletteItem): void {
    const id = item.shortcutId ?? item.id;
    if (!this.shortcutService.getBinding(id)) {
      this.shortcutService.registerDynamic(id, item.label, item.description ?? '', item.category);
    }
    if (!item.shortcutId) {
      item.shortcutId = item.id;
    }
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

  async execute(id: string): Promise<void> {
    const cmd = this.commands.get(id);
    if (!cmd) return;
    this.close();
    if (cmd.route) {
      await this.router.navigate([cmd.route]);
    }
    cmd.action();
  }

  private refreshItems(): void {
    this.items.set(
      Array.from(this.commands.values())
        .sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label))
    );
  }
}
