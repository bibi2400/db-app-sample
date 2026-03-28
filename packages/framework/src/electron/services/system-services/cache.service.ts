import { Injectable } from "../../helpers/mini-pie/decorators";
import { Logger } from "../../helpers/logger";
import { AppDataService } from "./app-data.service";

const CACHE_DIR = 'cache';

/**
 * Servizio per la gestione di file di cache dentro %appdata%/<app>/cache/.
 * Permette di memorizzare e leggere dati di cache con supporto per TTL opzionale.
 */
@Injectable()
export class CacheService {

  constructor(private readonly appData: AppDataService) {
    this.appData.ensureDir(CACHE_DIR);
  }

  /**
   * Verifica se una entry di cache esiste (e non è scaduta).
   */
  has(key: string): boolean {
    const wrapper = this.appData.readJson<CacheWrapper>(CACHE_DIR, `${key}.json`);
    if (!wrapper) return false;
    if (wrapper.expiresAt && Date.now() > wrapper.expiresAt) {
      this.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Legge un valore dalla cache. Restituisce null se non esiste o è scaduto.
   */
  get<T>(key: string): T | null {
    const wrapper = this.appData.readJson<CacheWrapper<T>>(CACHE_DIR, `${key}.json`);
    if (!wrapper) return null;
    if (wrapper.expiresAt && Date.now() > wrapper.expiresAt) {
      this.delete(key);
      return null;
    }
    return wrapper.data;
  }

  /**
   * Scrive un valore nella cache con TTL opzionale in millisecondi.
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
    const wrapper: CacheWrapper<T> = {
      data,
      createdAt: Date.now(),
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    };
    this.appData.writeJson(wrapper, CACHE_DIR, `${key}.json`);
  }

  /**
   * Elimina una entry dalla cache.
   */
  delete(key: string): boolean {
    return this.appData.deleteFile(CACHE_DIR, `${key}.json`);
  }

  /**
   * Svuota tutta la cache.
   */
  clear(): void {
    const files = this.appData.listFiles(CACHE_DIR);
    for (const file of files) {
      this.appData.deleteFile(CACHE_DIR, file);
    }
    Logger.debug('[CacheService] Cache svuotata');
  }

  /**
   * Elenca tutte le chiavi presenti nella cache.
   */
  keys(): string[] {
    return this.appData.listFiles(CACHE_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace(/\.json$/, ''));
  }

  /**
   * Restituisce il percorso della directory di cache.
   */
  get cachePath(): string {
    return this.appData.resolve(CACHE_DIR);
  }
}

interface CacheWrapper<T = unknown> {
  data: T;
  createdAt: number;
  expiresAt: number | null;
}
