import { Routes, Route } from '@angular/router';
import { Type } from '@angular/core';

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
   * @param notFoundRoute Componente o `Route` completa da usare come catch-all `**`.
   *   - Se è un `Type<unknown>` (classe Angular), viene usato come `component` per `path: '**'`.
   *   - Se è una `Route` completa, viene usata direttamente (supporta `loadComponent`, `data`, ecc.).
   *   - Se omesso (default), il catch-all esegue `redirectTo: homePath`.
   */
  static build(consumerRoutes: Routes, homePath: string = 'dashboard', notFoundRoute?: Type<unknown> | Route): Routes {
    const catchAll: Route = notFoundRoute
      ? (typeof notFoundRoute === 'function' ? { path: '**', component: notFoundRoute } : notFoundRoute)
      : { path: '**', redirectTo: homePath };

    return [
      {
        path: '',
        redirectTo: homePath,
        pathMatch: 'full'
      },
      ...consumerRoutes,
      ...FrameworkRoutes.stock,
      catchAll
    ];
  }
}
