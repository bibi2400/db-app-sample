import * as fs from "fs/promises";
import * as path from "path";
import { createHash } from "crypto";
import { Database, OPEN_READONLY } from "sqlite3";

export interface BackupAttachment {
  fileName: string;
  relativePath: string;
  checksum: string;
}

export interface BackupDatabase {
  schema: Array<{ type: string; name: string; sql: string }>;
  attachments: BackupAttachment[];
}

/** Snapshot a configured external DB without modifying or removing the source. */
export async function copyDatabaseSnapshot(source: string, destination: string): Promise<void> {
  const db = await new Promise<Database>((resolve, reject) => {
    const opened = new Database(source, OPEN_READONLY, error => {
      if (error) reject(error);
      else resolve(opened);
    });
  });
  try {
    db.configure('busyTimeout', 5000);
    await new Promise<void>((resolve, reject) => {
      db.run('VACUUM INTO ?', [destination], error => error ? reject(error) : resolve());
    });
    await inspectBackup(destination);
  } finally {
    await new Promise<void>((resolve, reject) => {
      db.close(error => error ? reject(error) : resolve());
    });
  }
}

/** Read-only SQLite validation, including structure and referential integrity. */
export async function inspectBackup(filePath: string): Promise<BackupDatabase> {
  const db = await new Promise<Database>((resolve, reject) => {
    const opened = new Database(filePath, OPEN_READONLY, error => {
      if (error) reject(error);
      else resolve(opened);
    });
  });
  const query = <T>(sql: string): Promise<T[]> => new Promise((resolve, reject) => {
    db.all(sql, (error, rows: T[]) => error ? reject(error) : resolve(rows));
  });
  try {
    const integrity = await query<{ integrity_check: string }>("PRAGMA integrity_check");
    if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") {
      throw new Error("Il backup non supera la verifica di integrità SQLite.");
    }
    if ((await query("PRAGMA foreign_key_check")).length > 0) {
      throw new Error("Il backup contiene riferimenti del database non validi.");
    }
    const schema = await query<BackupDatabase["schema"][number]>(
      "SELECT type, name, sql FROM sqlite_master " +
      "WHERE name NOT GLOB 'sqlite_*' AND sql IS NOT NULL ORDER BY type, name",
    );
    if (!schema.some(entry => entry.type === "table")) {
      throw new Error("Il backup non contiene un database dell'applicazione.");
    }
    const attachments = schema.some(entry => entry.type === "table" && entry.name === "attachment")
      ? await query<BackupAttachment>('SELECT DISTINCT fileName, relativePath, checksum FROM "attachment"')
      : [];
    return { schema, attachments };
  } finally {
    await new Promise<void>((resolve, reject) => {
      db.close(error => error ? reject(error) : resolve());
    });
  }
}

export function schemaSignature(schema: BackupDatabase["schema"]): string {
  return JSON.stringify(schema.map(entry => ({
    ...entry,
    sql: entry.sql.replace(/\s+/g, " ").trim(),
  })));
}

/** Reject links and traversal for existing files and every existing parent. */
export async function containedPath(root: string, relative: string): Promise<string> {
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, relative);
  const remainder = path.relative(absoluteRoot, target);
  if (!remainder || remainder.startsWith("..") || path.isAbsolute(remainder)) {
    throw new Error("Percorso del backup o dell'allegato non valido.");
  }
  let current = absoluteRoot;
  for (const segment of ["", ...remainder.split(path.sep)]) {
    current = path.join(current, segment);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error("I collegamenti non sono ammessi nei backup.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return target;
}

export async function attachmentPath(root: string, attachment: BackupAttachment): Promise<string> {
  if (
    typeof attachment.fileName !== "string" || !attachment.fileName
    || /[\\/<>:"|?*\x00-\x1f]/.test(attachment.fileName) || path.isAbsolute(attachment.fileName)
    || typeof attachment.relativePath !== "string"
    || path.isAbsolute(attachment.relativePath)
    || /[<>:"|?*\x00-\x1f]/.test(attachment.relativePath)
    || attachment.relativePath.split(/[\\/]/).includes("..")
    || typeof attachment.checksum !== "string" || !/^[a-f0-9]{64}$/.test(attachment.checksum)
  ) {
    throw new Error("Metadati dell'allegato non validi nel backup.");
  }
  return containedPath(root, path.join(attachment.relativePath, attachment.fileName));
}

export async function verifyAttachment(file: string, expected: string): Promise<void> {
  if (!(await fs.stat(file)).isFile()) throw new Error("Allegato non valido.");
  const hash = createHash("sha256");
  const handle = await fs.open(file, "r");
  try {
    for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk);
  } finally {
    await handle.close();
  }
  if (hash.digest("hex") !== expected) {
    throw new Error("Un allegato è mancante o non supera la verifica del checksum.");
  }
}
