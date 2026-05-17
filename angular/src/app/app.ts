import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { FrameworkShell, NavigationService } from '@bibi2400/electron-angular-framework/angular';

@Component({
  selector: 'app-root',
  imports: [FrameworkShell],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  constructor() {
    const nav = inject(NavigationService);
    nav.logoUrl.set('assets/menu-logo.jpg');
    nav.toolbarLogoUrl.set('assets/menu-logo.jpg');
    nav.toolbarColor.set('#112B45');
    nav.toolbarTextColor.set('#ffffff');
    nav.addMenuItems([
      { title: 'Demo Tabella', icon: 'table_chart', route: '/table-demo' },
      { title: 'Demo Form Upload', icon: 'upload_file', route: '/form-upload-demo' },
      { title: 'Prodotti', icon: 'inventory_2', route: '/products' },
      { title: 'Top 5 Stelle', icon: 'star', route: '/table-demo', queryParams: { rating: '{"mode":"equal","equal":5}' } },
      {
        title: 'Test Sottomenu',
        icon: 'science',
        children: [
          { title: 'Voce 1', icon: 'looks_one', route: '/table-demo' },
          { title: 'Voce 2', icon: 'looks_two', route: '/table-demo' },
          { title: 'Voce 3', icon: 'looks_3', route: '/table-demo' },
          { title: 'Voce 4', icon: 'looks_4', route: '/table-demo' },
          { title: 'Voce 5', icon: 'looks_5', route: '/table-demo' },
          { title: 'Voce 6', icon: 'looks_6', route: '/table-demo' },
          { title: 'Voce 7', icon: 'star', route: '/table-demo' },
          { title: 'Voce 8', icon: 'star', route: '/table-demo' },
          { title: 'Voce 9', icon: 'star', route: '/table-demo' },
          { title: 'Voce 10', icon: 'star', route: '/table-demo' },
          { title: 'Voce 11', icon: 'star', route: '/table-demo' },
          { title: 'Voce 12', icon: 'star', route: '/table-demo' },
          { title: 'Voce 13', icon: 'star', route: '/table-demo' },
          { title: 'Voce 14', icon: 'star', route: '/table-demo' },
          { title: 'Voce 15', icon: 'star', route: '/table-demo' },
          { title: 'Voce 16', icon: 'star', route: '/table-demo' },
          { title: 'Voce 17', icon: 'star', route: '/table-demo' },
          { title: 'Voce 18', icon: 'star', route: '/table-demo' },
          { title: 'Voce 19', icon: 'star', route: '/table-demo' },
          { title: 'Voce 20', icon: 'star', route: '/table-demo' },
        ],
      },
    ]);
  }
}

