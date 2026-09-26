import { Injectable, inject } from '@angular/core';
import { EAF_DATABASE_UI_CONFIG } from '../config';

@Injectable({ providedIn: 'root' })
export class DatabaseUiService {
  private readonly config = inject(EAF_DATABASE_UI_CONFIG);

  readonly enabled = this.config.enabled !== false;
  readonly showTechnicalInfo = this.config.showTechnicalInfo !== false;

  allowsRoute(route?: string): boolean {
    if (this.enabled || !route) return true;
    const path = route.replace(/^\/+/, '').split(/[?#]/)[0];
    return path !== 'backup' && !path.startsWith('backup/');
  }

  allowsShortcut(id: string): boolean {
    return this.enabled || id !== 'nav.backup';
  }
}
