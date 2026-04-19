import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { FrameworkShell, NavigationService } from '@bibi2400/electron-angular-framework/angular';

@Component({
  selector: 'app-root',
  imports: [FrameworkShell],
  template: '<eaf-shell author="bibi" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  constructor() {
    inject(NavigationService).addMenuItems([
      { title: 'Demo Tabella', icon: 'table_chart', route: '/table-demo' },
      { title: 'Top 5 Stelle', icon: 'star', route: '/table-demo', queryParams: { rating: '{"mode":"equal","equal":5}' } },
    ]);
  }
}

