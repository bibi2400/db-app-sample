import { TestService } from "../services/test.service";
import { NotificationService } from "../services/notification.service";
import { BaseController } from "./base.controller";
import { IpcHandler } from "../decorators/ipc-handler.decorator";
import { Controller } from "../decorators/controller.decorator";
import { Chronomancer } from "../helpers/chronomancer.adapter";

@Controller({ prefix: "test" })
export class TestController extends BaseController {
  constructor(
    private readonly testService: TestService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  @IpcHandler("test")
  test() {
    return this.success({ message: "Test successful!" });
  }

  /**
   * Demo endpoint to showcase Chronomancer capabilities
   * Call via IPC: test:chrono-demo
   */
  @IpcHandler("chrono-demo")
  async chronoDemo() {
    // Example 1: Basic start/stop measurement
    Chronomancer.start('demo-operation', 'test-scope');
    await this.simulateWork(50);
    Chronomancer.checkpoint('demo-operation', 'after-first-task', 'test-scope');
    await this.simulateWork(30);
    Chronomancer.checkpoint('demo-operation', 'after-second-task', 'test-scope');
    await this.simulateWork(20);
    const duration1 = Chronomancer.stop('demo-operation', 'test-scope');

    // Example 2: Using measureAsync wrapper
    const result = await Chronomancer.measureAsync('async-task', async () => {
      await this.simulateWork(40);
      return { computed: true };
    }, 'test-scope');

    // Example 3: Multiple iterations to gather statistics
    for (let i = 0; i < 5; i++) {
      Chronomancer.start('iteration', 'test-scope');
      await this.simulateWork(10 + Math.random() * 20);
      Chronomancer.stop('iteration', 'test-scope');
    }

    // Get statistics
    const stats = Chronomancer.getStats('iteration', 'test-scope');
    const report = Chronomancer.generateReport();

    // Print formatted report to console
    Chronomancer.printReport();

    return this.success({
      message: 'Chronomancer demo completed!',
      measurements: {
        demoOperation: `${duration1.toFixed(2)}ms`,
        asyncTaskResult: result,
        iterationStats: stats ? {
          count: stats.count,
          avg: `${stats.avg.toFixed(2)}ms`,
          min: `${stats.min.toFixed(2)}ms`,
          max: `${stats.max.toFixed(2)}ms`,
          p95: `${stats.p95.toFixed(2)}ms`,
        } : null,
      },
      report: report.globalStats,
    });
  }

  private simulateWork(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  @IpcHandler("test-notifications")
  async testNotifications() {
    this.notificationService.info('Test Info', 'Questa è una notifica informativa di test dal backend.');

    await this.simulateWork(1500);
    this.notificationService.warn('Test Warning', 'Attenzione: questa è una notifica di avviso dal backend.');

    await this.simulateWork(1500);
    try {
      throw new Error
    } catch(e) {
      this.notificationService.error('Test Error', 'Errore simulato dal backend per verificare il sistema di notifiche.\n'+(<Error>e).stack);
    }

    await this.simulateWork(1500);
    this.notificationService.debug('Test Debug', 'Messaggio di debug dal backend con dettagli tecnici sulla richiesta.');

    throw new Error("Test error")
  }
}
