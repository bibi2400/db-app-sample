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
    path: '**',
    redirectTo: 'dashboard'
  }
];
