import { Component, ChangeDetectionStrategy, input, output, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { Router } from '@angular/router';
import { MenuItem, NavigationService } from '../../services/navigation.service';

@Component({
  selector: 'app-sidebar',
  imports: [
    MatButtonModule,
    MatIcon,
    MatListModule,
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Sidebar {
  version = input('');
  author = input('');
  closed = output<void>();

  readonly navigationService = inject(NavigationService);
  private router = inject(Router);

  get menu() {
    return this.navigationService.menu;
  }

  get activeLink() {
    return this.navigationService.activeLink;
  }

  toggleSubmenu(item: MenuItem) {
    this.navigationService.toggleSubmenu(item);
  }

  isExpanded(item: MenuItem): boolean {
    return this.navigationService.isExpanded(item);
  }

  clickMenuItem($event: Event, menuItem: MenuItem) {
    $event.preventDefault();
    if (menuItem.route) {
      this.closed.emit();
      this.router.navigate([menuItem.route]);
    }
  }
}
