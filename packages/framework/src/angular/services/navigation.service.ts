import { inject, Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export type MenuItem = {
  title: string;
  icon: string;
  route?: string;
  queryParams?: Record<string, string>;
  children?: MenuItem[];
}

/** Posizioni in cui il consumer può inserire le proprie voci di menu */
export type MenuInsertPosition = 'before-settings' | 'after-settings';

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  private readonly stockItems: MenuItem[] = [
    {
      title: 'Notifiche',
      icon: 'notifications',
      route: '/notifications'
    },
    {
      title: 'Impostazioni',
      icon: 'settings',
      children: [
        {
          title: 'Backup Database',
          icon: 'backup',
          route: '/backup'
        },
        {
          title: 'Aggiornamenti',
          icon: 'system_update',
          route: '/updates'
        },
        {
          title: 'Scorciatoie',
          icon: 'keyboard',
          route: '/shortcuts'
        },
        {
          title: 'Info Applicazione',
          icon: 'info',
          route: '/app-info'
        }
      ]
    }
  ];

  private consumerItems: { items: MenuItem[]; position: MenuInsertPosition }[] = [];
  private homeItem: MenuItem = { title: 'Dashboard', icon: 'dashboard', route: '/dashboard' };

  menu: MenuItem[] = this.buildMenu();

  activeLink = signal<MenuItem>(this.menu[0]);
  expandedMenus = signal<Set<string>>(new Set());
  updateAvailable = signal(false);
  appName = signal('');
  logoUrl = signal('');
  toolbarLogoUrl = signal('');
  /** Colore di sfondo della toolbar. Se `null`, viene usato il default del tema Material. */
  toolbarColor = signal<string | null>(null);
  /** Colore del testo/icone della toolbar. Se `null`, viene usato il default del tema Material. */
  toolbarTextColor = signal<string | null>(null);

  // Azioni toolbar per pagine di creazione/modifica
  showToolbarActions = signal<boolean>(false);
  onSaveAction = signal<(() => void) | null>(null);
  onResetAction = signal<(() => void) | null>(null);
  extraActions = signal<{ label: string; icon: string; callback: () => void }[]>([]);

  readonly router = inject(Router);

  constructor() {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        // Scendi fino alla rotta foglia attiva per leggere i suoi `data`
        let route = this.router.routerState.root.snapshot;
        while (route.firstChild) {
          route = route.firstChild;
        }
        const data = route.data;
        const title = data['title'] as string | undefined;
        const icon = data['icon'] as string | undefined;
        if (title) {
          this.setTitle(title, icon);
        }
      });
  }

  /** Imposta la voce "home" del menu (prima voce, default: Dashboard) */
  setHomeItem(item: MenuItem): void {
    this.homeItem = item;
    this.rebuildMenu();
  }

  /** Aggiunge voci di menu del consumer (non rimuove le stock) */
  addMenuItems(items: MenuItem[], position: MenuInsertPosition = 'before-settings'): void {
    this.consumerItems.push({ items, position });
    this.rebuildMenu();
  }

  setTitle(title: string, icon: string = 'edit') {
    const customItem = { title, icon };
    this.activeLink.set(customItem);
  }

  setToolbarActions(onSave: () => void, onReset: () => void, extras?: { label: string; icon: string; callback: () => void }[]) {
    this.showToolbarActions.set(true);
    this.onSaveAction.set(onSave);
    this.onResetAction.set(onReset);
    this.extraActions.set(extras ?? []);
  }

  setExtraActions(extras: { label: string; icon: string; callback: () => void }[]) {
    this.showToolbarActions.set(false);
    this.extraActions.set(extras);
  }

  clearToolbarActions() {
    this.showToolbarActions.set(false);
    this.onSaveAction.set(null);
    this.onResetAction.set(null);
    this.extraActions.set([]);
  }

  toggleSubmenu(item: MenuItem) {
    const expanded = new Set(this.expandedMenus());
    if (expanded.has(item.title)) {
      expanded.delete(item.title);
    } else {
      expanded.add(item.title);
    }
    this.expandedMenus.set(expanded);
  }

  isExpanded(item: MenuItem): boolean {
    return this.expandedMenus().has(item.title);
  }

  private buildMenu(): MenuItem[] {
    const beforeSettings: MenuItem[] = [];
    const afterSettings: MenuItem[] = [];

    for (const entry of this.consumerItems) {
      if (entry.position === 'before-settings') {
        beforeSettings.push(...entry.items);
      } else {
        afterSettings.push(...entry.items);
      }
    }

    // Home → Stock (Notifiche) → Consumer (before-settings) → Stock (Impostazioni) → Consumer (after-settings)
    const settingsItem = this.stockItems.find(i => i.title === 'Impostazioni')!;
    const notificheItem = this.stockItems.find(i => i.title === 'Notifiche')!;

    return [
      this.homeItem,
      notificheItem,
      ...beforeSettings,
      settingsItem,
      ...afterSettings,
    ];
  }

  private rebuildMenu(): void {
    this.menu = this.buildMenu();
    // Aggiorna activeLink al nuovo homeItem se l'active corrente non esiste nel nuovo menu
    this.activeLink.set(this.menu[0]);
  }
}