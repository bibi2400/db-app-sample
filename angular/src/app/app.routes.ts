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
  {
    path: 'form-upload-demo',
    data: { title: 'Demo Form Upload', icon: 'upload_file' },
    loadComponent: () => import('./pages/form-upload-demo/form-upload-demo').then(m => m.FormUploadDemo)
  },
  {
    path: 'products',
    data: { title: 'Prodotti', icon: 'inventory_2' },
    loadComponent: () => import('./pages/products/products').then(m => m.Products)
  },
  {
    // Detail page — no sidebar entry (no icon)
    path: 'product-detail/:id',
    loadComponent: () => import('./pages/product-detail/product-detail').then(m => m.ProductDetail)
  },
  {
    path: 'notes-global',
    data: { title: 'Note', icon: 'notes' },
    loadComponent: () => import('./pages/notes-global/notes-global').then(m => m.NotesGlobal)
  },
];

// Merge with framework stock routes (backup, updates, notifications, shortcuts, app-info)
export const routes = FrameworkRoutes.build(appRoutes, 'dashboard');
