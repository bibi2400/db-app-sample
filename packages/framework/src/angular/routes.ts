import { Routes, Route } from '@angular/router';

/**
 * Gestisce le route stock del framework e il merge con quelle del consumer.
 *
 * Le route stock (backup, updates, notifications, shortcuts, app-info) sono sempre presenti.
 * Il consumer aggiunge le proprie route e specifica la home page.
 */
export class FrameworkRoutes {
  /** Route stock — lazy-loaded dalle pagine built-in del framework */
  static readonly stock: Routes = [
    {
      path: 'backup',
      data: { title: 'Backup Database', icon: 'backup' },
      loadComponent: () => import('./pages/backup-management/backup-management').then(m => m.BackupManagement)
    },
    {
      path: 'updates',
      data: { title: 'Aggiornamenti', icon: 'system_update' },
      loadComponent: () => import('./pages/update-management/update-management').then(m => m.UpdateManagement)
    },
    {
      path: 'notifications',
      data: { title: 'Notifiche', icon: 'notifications' },
      loadComponent: () => import('./pages/notifications/notifications').then(m => m.Notifications)
    },
    {
      path: 'shortcuts',
      data: { title: 'Scorciatoie', icon: 'keyboard' },
      loadComponent: () => import('./pages/shortcut-management/shortcut-management').then(m => m.ShortcutManagement)
    },
    {
      path: 'app-info',
      data: { title: 'Informazioni App', icon: 'info' },
      loadComponent: () => import('./pages/app-info/app-info').then(m => m.AppInfo)
    }
  ];

  /**
   * Costruisce le route finali combinando stock + consumer.
   *
   * @param consumerRoutes Route definite dal consumer
   * @param homePath Path della home page (default: 'dashboard'). Deve corrispondere a una route del consumer.
   */
  static build(consumerRoutes: Routes, homePath: string = 'dashboard'): Routes {
    return [
      {
        path: '',
        redirectTo: homePath,
        pathMatch: 'full'
      },
      ...consumerRoutes,
      ...FrameworkRoutes.stock,
      {
        path: '**',
        redirectTo: homePath
      }
    ];
  }
}
