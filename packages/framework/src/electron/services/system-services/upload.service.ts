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
        // reuse its Attachment row and skip writing to disk.
        const precomputedChecksum = this.computeChecksum(file.data);
        const existing = await repo.findOne({ where: { checksum: precomputedChecksum } });
        if (existing) {
          bytesDoneGlobal += fileSize;
          const info = { ...this.toInfo(existing, repoPath), deduplicated: true };
          attachments.push(info);
          Logger.info(`[Upload] Deduplicated ${file.name} → reusing attachment id=${existing.id} (checksum match).`);
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
        });
        const saved = await repo.save(entity);

        const info = this.toInfo(saved, repoPath);
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

  /** Deletes an attachment record AND the file on disk. */
  async deleteAttachment(id: number): Promise<boolean> {
    const repo = this.dataSourceService.model(Attachment);
    const row = await repo.findOne({ where: { id } });
    if (!row) return false;
    const fullPath = path.join(this.getRepositoryPath(), row.relativePath, row.fileName);
    try {
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch (err) {
      Logger.warn(`[Upload] Could not delete file on disk for attachment ${id}:`, err);
    }
    await repo.remove(row);
    return true;
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
      uploadDate: (entity.uploadDate instanceof Date
        ? entity.uploadDate
        : new Date(entity.uploadDate)
      ).toISOString(),
    };
  }
}
