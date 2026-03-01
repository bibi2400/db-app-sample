import { BackupController } from './backup.controller';
import { TestController } from './test.controller';

export function registerAllControllers(): void {
  const controllers = [
    new TestController(),
    new BackupController(),
  ];

  controllers.forEach(controller => {
    controller.registerHandlers();
  });

  console.log(`[IPC] ${controllers.length} controller(s) registered`);
}
