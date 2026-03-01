import { BackupInfo, BackupOptions, BackupStats, RestoreResult } from "./backup";

declare global {
  interface Window {
    electronAPI: {
      test: {
        test: () => Promise<IpcResponse<any[]>>;
      };
      backup: {
        create: (options: BackupOptions) => Promise<IpcResponse<BackupInfo>>;
        auto: () => Promise<IpcResponse<BackupInfo | null>>;
        list: () => Promise<IpcResponse<BackupInfo[]>>;
        restore: (backupPath: string) => Promise<IpcResponse<RestoreResult>>;
        delete: (backupPath: string) => Promise<IpcResponse<boolean>>;
        stats: () => Promise<IpcResponse<BackupStats>>;
      };
      app: {
        reload: () => Promise<void>;
      };
    }
  }
}

export interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export { };

