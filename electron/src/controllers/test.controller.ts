import { TestService } from "../services/test.service";
import { BaseController } from "./base.controller";
import { IpcHandler } from "../decorators/ipc-handler.decorator";
import { Controller } from "../decorators/controller.decorator";
import { Chronomancer } from "../helpers/chronomancer.adapter";

@Controller({ prefix: "test" })
export class TestController extends BaseController {
  constructor(private readonly testService: TestService) {
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
}
