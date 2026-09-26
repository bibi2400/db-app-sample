import * as fs from "fs/promises";
import * as path from "path";
import { existsSync } from "fs";
import { randomUUID } from "crypto";
import { app } from "electron";
import { DbConfigService } from "./db-config.service";
import { DataSourceService } from "./data-source.service";
import { UploadService } from "./upload.service";
import { MaintenanceService } from "./maintenance.service";
import { Injectable } from "../../helpers/mini-pie/decorators";
import { Logger } from "../../helpers/logger";
import {
  AttachmentChecksumError,
  attachmentPath,
  containedPath,
  inspectBackup,
  schemaSignature,
  verifyAttachment,
} from "../../helpers/backup-files";
import type { BackupDatabase } from "../../helpers/backup-files";
import type {
  BackupInfo,
  BackupOptions,
  BackupStats,
  RestoreResult,
} from "../../../shared/types/backup";

export type { BackupInfo, BackupOptions, RestoreResult } from "../../../shared/types/backup";

@Injectable()
export class BackupService {
  private readonly backupDir: string;

  constructor(
    private readonly dbConfigService: DbConfigService,
    private readonly dataSourceService: DataSourceService,
    private readonly uploadService: UploadService,
    private readonly maintenanceService: MaintenanceService,
  ) {
    const exeDir = app.isPackaged ? path.dirname(app.getPath("exe")) : undefined;
    const baseDir = exeDir && existsSync(path.join(exeDir, "portable"))
      ? exeDir
      : app.isPackaged ? app.getPath("userData") : app.getAppPath();
    this.backupDir = path.resolve(baseDir, "backups");
  }

  createBackup(options: BackupOptions = {}): Promise<BackupInfo> {
    return this.maintenanceService.runExclusive(() => this.create(options));
  }

  autoBackup(): Promise<BackupInfo | null> {
    return this.maintenanceService.runExclusive(async () => {
      const today = this.localDay(new Date());
      const existing = (await this.listBackups()).find(backup =>
        backup.type === "auto" && this.localDay(backup.date) === today,
      );
      if (existing) {
        try {
          const database = await this.validate(existing.path, true);
          if (await this.hasAssets(existing.path)) {
            const manifest = JSON.parse(await fs.readFile(`${existing.path}.assets/manifest.json`, "utf8"));
            if (
              manifest.databasePath === this.activeDatabasePath()
              && schemaSignature(database.schema) === schemaSignature(await this.currentSchema())
            ) return null;
          }
        } catch {
          Logger.warn("[Backup] Il backup giornaliero esistente non è valido; verrà ricreato.");
        }
      }
      return this.create({ type: "auto", maxBackups: 10 });
    });
  }

  private async create(options: BackupOptions, allowIncompleteAttachments = false): Promise<BackupInfo> {
    this.validateOptions(options);
    const databasePath = this.activeDatabasePath();
    await this.ensureDirectories();
    const type = options.type ?? "manual";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const label = options.name ? `${options.name}_` : "";
    const filename = `database_${label}${timestamp}_${randomUUID()}.eaf.sqlite`;
    const directory = path.join(this.backupDir, type);
    const backupPath = await containedPath(directory, filename);
    const staging = await containedPath(directory, `${filename}.pending`);
    const assets = `${backupPath}.assets`;
    try {
      // SQLite creates a consistent snapshot, including data still in the WAL.
      await this.dataSourceService.dataSource.query("VACUUM INTO ?", [staging]);
      const database = await inspectBackup(staging);
      await fs.mkdir(assets);
      const assetFiles = path.join(assets, "files");
      await fs.mkdir(assetFiles);
      const repository = this.uploadService.getRepositoryPath();
      const attachmentErrors: string[] = [];
      for (const attachment of database.attachments) {
        const source = await attachmentPath(repository, attachment);
        const destination = await attachmentPath(assetFiles, attachment);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        try {
          await fs.copyFile(source, destination, fs.constants.COPYFILE_EXCL);
          await verifyAttachment(destination, attachment.checksum);
        } catch (error) {
          // Only pre-restore snapshots may preserve an already damaged repository.
          // Permission, I/O and unsafe-path failures must still abort the restore.
          if (!allowIncompleteAttachments || (
            (error as NodeJS.ErrnoException).code !== "ENOENT"
            && !(error instanceof AttachmentChecksumError)
          )) throw error;
          attachmentErrors.push(path.join(attachment.relativePath, attachment.fileName));
        }
      }
      await fs.writeFile(path.join(assets, "manifest.json"), JSON.stringify({
        version: 1,
        databasePath,
        ...(attachmentErrors.length ? { attachmentErrors } : {}),
      }));
      const stat = await fs.stat(staging);
      const backup: BackupInfo = {
        filename,
        path: backupPath,
        size: stat.size + await this.directorySize(assets),
        date: stat.mtime,
        type,
        includesAttachments: attachmentErrors.length === 0,
        ...(attachmentErrors.length ? { attachmentError: this.incompleteAttachmentsMessage } : {}),
      };
      // Publish verified backups, or explicitly marked pre-restore recovery snapshots.
      await fs.rename(staging, backupPath);
      if (type === "auto") {
        try {
          await this.rotateBackups(options.maxBackups ?? 10);
        } catch (error) {
          Logger.warn("[Backup] Backup creato, ma pulizia dei precedenti non riuscita:", error);
        }
      }
      return backup;
    } catch (error) {
      await fs.rm(staging, { force: true });
      await fs.rm(assets, { recursive: true, force: true });
      throw error;
    }
  }

  restoreBackup(backupPath: string): Promise<RestoreResult> {
    return this.maintenanceService.runExclusive(() => this.restore(backupPath));
  }

  private async restore(backupPath: string): Promise<RestoreResult> {
    const source = await this.managedBackup(backupPath);
    const dbPath = this.activeDatabasePath();
    const operationId = randomUUID();
    const staged = `${dbPath}.restore-${operationId}`;
    const rollback = `${dbPath}.rollback-${operationId}`;
    const assetStage = await containedPath(this.backupDir, `.restore-${operationId}`);
    const repository = this.uploadService.getRepositoryPath();
    const changed: Array<{ target: string; previous?: string }> = [];
    let databaseMoved = false;
    let connectionClosed = false;
    let recoveryFailed = false;
    let safety: BackupInfo | undefined;
    try {
      await fs.copyFile(source, staged, fs.constants.COPYFILE_EXCL);
      const database = await this.validate(staged, false);
      const liveSchema = await this.currentSchema();
      if (schemaSignature(database.schema) !== schemaSignature(liveSchema)) {
        throw new Error("Il backup ha uno schema incompatibile con questa versione dell'applicazione.");
      }
      const includesAttachments = await this.hasAssets(source);
      const assets = includesAttachments ? path.join(`${source}.assets`, "files") : repository;
      await fs.mkdir(assetStage);
      // Validate/copy before changing the live database or any repository file.
      for (const attachment of database.attachments) {
        const origin = await attachmentPath(assets, attachment);
        await verifyAttachment(origin, attachment.checksum);
        if (includesAttachments) {
          const destination = await attachmentPath(path.join(assetStage, "files"), attachment);
          await fs.mkdir(path.dirname(destination), { recursive: true });
          await fs.copyFile(origin, destination);
          await verifyAttachment(destination, attachment.checksum);
        }
      }
      safety = await this.create({ type: "manual", name: "pre-restore" }, true);
      if ((await fs.lstat(dbPath)).isSymbolicLink()) {
        throw new Error("Il ripristino non è consentito su un database collegato simbolicamente.");
      }
      const checkpoint = await this.dataSourceService.dataSource.query("PRAGMA wal_checkpoint(TRUNCATE)");
      if (checkpoint.some((row: { busy: number }) => row.busy !== 0)) {
        throw new Error("Il database è in uso da un altro processo. Chiudilo e riprova.");
      }
      connectionClosed = true;
      await this.dataSourceService.destroy();
      await fs.copyFile(dbPath, rollback, fs.constants.COPYFILE_EXCL);
      await fs.rename(staged, dbPath);
      databaseMoved = true;
      if (includesAttachments) {
        for (const [index, attachment] of database.attachments.entries()) {
          const target = await attachmentPath(repository, attachment);
          const replacement = await attachmentPath(path.join(assetStage, "files"), attachment);
          await fs.mkdir(path.dirname(target), { recursive: true });
          let previous: string | undefined;
          try {
            await fs.access(target);
            previous = path.join(assetStage, `.previous-${index}`);
            await fs.copyFile(target, previous, fs.constants.COPYFILE_EXCL);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
          changed.push({ target, previous });
          await fs.copyFile(replacement, target);
        }
      }
      await this.dataSourceService.initialize();
      connectionClosed = false;
      databaseMoved = false;
      try {
        await fs.rm(rollback, { force: true });
      } catch (error) {
        Logger.warn("[Backup] Copia di recupero conservata:", rollback, error);
      }
      return {
        success: true,
        message: "Ripristino completato. Database e allegati verificati.",
        backupCreated: safety.path,
        reloadRequired: true,
      };
    } catch (error) {
      if (connectionClosed || databaseMoved) {
        try {
          await this.dataSourceService.destroy();
          if (databaseMoved) {
            await fs.rm(dbPath, { force: true });
            // The old WAL was checkpointed before closing; remove only the new sidecars.
            await fs.rm(`${dbPath}-wal`, { force: true });
            await fs.rm(`${dbPath}-shm`, { force: true });
            await fs.rename(rollback, dbPath);
          }
          for (const change of changed.reverse()) {
            if (change.previous) await fs.copyFile(change.previous, change.target);
            else await fs.rm(change.target, { force: true });
          }
          await this.dataSourceService.initialize();
        } catch (recoveryError) {
          recoveryFailed = true;
          const message = "Ripristino e recupero automatico non riusciti. " +
            `Riavvia l'app e conserva la copia di sicurezza: ${safety?.path ?? rollback}.`;
          this.maintenanceService.failClosed(message);
          Logger.error("[Backup] Recupero fallito:", recoveryError);
          throw new Error(message);
        }
      }
      throw error;
    } finally {
      try {
        await fs.rm(staged, { force: true });
        if (!recoveryFailed) {
          await fs.rm(assetStage, { recursive: true, force: true });
          await fs.rm(rollback, { force: true });
        }
      } catch (error) {
        Logger.warn("[Backup] File temporanei conservati dopo il ripristino:", error);
      }
    }
  }

  async listBackups(): Promise<BackupInfo[]> {
    await this.ensureDirectories();
    const backups: BackupInfo[] = [];
    for (const type of ["auto", "manual"] as const) {
      const directory = path.join(this.backupDir, type);
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".sqlite")) continue;
        const file = await containedPath(directory, entry.name);
        backups.push(await this.info(file, type));
      }
    }
    return backups.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  deleteBackup(backupPath: string): Promise<boolean> {
    return this.maintenanceService.runExclusive(async () => {
      const file = await this.managedBackup(backupPath);
      await this.remove(file);
      return true;
    });
  }

  async getBackupStats(): Promise<BackupStats> {
    const backups = await this.listBackups();
    return {
      count: backups.length,
      totalSize: backups.reduce((sum, backup) => sum + backup.size, 0),
    };
  }

  private async validate(file: string, attachments: boolean): Promise<BackupDatabase> {
    const database = await inspectBackup(file);
    if (attachments) {
      const root = await this.hasAssets(file)
        ? path.join(`${file}.assets`, "files")
        : this.uploadService.getRepositoryPath();
      for (const attachment of database.attachments) {
        await verifyAttachment(await attachmentPath(root, attachment), attachment.checksum);
      }
    }
    return database;
  }

  private async hasAssets(file: string): Promise<boolean> {
    const assets = `${file}.assets`;
    try {
      const manifest = await containedPath(assets, "manifest.json");
      const data: unknown = JSON.parse(await fs.readFile(manifest, "utf8"));
      if (!data || typeof data !== "object" || (data as { version?: unknown }).version !== 1) {
        throw new Error("Formato degli allegati del backup non supportato.");
      }
      const errors = (data as { attachmentErrors?: unknown }).attachmentErrors;
      if (errors !== undefined) {
        if (!Array.isArray(errors) || errors.some(error => typeof error !== "string")) {
          throw new Error("Formato degli allegati del backup non supportato.");
        }
        if (errors.length) throw new Error(this.incompleteAttachmentsMessage);
      }
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      // An existing assets folder without a manifest is an incomplete backup, not a legacy one.
      try {
        await fs.lstat(assets);
      } catch (missing) {
        if ((missing as NodeJS.ErrnoException).code === "ENOENT") {
          if (file.endsWith(".eaf.sqlite")) {
            throw new Error("La cartella degli allegati del backup è mancante.");
          }
          return false;
        }
        throw missing;
      }
      throw new Error("Il backup degli allegati è incompleto.");
    }
  }

  private async info(file: string, type: "auto" | "manual"): Promise<BackupInfo> {
    const stat = await fs.stat(file);
    // Listing remains available even when a bundle is damaged; restore validates it strictly.
    let includesAttachments = false;
    let attachmentError: string | undefined;
    try {
      includesAttachments = await this.hasAssets(file);
    } catch (error) {
      attachmentError = error instanceof Error ? error.message : "Allegati del backup non disponibili.";
    }
    let size = stat.size;
    const assets = `${file}.assets`;
    try {
      const assetStat = await fs.lstat(assets);
      if (assetStat.isSymbolicLink()) throw new Error("Collegamento non valido nella cartella degli allegati.");
      if (assetStat.isDirectory()) size += await this.directorySize(assets);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        attachmentError = error instanceof Error ? error.message : "Allegati non disponibili.";
      }
    }
    return {
      filename: path.basename(file),
      path: file,
      size,
      date: stat.mtime,
      type,
      includesAttachments,
      attachmentError,
    };
  }

  private async directorySize(directory: string): Promise<number> {
    let size = 0;
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = await containedPath(directory, entry.name);
      if (entry.isDirectory()) size += await this.directorySize(file);
      else if (entry.isFile()) size += (await fs.stat(file)).size;
    }
    return size;
  }

  private async managedBackup(value: string): Promise<string> {
    if (typeof value !== "string" || !path.isAbsolute(value) || !value.endsWith(".sqlite")) {
      throw new Error("Percorso del backup non valido.");
    }
    const file = path.resolve(value);
    const directory = path.dirname(file);
    const directories = [path.join(this.backupDir, "auto"), path.join(this.backupDir, "manual")];
    if (!directories.includes(directory)) throw new Error("Il file non appartiene ai backup gestiti.");
    await containedPath(this.backupDir, path.relative(this.backupDir, file));
    if (!(await fs.lstat(file)).isFile()) throw new Error("Il backup non è un file regolare.");
    return file;
  }

  private validateOptions(options: BackupOptions): void {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new Error("Opzioni del backup non valide.");
    }
    if (options.type !== undefined && options.type !== "auto" && options.type !== "manual") {
      throw new Error("Tipo di backup non valido.");
    }
    if (options.name !== undefined && (
      typeof options.name !== "string" || !/^[a-zA-Z0-9_-]{1,60}$/.test(options.name)
    )) throw new Error("Il nome del backup contiene caratteri non ammessi.");
    if (options.maxBackups !== undefined && (
      !Number.isInteger(options.maxBackups) || options.maxBackups < 1 || options.maxBackups > 1000
    )) throw new Error("Il numero di backup da conservare deve essere tra 1 e 1000.");
  }

  private async ensureDirectories(): Promise<void> {
    for (const type of ["auto", "manual"]) {
      const directory = await containedPath(this.backupDir, type);
      await fs.mkdir(directory, { recursive: true });
    }
  }

  private async rotateBackups(limit: number): Promise<void> {
    const backups = (await this.listBackups()).filter(backup => backup.type === "auto");
    for (const backup of backups.slice(limit)) {
      await this.remove(await this.managedBackup(backup.path));
    }
  }

  private async remove(file: string): Promise<void> {
    await containedPath(this.backupDir, path.relative(this.backupDir, `${file}.assets`));
    await fs.rm(`${file}.assets`, { recursive: true, force: true });
    await fs.unlink(file);
  }

  private localDay(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }

  private get incompleteAttachmentsMessage(): string {
    return "Copia di sicurezza precedente al ripristino: alcuni allegati erano mancanti o danneggiati. " +
      "Database e file disponibili conservati; questa copia non consente un ripristino completo.";
  }

  private async currentSchema(): Promise<BackupDatabase["schema"]> {
    return this.dataSourceService.dataSource.query(
      "SELECT type, name, sql FROM sqlite_master " +
      "WHERE name NOT GLOB 'sqlite_*' AND sql IS NOT NULL ORDER BY type, name",
    );
  }

  private activeDatabasePath(): string {
    const active = this.dataSourceService.dataSource.options.database;
    const configured = path.resolve(this.dbConfigService.dbPath);
    if (typeof active !== "string" || path.resolve(active) !== configured) {
      throw new Error("Il percorso del database è cambiato. Chiudi e riapri l’app prima di gestire i backup.");
    }
    return configured;
  }
}
