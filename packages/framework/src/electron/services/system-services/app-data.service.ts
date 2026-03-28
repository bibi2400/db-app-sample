import fs from "fs";
import path from "path";
import { app } from "electron";
import { Injectable } from "../../helpers/mini-pie/decorators";
import { Logger } from "../../helpers/logger";
import { DevModeService } from "./dev-mode.service";

/**
 * Servizio base per la gestione dei file dentro %appdata%/<app>.
 * In dev mode i file vengono salvati in <progetto>/appdata/<appname>/
 * per separare i dati di sviluppo da quelli di produzione.
 */
@Injectable()
export class AppDataService {

  private readonly basePath: string;

  constructor(private readonly devModeService: DevModeService) {
    if (this.devModeService.isDev) {
      this.basePath = path.join(app.getAppPath(), '.appdata');
    } else {
      this.basePath = app.getPath('userData');
    }

    Logger.debug(`[AppData] Base path: ${this.basePath}`);
  }

  /**
   * Restituisce il percorso assoluto della userData directory.
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Risolve un percorso relativo alla userData directory.
   */
  resolve(...segments: string[]): string {
    return path.join(this.basePath, ...segments);
  }

  /**
   * Verifica se un file o cartella esiste nella userData directory.
   */
  exists(...segments: string[]): boolean {
    return fs.existsSync(this.resolve(...segments));
  }

  /**
   * Legge un file come stringa UTF-8.
   */
  readFile(...segments: string[]): string | null {
    const filePath = this.resolve(...segments);
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Legge un file e lo parsa come JSON.
   */
  readJson<T>(...segments: string[]): T | null {
    const content = this.readFile(...segments);
    if (content === null) return null;
    try {
      return JSON.parse(content) as T;
    } catch (error) {
      Logger.error(`[AppData] Errore nel parsing JSON di ${this.resolve(...segments)}:`, error);
      return null;
    }
  }

  /**
   * Scrive una stringa in un file, creando le directory intermedie se necessario.
   */
  writeFile(content: string, ...segments: string[]): void {
    const filePath = this.resolve(...segments);
    this.ensureDirForPath(filePath);
    fs.writeFileSync(filePath, content);
  }

  /**
   * Scrive un oggetto come JSON formattato in un file.
   */
  writeJson<T>(data: T, ...segments: string[]): void {
    this.writeFile(JSON.stringify(data, null, 2), ...segments);
  }

  /**
   * Elimina un file se esiste.
   */
  deleteFile(...segments: string[]): boolean {
    const filePath = this.resolve(...segments);
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Crea una directory (e tutte le intermedie) se non esiste.
   * Accetta segmenti relativi al basePath.
   */
  ensureDir(...segments: string[]): void {
    const dirPath = this.resolve(...segments);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Crea le directory intermedie per un path assoluto di file già risolto.
   */
  private ensureDirForPath(absoluteFilePath: string): void {
    const dir = path.dirname(absoluteFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Elenca i file in una sottocartella della userData directory.
   */
  listFiles(...segments: string[]): string[] {
    const dirPath = this.resolve(...segments);
    try {
      return fs.readdirSync(dirPath);
    } catch {
      return [];
    }
  }
}
