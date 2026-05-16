// Import controllers to trigger @Controller decorator registration
import './app.controller';
import './backup.controller';
import './db-migration.controller';
import './notification.controller';
import './note.controller';
import './test.controller';
import './update.controller';
import './upload.controller';

import { Injector } from '../helpers/mini-pie/injector';
import { ControllerService } from '../services/system-services/controller.service';

export { AppController } from './app.controller';

export function registerAllControllers(): void {
  const controllerService = Injector.inject(ControllerService);
  controllerService.registerAllControllers();
}
