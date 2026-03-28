import { AppBootstrap } from '@bibi2400/electron-angular-framework/electron';
import { MODELS } from './src/db/entities';
import './src/controllers'; // side-effect imports to register @Controller decorators
import { APP_SERVICES } from './src/services';

const bootstrap = new AppBootstrap({
  entities: MODELS,
  services: APP_SERVICES,
});

bootstrap.start();
