import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { KeyBinding, ShortcutDefinition, ShortcutEntry } from '../types/shortcut';
import { SHORTCUT_REGISTRY } from './shortcut-registry';

const STORAGE_KEY = 'app-shortcut-bindings';

@Injectable({ providedIn: 'root' })
export class ShortcutService {
  private ngZone = inject(NgZone);
  private subjects = new Map<string, Subject<KeyboardEvent>>();
  private bindings = new Map<string, KeyBinding>();
  private suspended = false;
  private boundHandler: (e: KeyboardEvent) => void;

  readonly definitions = signal<ShortcutDefinition[]>([]);

  constructor() {
    const overrides = this.loadOverrides();

    for (const [id, entry] of Object.entries(SHORTCUT_REGISTRY)) {
      this.bindings.set(id, overrides[id] ?? { ...entry.defaultBinding });
      this.subjects.set(id, new Subject<KeyboardEvent>());
    }

    this.refreshDefinitions();

    this.boundHandler = (e: KeyboardEvent) => this.handleKeydown(e);
    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('keydown', this.boundHandler);
    });
  }

  /**
   * Sottoscriviti a uno shortcut per ID.
   * Restituisce un Observable che emette il KeyboardEvent ogni volta
   * che la combinazione di tasti associata viene premuta.
   */
  on(shortcutId: string): Observable<KeyboardEvent> {
    const subject = this.subjects.get(shortcutId);
    if (!subject) {
      console.warn(`Shortcut "${shortcutId}" non registrato nel registry`);
      return new Observable();
    }
    return subject.asObservable();
  }

  /** Sospendi temporaneamente la gestione degli shortcut (es. durante la registrazione). */
  suspend(): void {
    this.suspended = true;
  }

  /** Riprendi la gestione degli shortcut. */
  resume(): void {
    this.suspended = false;
  }

  updateBinding(shortcutId: string, binding: KeyBinding): void {
    this.bindings.set(shortcutId, binding);
    this.saveOverrides();
    this.refreshDefinitions();
  }

  resetBinding(shortcutId: string): void {
    const entry = SHORTCUT_REGISTRY[shortcutId];
    if (entry) {
      this.bindings.set(shortcutId, { ...entry.defaultBinding });
      this.saveOverrides();
      this.refreshDefinitions();
    }
  }

  resetAll(): void {
    for (const [id, entry] of Object.entries(SHORTCUT_REGISTRY)) {
      this.bindings.set(id, { ...entry.defaultBinding });
    }
    localStorage.removeItem(STORAGE_KEY);
    this.refreshDefinitions();
  }

  getBinding(shortcutId: string): KeyBinding | undefined {
    return this.bindings.get(shortcutId);
  }

  findConflict(binding: KeyBinding, excludeId?: string): ShortcutDefinition | undefined {
    return this.definitions().find(d =>
      d.id !== excludeId && this.bindingsEqual(d.currentBinding, binding)
    );
  }

  registerDynamic(id: string, name: string, description: string, category: string): void {
    if (SHORTCUT_REGISTRY[id]) return;
    SHORTCUT_REGISTRY[id] = {
      name,
      description,
      category,
      defaultBinding: { key: '' },
    };
    const overrides = this.loadOverrides();
    this.bindings.set(id, overrides[id] ?? { key: '' });
    this.subjects.set(id, new Subject<KeyboardEvent>());
    this.refreshDefinitions();
  }

  /**
   * Registra uno shortcut con la definizione completa (incluso binding di default).
   * Usato dal consumer per aggiungere shortcut personalizzati.
   */
  register(id: string, entry: ShortcutEntry): void {
    if (SHORTCUT_REGISTRY[id]) return;
    SHORTCUT_REGISTRY[id] = entry;
    const overrides = this.loadOverrides();
    this.bindings.set(id, overrides[id] ?? { ...entry.defaultBinding });
    this.subjects.set(id, new Subject<KeyboardEvent>());
    this.refreshDefinitions();
  }

  /**
   * Registra più shortcut in batch.
   * Usato dal consumer per registrare tutti gli shortcut dell'app in una volta.
   */
  registerMany(shortcuts: Record<string, ShortcutEntry>): void {
    const overrides = this.loadOverrides();
    for (const [id, entry] of Object.entries(shortcuts)) {
      if (SHORTCUT_REGISTRY[id]) continue;
      SHORTCUT_REGISTRY[id] = entry;
      this.bindings.set(id, overrides[id] ?? { ...entry.defaultBinding });
      this.subjects.set(id, new Subject<KeyboardEvent>());
    }
    this.refreshDefinitions();
  }

  formatBinding(binding: KeyBinding, notFoundText = 'Non assegnata'): string {
    if (!binding.key) return notFoundText;
    const parts: string[] = [];
    if (binding.ctrl) parts.push('Ctrl');
    if (binding.alt) parts.push('Alt');
    if (binding.shift) parts.push('Shift');
    if (binding.meta) parts.push('Meta');
    parts.push(this.formatKey(binding.key));
    return parts.join(' + ');
  }

  isModified(shortcutId: string): boolean {
    const entry = SHORTCUT_REGISTRY[shortcutId];
    if (!entry) return false;
    const current = this.bindings.get(shortcutId);
    if (!current) return false;
    return !this.bindingsEqual(current, entry.defaultBinding);
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (this.suspended) return;

    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    for (const [id, binding] of this.bindings) {
      if (this.matchesBinding(event, binding)) {
        event.preventDefault();
        event.stopPropagation();
        const subject = this.subjects.get(id)!;
        this.ngZone.run(() => subject.next(event));
        return;
      }
    }
  }

  private matchesBinding(event: KeyboardEvent, binding: KeyBinding): boolean {
    return (
      event.key.toLowerCase() === binding.key.toLowerCase() &&
      event.ctrlKey === (binding.ctrl ?? false) &&
      event.shiftKey === (binding.shift ?? false) &&
      event.altKey === (binding.alt ?? false) &&
      event.metaKey === (binding.meta ?? false)
    );
  }

  private bindingsEqual(a: KeyBinding, b: KeyBinding): boolean {
    return (
      a.key.toLowerCase() === b.key.toLowerCase() &&
      (a.ctrl ?? false) === (b.ctrl ?? false) &&
      (a.shift ?? false) === (b.shift ?? false) &&
      (a.alt ?? false) === (b.alt ?? false) &&
      (a.meta ?? false) === (b.meta ?? false)
    );
  }

  private formatKey(key: string): string {
    const special: Record<string, string> = {
      ' ': 'Space',
      'arrowup': '↑', 'arrowdown': '↓', 'arrowleft': '←', 'arrowright': '→',
      'escape': 'Esc', 'enter': 'Invio', 'tab': 'Tab',
      'backspace': 'Backspace', 'delete': 'Canc',
      'home': 'Home', 'end': 'End', 'pageup': 'PgSu', 'pagedown': 'PgGiù',
    };
    return special[key.toLowerCase()] ?? key.toUpperCase();
  }

  private refreshDefinitions(): void {
    const defs: ShortcutDefinition[] = Object.entries(SHORTCUT_REGISTRY).map(([id, entry]) => ({
      id,
      ...entry,
      currentBinding: this.bindings.get(id) ?? { ...entry.defaultBinding },
    }));
    this.definitions.set(defs);
  }

  private loadOverrides(): Record<string, KeyBinding> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveOverrides(): void {
    const overrides: Record<string, KeyBinding> = {};
    for (const [id, binding] of this.bindings) {
      const entry = SHORTCUT_REGISTRY[id];
      if (entry && !this.bindingsEqual(binding, entry.defaultBinding)) {
        overrides[id] = binding;
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  }
}
