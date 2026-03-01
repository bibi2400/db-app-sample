import { TitleCasePipe } from '@angular/common';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbar } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet, Router } from '@angular/router';
import { Location } from '@angular/common';
import { MenuItem, NavigationService } from './services/navigation.service';
import "./types/global";

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet, 
    MatSidenavModule, 
    MatButtonModule, 
    MatIcon, 
    MatListModule, 
    MatToolbar,
    MatTooltipModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  opened = false;
  version = '1.0.0';
  author = 'bibi';

  constructor(
    public navigationService: NavigationService,
    private location: Location,
    private router: Router
  ) { }

  goBack() {
    this.location.back();
  }

  goForward() {
    this.location.forward();
  }

  clickMenuItem($event: Event, menuItem: MenuItem) {
    $event.preventDefault();
    if (menuItem.route) {
      this.opened = false;
      this.router.navigate([menuItem.route]);
    }
  }

  get menu() {
    return this.navigationService.menu;
  }

  toggleSubmenu(item: MenuItem) {
    this.navigationService.toggleSubmenu(item);
  }

  isExpanded(item: MenuItem): boolean {
    return this.navigationService.isExpanded(item);
  }

  get activeLink() {
    return this.navigationService.activeLink;
  }
}
