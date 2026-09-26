import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { Injectable } from '../../helpers/mini-pie/decorators';
import { parseConsumerConfig } from '../../../shared/consumer-config';

@Injectable()
export class ConsumerConfigService {
  readonly databaseUiEnabled: boolean;

  constructor() {
    const file = path.join(app.getAppPath(), 'eaf.config.json');
    const config = parseConsumerConfig(fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, 'utf8'))
      : {});
    this.databaseUiEnabled = config.databaseUi?.enabled !== false;
  }
}
