import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { ChronoService, Chronomancer, DialogService, EafFileUpload } from '@bibi2400/electron-angular-framework/angular';
import { AttachmentInfo } from 'packages/framework/dist/shared';

@Component({
  selector: 'app-dashboard',
  imports: [EafFileUpload, MatButtonModule, MatChipsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit {
  private readonly chrono = inject(ChronoService);
  private readonly dialogService = inject(DialogService);

  protected readonly lastConfirm = signal<string | null>(null);
  protected readonly lastPrompt = signal<string | null>(null);

  async openConfirmDialog() {
    const confirmed = await this.dialogService.confirm(
      'Eliminare l\'elemento?',
      'Questa azione non può essere annullata.\nVuoi davvero procedere?',
    );
    this.lastConfirm.set(confirmed ? 'Confermato ✅' : 'Annullato ❌');
  }

  /** Caso 1: solo title, required=true (default) */
  async promptSimple() {
    const value = await this.dialogService.prompt({
      title: 'Nome sessione',
    });
    this.lastPrompt.set(value != null ? `"${value}"` : 'Annullato ❌');
  }

  /** Caso 2: con message multilinea */
  async promptWithMessage() {
    const value = await this.dialogService.prompt({
      title: 'Rinomina elemento',
      message: ['Stai rinominando l\'elemento selezionato.', 'Il nuovo nome sarà visibile immediatamente.'],
      label: 'Nuovo nome',
    });
    this.lastPrompt.set(value != null ? `"${value}"` : 'Annullato ❌');
  }

  /** Caso 3: defaultValue + placeholder */
  async promptWithDefault() {
    const value = await this.dialogService.prompt({
      title: 'Duplica sessione',
      label: 'Nome copia',
      defaultValue: 'Sessione 1 (copia)',
      placeholder: 'es. Sessione 2026-07...',
    });
    this.lastPrompt.set(value != null ? `"${value}"` : 'Annullato ❌');
  }

  /** Caso 4: etichette bottoni custom */
  async promptCustomLabels() {
    const value = await this.dialogService.prompt({
      title: 'Inserisci codice',
      label: 'Codice prodotto',
      confirmLabel: 'Cerca',
      cancelLabel: 'Chiudi',
      placeholder: 'es. ABC-123',
    });
    this.lastPrompt.set(value != null ? `"${value}"` : 'Chiuso ❌');
  }

  /** Caso 5: required=false (Conferma abilitata anche con campo vuoto) */
  async promptOptional() {
    const value = await this.dialogService.prompt({
      title: 'Note aggiuntive',
      message: 'Campo opzionale — puoi confermare anche senza inserire nulla.',
      label: 'Note',
      placeholder: 'Scrivi qualcosa...',
      required: false,
    });
    this.lastPrompt.set(value != null ? (value ? `"${value}"` : '(vuoto confermato) ✅') : 'Annullato ❌');
  }
  
  protected readonly chronoDemo = signal<{
    basicMeasurement?: string;
    asyncMeasurement?: string;
    stats?: { avg: string; count: number };
  } | null>(null);

  ngOnInit(): void {
    // Run Chronomancer demo on component init
    this.runChronoDemo();
  }

  logUpload(event: AttachmentInfo[]): void {
    console.log('Files uploaded:', event);
  }

  uploadError(error: any): void {
    console.error('Upload error:', error);
  }

  /**
   * Demo method showcasing Chronomancer usage in Angular
   */
  private async runChronoDemo(): Promise<void> {
    // Example 1: Basic measurement with the service
    this.chrono.start('dashboard-init', 'angular');
    await this.simulateAsyncWork(100);
    this.chrono.checkpoint('dashboard-init', 'after-data-load', 'angular');
    await this.simulateAsyncWork(50);
    const basicDuration = this.chrono.stop('dashboard-init', 'angular');

    // Example 2: Using measureAsync
    const asyncDuration = await this.chrono.measureAsync('async-operation', async () => {
      await this.simulateAsyncWork(75);
      return 75;
    }, 'angular');

    // Example 3: Using static Chronomancer directly (useful in non-injectable contexts)
    for (let i = 0; i < 3; i++) {
      Chronomancer.measure('sync-task', () => {
        // Simulate some sync work
        let sum = 0;
        for (let j = 0; j < 100000; j++) sum += j;
        return sum;
      }, 'angular');
    }

    const stats = this.chrono.getStats('sync-task', 'angular');

    this.chronoDemo.set({
      basicMeasurement: `${basicDuration.toFixed(2)}ms`,
      asyncMeasurement: `${asyncDuration}ms`,
      stats: stats ? {
        avg: `${stats.avg.toFixed(4)}ms`,
        count: stats.count,
      } : undefined,
    });

    // Print report to console (visible in DevTools)
    this.chrono.printReport();
    
    console.info('Chronomancer Demo Results:', this.chronoDemo());
  }

  private simulateAsyncWork(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
