import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { Chronomancer } from '@shared/chronomancer';
import { ChronoService } from 'src/app/services/system-services/chrono.service';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit {
  private readonly chrono = inject(ChronoService);
  
  protected readonly chronoDemo = signal<{
    basicMeasurement?: string;
    asyncMeasurement?: string;
    stats?: { avg: string; count: number };
  } | null>(null);

  ngOnInit(): void {
    // Run Chronomancer demo on component init
    this.runChronoDemo();
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
