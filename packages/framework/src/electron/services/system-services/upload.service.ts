import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { Injectable } from "../../helpers/mini-pie/decorators";
import { PushChannel, PushEvent } from "../../decorators/push-channel.decorator";
import { PushEmitter } from "../../helpers/push/push-emitter";
import { Logger } from "../../helpers/logger";
import { Attachment } from "../../entities/attachment";
import {
  AttachmentInfo,
  AttachToOwnerOptions,
  UploadFileRequest,
  UploadOptions,
  UploadProgress,
  UploadResult,
} from "../../../shared/types/upload";
import { AppConfigService } from "./app-config.service";
import { AppDataService } from "./app-data.service";
import { DataSourceService } from "./data-source.service";
import { PushService } from "./push.service";

const CHUNK_SIZE = 64 * 1024; // 64 KB chunks for progress granularity

/**
 * Manages file uploads into the application repository folder.
 *
 * - Repository path is read from AppConfigService.settings.uploadRepositoryPath,
 *   defaulting to <userData>/uploads.
 * - Files are written in chunks; per-file and overall progress are emitted on
 *   the `push:upload:progress` channel.
 * - Each successful upload creates an Attachment row in the database.
 */
@PushChannel("upload")
@Injectable()
export class UploadService {
  @PushEvent("progress")
  readonly progress = new PushEmitter<UploadProgress>();

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly appDataService: AppDataService,
    private readonly dataSourceService: DataSourceService,
    private readonly pushService: PushService,
  ) {
    this.pushService.initializeChannel(this);
  }

  // ── Repository path ─────────────────────────────────────────────

  /** Returns the absolute path of the upload repository folder, ensuring it exists. */
  getRepositoryPath(): string {
    const configured = this.appConfigService.settings.uploadRepositoryPath;
    const repoPath = configured && configured.trim()
      ? configured
      : this.appDataService.resolve("uploads");
    if (!fs.existsSync(repoPath)) {
      fs.mkdirSync(repoPath, { recursive: true });
    }
    return repoPath;
  }

  /** Updates the repository path in app settings. The folder is created if missing. */
  setRepositoryPath(newPath: string): void {
    if (!newPath || !newPath.trim()) {
      throw new Error("Il percorso del repository non può essere vuoto.");
    }
    const abs = path.resolve(newPath);
    if (!fs.existsSync(abs)) {
      fs.mkdirSync(abs, { recursive: true });
    }
    this.appConfigService.updateSettings({ uploadRepositoryPath: abs });
    Logger.info(`[Upload] Repository path set to: ${abs}`);
  }

  // ── Upload ──────────────────────────────────────────────────────

  /**
   * Uploads one or more files. Each file is written chunk by chunk and a
   * matching Attachment row is created. Progress events are emitted on
   * `push:upload:progress`.
   */
  async uploadFiles(files: UploadFileRequest[], options: UploadOptions = {}): Promise<UploadResult> {
    if (!files || files.length === 0) {
      throw new Error("Nessun file fornito.");
    }

    const uploadId = options.uploadId ?? randomUUID();
    const relativePath = this.sanitizeRelativePath(options.relativePath ?? "");
    const ownerType = options.ownerType ?? null;
    const ownerId = options.ownerId ?? null;
    if ((ownerType === null) !== (ownerId === null)) {
      throw new Error("ownerType e ownerId devono essere entrambi valorizzati o entrambi assenti.");
    }
    const repoPath = this.getRepositoryPath();
    const targetDir = path.join(repoPath, relativePath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const totalBytes = files.reduce((acc, f) => acc + f.data.byteLength, 0);
    let bytesDoneGlobal = 0;

    const attachments: AttachmentInfo[] = [];
    const errors: { fileName: string; error: string }[] = [];
    const repo = this.dataSourceService.model(Attachment);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileSize = file.data.byteLength;
      const storedName = this.buildStoredName(file.name);
      const fullPath = path.join(targetDir, storedName);

      try {
        // Deduplication: if a file with the same checksum already exists,
        // either reuse its Attachment row (when it has no owner conflict) or
        // create a new Attachment row pointing at the same physical file.
        const precomputedChecksum = this.computeChecksum(file.data);
        const existing = await repo.findOne({ where: { checksum: precomputedChecksum } });
        if (existing) {
          bytesDoneGlobal += fileSize;
          let target = existing;
          let isNewRow = false;
          if (ownerType !== null) {
            const sameOwner =
              existing.ownerType === ownerType && existing.ownerId === ownerId;
            if (!sameOwner) {
              if (existing.ownerType === null && existing.ownerId === null) {
                // Orphan attachment: claim it for the requested owner.
                existing.ownerType = ownerType;
                existing.ownerId = ownerId;
                target = await repo.save(existing);
              } else {
                // File already owned by someone else: create a new row that
                // reuses the same physical file (same fileName/relativePath/checksum).
                const dup = repo.create({
                  fileName: existing.fileName,
                  originalName: file.name,
                  relativePath: existing.relativePath,
                  size: existing.size,
                  mimeType: existing.mimeType,
                  checksum: existing.checksum,
                  ownerType,
                  ownerId,
                });
                target = await repo.save(dup);
                isNewRow = true;
              }
            }
          } else {
            // Draft / orphan upload (no owner requested). Never return a row
            // that already belongs to someone else: that would let the caller
            // accidentally re-assign another owner's attachment via
            // attachToOwner. Instead, create a new orphan row pointing at the
            // same physical file.
            if (existing.ownerType !== null || existing.ownerId !== null) {
              const dup = repo.create({
                fileName: existing.fileName,
                originalName: file.name,
                relativePath: existing.relativePath,
                size: existing.size,
                mimeType: existing.mimeType,
                checksum: existing.checksum,
                ownerType: null,
                ownerId: null,
              });
              target = await repo.save(dup);
              isNewRow = true;
            }
          }
          const info = { ...this.toInfo(target, repoPath), deduplicated: true, isNewRow };
          attachments.push(info);
          Logger.info(`[Upload] Deduplicated ${file.name} → attachment id=${target.id} (checksum match, isNewRow=${isNewRow}).`);
          this.progress.emit({
            uploadId,
            fileIndex: i,
            fileCount: files.length,
            fileName: file.name,
            bytesProcessed: fileSize,
            bytesTotal: fileSize,
            overallPercent: totalBytes > 0
              ? Math.min(100, Math.round((bytesDoneGlobal / totalBytes) * 100))
              : 100,
            status: "completed",
            deduplicated: true,
          });
          continue;
        }

        const checksum = await this.writeChunked(fullPath, file.data, (written) => {
          const overall = totalBytes > 0
            ? Math.min(100, Math.round(((bytesDoneGlobal + written) / totalBytes) * 100))
            : 0;
          this.progress.emit({
            uploadId,
            fileIndex: i,
            fileCount: files.length,
            fileName: file.name,
            bytesProcessed: written,
            bytesTotal: fileSize,
            overallPercent: overall,
            status: "uploading",
          });
        });

        bytesDoneGlobal += fileSize;

        const entity = repo.create({
          fileName: storedName,
          originalName: file.name,
          relativePath,
          size: fileSize,
          mimeType: file.mimeType ?? null,
          checksum,
          ownerType,
          ownerId,
        });
        const saved = await repo.save(entity);

        const info = { ...this.toInfo(saved, repoPath), isNewRow: true };
        attachments.push(info);

        this.progress.emit({
          uploadId,
          fileIndex: i,
          fileCount: files.length,
          fileName: file.name,
          bytesProcessed: fileSize,
          bytesTotal: fileSize,
          overallPercent: totalBytes > 0
            ? Math.min(100, Math.round((bytesDoneGlobal / totalBytes) * 100))
            : 100,
          status: "completed",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Logger.error(`[Upload] Failed to upload ${file.name}:`, err);
        errors.push({ fileName: file.name, error: message });
        // Best-effort cleanup of the partial file
        try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch { /* ignore */ }

        this.progress.emit({
          uploadId,
          fileIndex: i,
          fileCount: files.length,
          fileName: file.name,
          bytesProcessed: 0,
          bytesTotal: fileSize,
          overallPercent: totalBytes > 0
            ? Math.min(100, Math.round((bytesDoneGlobal / totalBytes) * 100))
            : 0,
          status: "error",
          error: message,
        });
      }
    }

    return { uploadId, attachments, errors };
  }

  // ── Read / list / delete ────────────────────────────────────────

  async listAttachments(relativePath?: string): Promise<AttachmentInfo[]> {
    const repo = this.dataSourceService.model(Attachment);
    const where = relativePath !== undefined
      ? { relativePath: this.sanitizeRelativePath(relativePath) }
      : undefined;
    const rows = await repo.find({ where, order: { uploadDate: "DESC" } });
    const repoPath = this.getRepositoryPath();
    return rows.map(r => this.toInfo(r, repoPath));
  }

  async getAttachment(id: number): Promise<AttachmentInfo | null> {
    const repo = this.dataSourceService.model(Attachment);
    const row = await repo.findOne({ where: { id } });
    if (!row) return null;
    return this.toInfo(row, this.getRepositoryPath());
  }

  /** Deletes an attachment record AND the file on disk (only if no other Attachment shares the same checksum). */
  async deleteAttachment(id: number): Promise<boolean> {
    const repo = this.dataSourceService.model(Attachment);
    const row = await repo.findOne({ where: { id } });
    if (!row) return false;
    const fullPath = path.join(this.getRepositoryPath(), row.relativePath, row.fileName);
    await repo.remove(row);
    // Only delete the physical file if no remaining attachment references it.
    const stillReferenced = await repo.count({ where: { checksum: row.checksum } });
    if (stillReferenced === 0) {
      try {
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch (err) {
        Logger.warn(`[Upload] Could not delete file on disk for attachment ${id}:`, err);
      }
    }
    return true;
  }

  // ── Owner operations ────────────────────────────────────

  /** Lists all attachments belonging to the given polymorphic owner. */
  async listByOwner(ownerType: string, ownerId: number): Promise<AttachmentInfo[]> {
    const repo = this.dataSourceService.model(Attachment);
    const rows = await repo.find({
      where: { ownerType, ownerId },
      order: { uploadDate: "DESC" },
    });
    const repoPath = this.getRepositoryPath();
    return rows.map((r) => this.toInfo(r, repoPath));
  }

  /**
   * Associates an existing attachment to an owner (typically used to claim an
   * orphan, or to transfer a draft attachment to its newly-created owner).
   *
   * @param options.mode
   *  - 'safe' (default): refuses to reassign a row that already belongs to a
   *    different owner — throws an Error. Same-owner is a no-op. This protects
   *    against accidentally stealing another entity's attachment when a draft
   *    upload returned a deduplicated row.
   *  - 'claim': force-reassigns regardless of current ownership (legacy).
   */
  async attachToOwner(
    id: number,
    ownerType: string,
    ownerId: number,
    options: AttachToOwnerOptions = {},
  ): Promise<AttachmentInfo | null> {
    const mode = options.mode ?? 'safe';
    const repo = this.dataSourceService.model(Attachment);
    const row = await repo.findOne({ where: { id } });
    if (!row) return null;
    if (row.ownerType !== null || row.ownerId !== null) {
      const sameOwner = row.ownerType === ownerType && row.ownerId === ownerId;
      if (!sameOwner && mode === 'safe') {
        throw new Error(
          `attachToOwner: l'allegato id=${id} appartiene già a ` +
          `${row.ownerType}:${row.ownerId} (richiesto ${ownerType}:${ownerId}). ` +
          `Usa mode:'claim' per forzare la riassegnazione.`,
        );
      }
    }
    row.ownerType = ownerType;
    row.ownerId = ownerId;
    const saved = await repo.save(row);
    return this.toInfo(saved, this.getRepositoryPath());
  }

  /**
   * Atomically associates many attachments to the same owner. Useful to
   * "commit" all draft uploads of a form to a newly-created entity. Either all
   * rows are reassigned, or none. See {@link attachToOwner} for `options.mode`.
   */
  async attachManyToOwner(
    ids: number[],
    ownerType: string,
    ownerId: number,
    options: AttachToOwnerOptions = {},
  ): Promise<AttachmentInfo[]> {
    if (!ids.length) return [];
    const mode = options.mode ?? 'safe';
    const dataSource = this.dataSourceService.dataSource;
    const repoPath = this.getRepositoryPath();
    return await dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Attachment);
      const result: AttachmentInfo[] = [];
      for (const id of ids) {
        const row = await repo.findOne({ where: { id } });
        if (!row) {
          throw new Error(`attachManyToOwner: allegato id=${id} non trovato.`);
        }
        if (row.ownerType !== null || row.ownerId !== null) {
          const sameOwner = row.ownerType === ownerType && row.ownerId === ownerId;
          if (!sameOwner && mode === 'safe') {
            throw new Error(
              `attachManyToOwner: l'allegato id=${id} appartiene già a ` +
              `${row.ownerType}:${row.ownerId} (richiesto ${ownerType}:${ownerId}). ` +
              `Usa mode:'claim' per forzare.`,
            );
          }
        }
        row.ownerType = ownerType;
        row.ownerId = ownerId;
        const saved = await repo.save(row);
        result.push(this.toInfo(saved, repoPath));
      }
      return result;
    });
  }

  /** Removes the owner association from an attachment, leaving it orphan. */
  async detachFromOwner(id: number): Promise<AttachmentInfo | null> {
    const repo = this.dataSourceService.model(Attachment);
    const row = await repo.findOne({ where: { id } });
    if (!row) return null;
    row.ownerType = null;
    row.ownerId = null;
    const saved = await repo.save(row);
    return this.toInfo(saved, this.getRepositoryPath());
  }

  /** Deletes all attachments belonging to the given owner. Returns the count deleted. */
  async deleteByOwner(ownerType: string, ownerId: number): Promise<number> {
    const repo = this.dataSourceService.model(Attachment);
    const rows = await repo.find({ where: { ownerType, ownerId } });
    let count = 0;
    for (const row of rows) {
      const ok = await this.deleteAttachment(row.id);
      if (ok) count++;
    }
    return count;
  }

  // ── Internals ───────────────────────────────────────────────────

  private writeChunked(
    fullPath: string,
    data: Uint8Array,
    onProgress: (bytesWritten: number) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(fullPath);
      const hash = createHash("sha256");
      let written = 0;
      let offset = 0;

      const writeNext = () => {
        if (offset >= data.byteLength) {
          stream.end();
          return;
        }
        const end = Math.min(offset + CHUNK_SIZE, data.byteLength);
        const chunk = data.subarray(offset, end);
        hash.update(chunk);
        const ok = stream.write(chunk);
        offset = end;
        written = offset;
        onProgress(written);
        if (ok) {
          // Yield to event loop so progress events flush
          setImmediate(writeNext);
        } else {
          stream.once("drain", writeNext);
        }
      };

      stream.on("error", (err) => reject(err));
      stream.on("finish", () => resolve(hash.digest("hex")));
      writeNext();
    });
  }

  /** Computes the SHA-256 checksum (hex) of the given data. */
  private computeChecksum(data: Uint8Array): string {
    return createHash("sha256").update(data).digest("hex");
  }

  private buildStoredName(originalName: string): string {
    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 60);
    const ts = Date.now();
    const rnd = Math.random().toString(36).slice(2, 8);
    return `${ts}_${rnd}_${base}${ext}`;
  }

  /** Strips leading slashes, normalizes separators, prevents path traversal. */
  private sanitizeRelativePath(rel: string): string {
    if (!rel) return "";
    const normalized = path
      .normalize(rel)
      .replace(/^([/\\])+/, "")
      .replace(/\\/g, "/");
    if (normalized.split("/").some(seg => seg === "..")) {
      throw new Error("Percorso relativo non valido (path traversal).");
    }
    return normalized;
  }

  private toInfo(entity: Attachment, repoPath: string): AttachmentInfo {
    return {
      id: entity.id,
      fileName: entity.fileName,
      originalName: entity.originalName,
      relativePath: entity.relativePath,
      fullPath: path.join(repoPath, entity.relativePath, entity.fileName),
      size: entity.size,
      mimeType: entity.mimeType ?? null,
      checksum: entity.checksum,
      ownerType: entity.ownerType ?? null,
      ownerId: entity.ownerId ?? null,
      uploadDate: (entity.uploadDate instanceof Date
        ? entity.uploadDate
        : new Date(entity.uploadDate)
      ).toISOString(),
    };
  }
}
