/**
 * Information about a file uploaded into the application repository.
 * Mirrors the Attachment TypeORM entity (without internal fields).
 */
export interface AttachmentInfo {
  id: number;
  /** Stored file name (unique, includes timestamp prefix) */
  fileName: string;
  /** Original file name as provided by the user */
  originalName: string;
  /** Relative path inside the repository (folders, no leading slash) */
  relativePath: string;
  /** Absolute path on disk (computed at read time) */
  fullPath: string;
  /** File size in bytes */
  size: number;
  /** MIME type if known */
  mimeType: string | null;
  /** SHA-256 checksum (hex, lowercase) of the file content */
  checksum: string;
  /** ISO date string of upload */
  uploadDate: string;
  /** Transient: true if this attachment was reused via checksum dedup (set only in uploadFiles response) */
  deduplicated?: boolean;
}

/**
 * Single file transfer payload sent from Angular to Electron.
 * The data is transferred as Uint8Array via structured clone (Electron IPC).
 */
export interface UploadFileRequest {
  /** Original file name */
  name: string;
  /** MIME type (from File.type) */
  mimeType?: string;
  /** Raw file bytes */
  data: Uint8Array;
}

/**
 * Options for an upload operation (one or more files).
 */
export interface UploadOptions {
  /** Optional client-supplied id used to correlate progress events */
  uploadId?: string;
  /** Relative folder inside the repository (e.g. 'images/avatars') */
  relativePath?: string;
}

/**
 * Push event emitted while an upload is in progress.
 * Channel: `push:upload:progress`
 */
export interface UploadProgress {
  uploadId: string;
  /** Index of the file currently being processed (0-based) */
  fileIndex: number;
  /** Total number of files in this upload */
  fileCount: number;
  /** Name of the file currently being processed */
  fileName: string;
  /** Bytes written for the current file */
  bytesProcessed: number;
  /** Total size of the current file */
  bytesTotal: number;
  /** Overall progress across all files in this upload (0-100) */
  overallPercent: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
  /** True if the file matched an existing attachment via checksum and was not re-saved */
  deduplicated?: boolean;
}

/**
 * Result of an upload operation.
 */
export interface UploadResult {
  uploadId: string;
  attachments: AttachmentInfo[];
  errors: { fileName: string; error: string }[];
}
