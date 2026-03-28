import { Routes } from '@angular/router';
import { FrameworkRoutes } from '@bibi2400/electron-angular-framework/angular';
import { Dashboard } from './pages/dashboard/dashboard';

// Consumer-specific routes
const appRoutes: Routes = [
  {
    path: 'dashboard',
    component: Dashboard
  },
];

// Merge with framework stock routes (backup, updates, notifications, shortcuts, app-info)
export const routes = FrameworkRoutes.build(appRoutes, 'dashboard');
