import { Injectable } from "../../helpers/mini-pie/decorators";
import { Logger } from "../../helpers/logger";
import { AppDataService } from "./app-data.service";

interface ConfigEntry<T> {
  fileName: string;
  defaults: T;
  cache: T | null;
}

/**
 * Servizio per la gestione di file di configurazione JSON in %appdata%.
 *
 * Strategia di lettura: shallow merge con i defaults.
 * Il file su disco può contenere un sottoinsieme dei campi (es. scritto da NSIS),
 * i campi mancanti vengono riempiti dai defaults.
 */
@Injectable()
export class ConfigService {

  private readonly entries = new Map<string, ConfigEntry<unknown>>();

  constructor(private readonly appData: AppDataService) {}

  /**
   * Registra un file di configurazione con i suoi defaults.
   * Da chiamare una sola volta per file, tipicamente nel costruttore del service consumer.
   */
  register<T extends object>(fileName: string, defaults: T): void {
    if (this.entries.has(fileName)) {
      return;
    }
    this.entries.set(fileName, {
      fileName,
      defaults,
      cache: null,
    });
  }

  /**
   * Legge la configurazione dal file, facendo merge con i defaults.
   * Se il file non esiste, viene creato con i defaults.
   */
  read<T extends object>(fileName: string): T {
    const entry = this.getEntry<T>(fileName);

    if (entry.cache) {
      return entry.cache as T;
    }

    if (!this.appData.exists(fileName)) {
      this.write(fileName, entry.defaults as T);
      entry.cache = { ...entry.defaults };
      return entry.cache as T;
    }

    const fileConfig = this.appData.readJson<Partial<T>>(fileName);
    if (fileConfig) {
      entry.cache = { ...(entry.defaults as object), ...fileConfig } as T;
    } else {
      Logger.error(`[ConfigService] Errore nella lettura di ${fileName}, uso defaults`);
      entry.cache = { ...entry.defaults };
    }
    return entry.cache as T;
  }

  /**
   * Scrive la configurazione completa su disco.
   */
  write<T extends object>(fileName: string, config: T): void {
    const entry = this.getEntry<T>(fileName);
    this.appData.writeJson(config, fileName);
    entry.cache = { ...config };
  }

  /**
   * Aggiorna parzialmente la configurazione (merge con quella corrente).
   */
  update<T extends object>(fileName: string, partial: Partial<T>): void {
    const current = this.read<T>(fileName);
    this.write(fileName, { ...current, ...partial });
  }

  /**
   * Invalida la cache forzando la rilettura dal file al prossimo read().
   */
  invalidateCache(fileName: string): void {
    const entry = this.entries.get(fileName);
    if (entry) {
      entry.cache = null;
    }
  }

  /**
   * Restituisce il percorso assoluto del file di configurazione.
   */
  getFilePath(fileName: string): string {
    return this.appData.resolve(fileName);
  }

  private getEntry<T>(fileName: string): ConfigEntry<T> {
    const entry = this.entries.get(fileName);
    if (!entry) {
      throw new Error(`[ConfigService] File "${fileName}" non registrato. Chiamare register() prima.`);
    }
    return entry as ConfigEntry<T>;
  }
}
