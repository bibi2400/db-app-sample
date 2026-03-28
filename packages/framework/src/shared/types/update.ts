export type UpdateStatusType = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

export interface UpdateStatus {
  status: UpdateStatusType;
  currentVersion: string;
  availableVersion?: string;
  releaseDate?: string;
  releaseNotes?: string;
  changelogs?: ChangelogEntry[];
  error?: string;
}

export interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  body: string;
}
