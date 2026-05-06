import { AppBootstrap } from '@bibi2400/electron-angular-framework/electron';
import { MODELS } from './src/db/entities';
import { DB_MIGRATIONS } from './src/db/migrations';
import './src/controllers'; // side-effect imports to register @Controller decorators
import { APP_SERVICES } from './src/services';
import { RUNTIME_CONFIG } from './src/config/runtime-config';

const bootstrap = new AppBootstrap({
  entities: MODELS,
  services: APP_SERVICES,
  runtimeConfig: RUNTIME_CONFIG,
  dbMigrations: DB_MIGRATIONS,
});

bootstrap.start();
