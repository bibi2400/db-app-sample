import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommandPaletteItem } from '../types/command-palette';
import { ShortcutService } from './shortcut.service';
import { DatabaseUiService } from './database-ui.service';

@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly databaseUi = inject(DatabaseUiService);
  private shortcutService = inject(ShortcutService);
  private router = inject(Router);
  private commands = new Map<string, CommandPaletteItem>();
  private shortcutSubs = new Map<string, Subscription>();

  readonly isOpen = signal(false);
  readonly items = signal<CommandPaletteItem[]>([]);

  formatShortcut(item: CommandPaletteItem): string | undefined {
    if (!item.shortcutId) return undefined;
    const binding = this.shortcutService.getBinding(item.shortcutId);
    return binding ? this.shortcutService.formatBinding(binding, '') : undefined;
  }

  register(item: CommandPaletteItem): void {
    if (!this.allowsCommand(item)) return;
    const wasDynamic = this.ensureShortcut(item);
    this.commands.set(item.id, item);
    if (wasDynamic) this.subscribeToShortcut(item);
    this.refreshItems();
  }

  registerMany(items: CommandPaletteItem[]): void {
    for (const item of items) {
      if (!this.allowsCommand(item)) continue;
      const wasDynamic = this.ensureShortcut(item);
      this.commands.set(item.id, item);
      if (wasDynamic) this.subscribeToShortcut(item);
    }
    this.refreshItems();
  }

  private ensureShortcut(item: CommandPaletteItem): boolean {
    const id = item.shortcutId ?? item.id;
    const wasDynamic = !this.shortcutService.getBinding(id);
    if (wasDynamic) {
      this.shortcutService.registerDynamic(id, item.label, item.description ?? '', item.category);
    }
    if (!item.shortcutId) {
      item.shortcutId = item.id;
    }
    return wasDynamic;
  }

  private allowsCommand(item: CommandPaletteItem): boolean {
    return this.databaseUi.allowsRoute(item.route)
      && this.databaseUi.allowsShortcut(item.id)
      && this.databaseUi.allowsShortcut(item.shortcutId ?? item.id);
  }

  private subscribeToShortcut(item: CommandPaletteItem): void {
    const shortcutId = item.shortcutId!;
    if (this.shortcutSubs.has(shortcutId)) return;
    const sub = this.shortcutService.on(shortcutId).subscribe(() => this.execute(item.id));
    this.shortcutSubs.set(shortcutId, sub);
  }

  unregister(id: string): void {
    const cmd = this.commands.get(id);
    if (cmd?.shortcutId) {
      this.shortcutSubs.get(cmd.shortcutId)?.unsubscribe();
      this.shortcutSubs.delete(cmd.shortcutId);
    }
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
