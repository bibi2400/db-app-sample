import { FrameworkConfig } from '@bibi2400/electron-angular-framework/angular';
import { routes } from './app.routes';

const frameworkConfig = new FrameworkConfig({ routes });

export const appConfig = frameworkConfig.toApplicationConfig();
