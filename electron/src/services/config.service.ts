import fs from "fs";
import path from "path";
import { app } from "electron";
import { Injectable } from "../helpers/mini-pie/decorators";
import { Logger } from "../helpers/logger";

interface ConfigEntry<T> {
  filePath: string;
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

  /**
   * Registra un file di configurazione con i suoi defaults.
   * Da chiamare una sola volta per file, tipicamente nel costruttore del service consumer.
   */
  register<T extends object>(fileName: string, defaults: T): void {
    if (this.entries.has(fileName)) {
      return;
    }
    this.entries.set(fileName, {
      filePath: path.join(app.getPath('userData'), fileName),
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

    if (!fs.existsSync(entry.filePath)) {
      this.write(fileName, entry.defaults as T);
      entry.cache = { ...entry.defaults };
      return entry.cache as T;
    }

    try {
      const content = fs.readFileSync(entry.filePath, 'utf-8');
      const fileConfig = JSON.parse(content) as Partial<T>;
      entry.cache = { ...(entry.defaults as object), ...fileConfig } as T;
      return entry.cache as T;
    } catch (error) {
      Logger.error(`[ConfigService] Errore nella lettura di ${entry.filePath}:`, error);
      entry.cache = { ...entry.defaults };
      return entry.cache as T;
    }
  }

  /**
   * Scrive la configurazione completa su disco.
   */
  write<T extends object>(fileName: string, config: T): void {
    const entry = this.getEntry<T>(fileName);
    const dir = path.dirname(entry.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(entry.filePath, JSON.stringify(config, null, 2));
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
    return this.getEntry(fileName).filePath;
  }

  private getEntry<T>(fileName: string): ConfigEntry<T> {
    const entry = this.entries.get(fileName);
    if (!entry) {
      throw new Error(`[ConfigService] File "${fileName}" non registrato. Chiamare register() prima.`);
    }
    return entry as ConfigEntry<T>;
  }
}
