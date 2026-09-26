export interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  date: Date;
  type: "auto" | "manual";
  /** Older .sqlite backups contain only the database. */
  includesAttachments?: boolean;
  attachmentError?: string;
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
  reloadRequired?: boolean;
}

export interface BackupStats {
  count: number;
  totalSize: number;
}
