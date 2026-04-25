import { Routes } from '@angular/router';
import { FrameworkRoutes } from '@bibi2400/electron-angular-framework/angular';
import { Dashboard } from './pages/dashboard/dashboard';

// Consumer-specific routes
const appRoutes: Routes = [
  {
    path: 'dashboard',
    data: { title: 'Dashboard', icon: 'dashboard' },
    component: Dashboard
  },
  {
    path: 'table-demo',
    data: { title: 'Demo Tabella', icon: 'table_chart' },
    loadComponent: () => import('./pages/table-demo/table-demo').then(m => m.TableDemo)
  },
];

// Merge with framework stock routes (backup, updates, notifications, shortcuts, app-info)
export const routes = FrameworkRoutes.build(appRoutes, 'dashboard');
