import fs from "fs";
import path from "path";
import { app } from "electron";
import { Injectable } from "../helpers/mini-pie/decorators";
import { Logger } from "../helpers/logger";

/**
 * Servizio base per la gestione dei file dentro %appdata%/<app>.
 * Fornisce operazioni di lettura, scrittura e gestione di file e sottocartelle
 * nella userData directory di Electron.
 */
@Injectable()
export class AppDataService {

  private readonly basePath = app.getPath('userData');

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
    this.ensureDir(path.dirname(filePath));
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
   */
  ensureDir(...segments: string[]): void {
    const dirPath = this.resolve(...segments);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
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
