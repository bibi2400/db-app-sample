import { Injectable } from "../../helpers/mini-pie/decorators";
import { ConfigService } from "./config.service";
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { AppDataService } from './app-data.service';
import { ConsumerConfigService } from './consumer-config.service';
import { copyDatabaseSnapshot } from '../../helpers/backup-files';

export interface DbConfig {
  dbPath: string;
}

const DB_CONFIG_FILE = 'db-config.json';

const DB_CONFIG_DEFAULTS: DbConfig = {
  dbPath: "./database/database.sqlite",
};

/**
 * Gestisce la configurazione del database (db-config.json).
 *
 * Il file viene scritto dall'installer NSIS con il solo campo `dbPath`.
 * Grazie al merge di ConfigService, eventuali campi futuri aggiunti
 * alla struttura DbConfig verranno automaticamente riempiti dai defaults
 * anche se NSIS non li scrive.
 */
@Injectable()
export class DbConfigService {

  constructor(
    private readonly configService: ConfigService,
    private readonly appDataService: AppDataService,
    private readonly consumerConfig: ConsumerConfigService,
  ) {
    this.configService.register<DbConfig>(DB_CONFIG_FILE, {
      dbPath: consumerConfig.databaseUiEnabled ? DB_CONFIG_DEFAULTS.dbPath : this.internalPath,
    });
  }

  get dbPath(): string {
    if (!this.consumerConfig.databaseUiEnabled) return this.internalPath;
    return this.configService.read<DbConfig>(DB_CONFIG_FILE).dbPath;
  }

  set dbPath(value: string) {
    if (!this.consumerConfig.databaseUiEnabled) {
      throw new Error('Il percorso del database interno è gestito dall’applicazione.');
    }
    this.configService.update<DbConfig>(DB_CONFIG_FILE, { dbPath: value });
  }

  get configPath(): string {
    return this.configService.getFilePath(DB_CONFIG_FILE);
  }

  /** Called before opening TypeORM; preserves an existing external DB on opt-in. */
  async resolveDbPath(): Promise<string> {
    if (this.consumerConfig.databaseUiEnabled) return this.dbPath;
    const destination = this.internalPath;
    const source = path.resolve(this.configService.read<DbConfig>(DB_CONFIG_FILE).dbPath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    if (source !== destination) {
      let exists = false;
      try {
        await fs.access(destination);
        exists = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      if (!exists) {
        const staging = `${destination}.migrate-${randomUUID()}`;
        try {
          await copyDatabaseSnapshot(source, staging);
          await fs.rename(staging, destination);
        } finally {
          await fs.rm(staging, { force: true });
        }
      }
      this.configService.update<DbConfig>(DB_CONFIG_FILE, { dbPath: destination });
    }
    return destination;
  }

  private get internalPath(): string {
    return path.resolve(this.appDataService.resolve('database', 'database.sqlite'));
  }
}
