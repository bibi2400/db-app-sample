import { Injectable, signal } from '@angular/core';

export type MenuItem = {
  title: string;
  icon: string;
  route?: string;
  children?: MenuItem[];
}

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  menu: MenuItem[] = [
    {
      title: 'Dashboard',
      icon: 'dashboard',
      route: '/dashboard'
    },
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

  activeLink = signal<MenuItem>(this.menu[0]);
  expandedMenus = signal<Set<string>>(new Set());
  updateAvailable = signal(false);

  // Azioni toolbar per pagine di creazione/modifica
  showToolbarActions = signal<boolean>(false);
  onSaveAction = signal<(() => void) | null>(null);
  onResetAction = signal<(() => void) | null>(null);
  extraActions = signal<{ label: string; icon: string; callback: () => void }[]>([]);

  constructor() { }

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

  private findMenuItem(route: string): MenuItem | undefined {
    for (const item of this.menu) {
      if (item.route === route) return item;
      if (item.children) {
        const child = item.children.find(c => c.route === route);
        if (child) return child;
      }
    }
    return undefined;
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
}