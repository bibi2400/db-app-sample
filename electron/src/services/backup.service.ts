import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { DbConfigService } from "./db-config.service";
import { Injectable } from "../helpers/mini-pie/decorators";

export interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  date: Date;
  type: "auto" | "manual";
}

export interface BackupOptions {
  type?: "auto" | "manual";
  name?: string;
  maxBackups?: number;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  backupCreated?: string;
}

@Injectable()
export class BackupService {
  private backupDir: string;
  private autoBackupDir: string;
  private manualBackupDir: string;
  private lastBackupDate: string | null = null;

  private dbPath: string;

  constructor() {
    const dbConfigService = new DbConfigService();
    this.dbPath = dbConfigService.readDbConfigFile();

    // Determina la cartella backups in base all'ambiente
    let baseDir: string;

    if (app.isPackaged) {
      // Controlla se esiste un file 'portable' nella cartella dell'eseguibile
      const exeDir = path.dirname(app.getPath("exe"));
      const portableMarkerPath = path.join(exeDir, "portable");

      if (fs.existsSync(portableMarkerPath)) {
        // Modalità portable: usa la cartella dell'eseguibile
        baseDir = exeDir;
      } else {
        // Modalità installata: usa userData
        baseDir = app.getPath("userData");
      }
    } else {
      // Development
      baseDir = app.getAppPath();
    }

    this.backupDir = path.join(baseDir, "backups");
    this.autoBackupDir = path.join(this.backupDir, "auto");
    this.manualBackupDir = path.join(this.backupDir, "manual");

    this.ensureBackupDirectories();
  }

  /**
   * Crea le cartelle di backup se non esistono
   */
  private ensureBackupDirectories(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    if (!fs.existsSync(this.autoBackupDir)) {
      fs.mkdirSync(this.autoBackupDir, { recursive: true });
    }
    if (!fs.existsSync(this.manualBackupDir)) {
      fs.mkdirSync(this.manualBackupDir, { recursive: true });
    }
  }

  /**
   * Crea un backup del database
   */
  async createBackup(options: BackupOptions = {}): Promise<BackupInfo> {
    const { type = "manual", name, maxBackups = 10 } = options;

    // Verifica che il database esista
    if (!fs.existsSync(this.dbPath)) {
      throw new Error("Database file not found");
    }

    // Genera il nome del file di backup
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = name
      ? `database_${name}_${timestamp}.sqlite`
      : `database_${timestamp}.sqlite`;

    const targetDir = type === "auto" ? this.autoBackupDir : this.manualBackupDir;
    const backupPath = path.join(targetDir, filename);

    // Copia il file del database
    await fs.promises.copyFile(this.dbPath, backupPath);

    // Verifica l'integrità del backup
    const isValid = await this.verifyBackup(backupPath);
    if (!isValid) {
      fs.unlinkSync(backupPath);
      throw new Error("Backup verification failed");
    }

    // Pulizia vecchi backup
    if (type === "auto") {
      await this.rotateBackups(this.autoBackupDir, maxBackups);
    }

    const stats = fs.statSync(backupPath);

    return {
      filename,
      path: backupPath,
      size: stats.size,
      date: stats.mtime,
      type,
    };
  }

  /**
   * Backup automatico giornaliero
   */
  async autoBackup(): Promise<BackupInfo | null> {
    const today = new Date().toISOString().split("T")[0];

    // Evita backup multipli nello stesso giorno
    if (this.lastBackupDate === today) {
      console.log("Backup already performed today");
      return null;
    }

    const backup = await this.createBackup({
      type: "auto",
      maxBackups: 10,
    });

    this.lastBackupDate = today;
    return backup;
  }

  /**
   * Ripristina il database da un backup
   */
  async restoreBackup(backupPath: string): Promise<RestoreResult> {
    try {
      // Verifica che il file di backup esista
      if (!fs.existsSync(backupPath)) {
        return {
          success: false,
          message: "Backup file not found",
        };
      }

      // Verifica l'integrità del backup
      const isValid = await this.verifyBackup(backupPath);
      if (!isValid) {
        return {
          success: false,
          message: "Backup file is corrupted",
        };
      }

      // Crea un backup di sicurezza del database corrente
      let currentBackup: string | undefined;
      if (fs.existsSync(this.dbPath)) {
        const safetyBackup = await this.createBackup({
          type: "manual",
          name: "pre-restore",
        });
        currentBackup = safetyBackup.path;
      }

      // Ripristina il backup
      await fs.promises.copyFile(backupPath, this.dbPath);

      return {
        success: true,
        message: "Database restored successfully",
        backupCreated: currentBackup,
      };
    } catch (error) {
      return {
        success: false,
        message: `Restore failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Ottiene la lista di tutti i backup disponibili
   */
  async listBackups(): Promise<BackupInfo[]> {
    const backups: BackupInfo[] = [];

    // Leggi backup automatici
    const autoFiles = fs.readdirSync(this.autoBackupDir);
    for (const file of autoFiles) {
      if (file.endsWith(".sqlite")) {
        const filePath = path.join(this.autoBackupDir, file);
        const stats = fs.statSync(filePath);
        backups.push({
          filename: file,
          path: filePath,
          size: stats.size,
          date: stats.mtime,
          type: "auto",
        });
      }
    }

    // Leggi backup manuali
    const manualFiles = fs.readdirSync(this.manualBackupDir);
    for (const file of manualFiles) {
      if (file.endsWith(".sqlite")) {
        const filePath = path.join(this.manualBackupDir, file);
        const stats = fs.statSync(filePath);
        backups.push({
          filename: file,
          path: filePath,
          size: stats.size,
          date: stats.mtime,
          type: "manual",
        });
      }
    }

    // Ordina per data (più recente prima)
    return backups.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  /**
   * Elimina un backup specifico
   */
  async deleteBackup(backupPath: string): Promise<boolean> {
    try {
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error deleting backup:", error);
      return false;
    }
  }

  /**
   * Rotazione dei backup: mantiene solo gli ultimi N backup
   */
  private async rotateBackups(directory: string, maxBackups: number): Promise<void> {
    const files = fs
      .readdirSync(directory)
      .filter((f) => f.endsWith(".sqlite"))
      .map((f) => ({
        name: f,
        path: path.join(directory, f),
        time: fs.statSync(path.join(directory, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    // Elimina i backup più vecchi
    const toDelete = files.slice(maxBackups);
    for (const file of toDelete) {
      try {
        fs.unlinkSync(file.path);
        console.log(`Deleted old backup: ${file.name}`);
      } catch (error) {
        console.error(`Failed to delete backup ${file.name}:`, error);
      }
    }
  }

  /**
   * Verifica l'integrità di un file SQLite
   */
  private async verifyBackup(filePath: string): Promise<boolean> {
    try {
      // Verifica che il file esista e abbia una dimensione > 0
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        return false;
      }

      // Verifica l'header SQLite (primi 16 bytes devono essere "SQLite format 3")
      const buffer = Buffer.alloc(16);
      const fd = fs.openSync(filePath, "r");
      fs.readSync(fd, buffer, 0, 16, 0);
      fs.closeSync(fd);

      const header = buffer.toString("utf8", 0, 15);
      return header === "SQLite format 3";
    } catch (error) {
      console.error("Error verifying backup:", error);
      return false;
    }
  }

  /**
   * Ottiene lo spazio totale occupato dai backup
   */
  async getBackupStats(): Promise<{ count: number; totalSize: number }> {
    const backups = await this.listBackups();
    return {
      count: backups.length,
      totalSize: backups.reduce((sum, b) => sum + b.size, 0),
    };
  }
}
