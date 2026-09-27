import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { UpdateStatus } from '../types/update';
import { ElectronUpdateService } from './electron-api/electron-update.service';
import { NavigationService } from './navigation.service';

/** Stato condiviso dagli indicatori aggiornamenti della shell e della toolbar. */
@Injectable({
  providedIn: 'root'
})
export class UpdateStateService {
  private readonly updateService = inject(ElectronUpdateService);
  private readonly navigationService = inject(NavigationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly currentStatus = signal<UpdateStatus | null>(null);
  private readonly changes = new Subject<UpdateStatus>();
  private receivedStatus = false;

  readonly status = this.currentStatus.asReadonly();
  readonly statusChanged$ = this.changes.asObservable();

  constructor() {
    this.destroyRef.onDestroy(() => this.changes.complete());
    this.updateService.statusChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: status => {
          this.receivedStatus = true;
          this.applyStatus(status);
        },
        error: error => console.warn('Stato aggiornamenti non disponibile:', error),
      });
    void this.loadInitialStatus();
  }

  private async loadInitialStatus(): Promise<void> {
    try {
      const result = await this.updateService.getStatus();
      // Un push piu recente ha precedenza sulla risposta IPC iniziale.
      if (this.destroyRef.destroyed || this.receivedStatus) return;
      if (result.success && result.data) {
        this.applyStatus(result.data);
      } else {
        console.warn('Stato iniziale aggiornamenti non disponibile:', result.error);
      }
    } catch (error) {
      if (!this.destroyRef.destroyed && !this.receivedStatus) {
        console.warn('Stato iniziale aggiornamenti non disponibile:', error);
      }
    }
  }

  private applyStatus(status: UpdateStatus): void {
    this.currentStatus.set(status);
    this.navigationService.updateAvailable.set(
      status.status === 'available' || status.status === 'downloaded',
    );
    this.changes.next(status);
  }
}
