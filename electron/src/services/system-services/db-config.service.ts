import { Injectable } from "../../helpers/mini-pie/decorators";
import { ConfigService } from "./config.service";

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

  constructor(private readonly configService: ConfigService) {
    this.configService.register<DbConfig>(DB_CONFIG_FILE, DB_CONFIG_DEFAULTS);
  }

  get dbPath(): string {
    return this.configService.read<DbConfig>(DB_CONFIG_FILE).dbPath;
  }

  set dbPath(value: string) {
    this.configService.update<DbConfig>(DB_CONFIG_FILE, { dbPath: value });
  }

  get configPath(): string {
    return this.configService.getFilePath(DB_CONFIG_FILE);
  }
}