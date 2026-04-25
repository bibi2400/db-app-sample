import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../components/dialogs/confirm-dialog/confirm-dialog';
import { NavigationService } from '../../services/navigation.service';
import { AppDetails, ElectronAppService } from '../../services/electron-api/electron-app.service';

@Component({
  selector: 'app-info',
  imports: [
    MatCardModule,
    MatIcon,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: './app-info.html',
  styleUrl: './app-info.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppInfo implements OnInit {
  private navigationService = inject(NavigationService);
  private appService = inject(ElectronAppService);
  private dialog = inject(MatDialog);

  details = signal<AppDetails | null>(null);
  dbPathError = signal<string | null>(null);

  ngOnInit(): void {
    this.navigationService.clearToolbarActions();
    this.loadDetails();
  }

  private async loadDetails(): Promise<void> {
    const data = await this.appService.getDetails();
    if (data) {
      this.details.set(data);
    }
  }

  openAppData(): void {
    this.appService.openAppData();
  }

  openDbFolder(): void {
    this.appService.openDbFolder();
  }

  openInstallFolder(): void {
    this.appService.openInstallFolder();
  }

  async changeDbPath(): Promise<void> {
    this.dbPathError.set(null);
    try {
      const result = await this.appService.changeDbPath();
      if (!result) return; // dialog cancelled

      this.details.update(d => d ? { ...d, dbPath: result.dbPath } : d);

      if (result.restartRequired) {
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
          data: {
            title: 'Riavvio necessario',
            message: 'Il percorso del database è stato aggiornato.\nÈ necessario riavviare l\'applicazione per applicare la modifica.\n\nRiavviare ora?',
          },
        });
        dialogRef.afterClosed().subscribe(confirmed => {
          if (confirmed) {
            this.appService.reload();
          }
        });
      }
    } catch (err) {
      this.dbPathError.set(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  }
}
