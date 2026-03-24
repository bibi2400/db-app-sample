import { Routes } from '@angular/router';
import { Dashboard } from './pages/dashboard/dashboard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    component: Dashboard
  },
  {
    path: 'backup',
    loadComponent: () => import('./pages/backup-management/backup-management').then(m => m.BackupManagement)
  },
  {
    path: 'updates',
    loadComponent: () => import('./pages/update-management/update-management').then(m => m.UpdateManagement)
  },
  {
    path: 'notifications',
    loadComponent: () => import('./pages/notifications/notifications').then(m => m.Notifications)
  },
  {
    path: 'shortcuts',
    loadComponent: () => import('./pages/shortcut-management/shortcut-management').then(m => m.ShortcutManagement)
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
