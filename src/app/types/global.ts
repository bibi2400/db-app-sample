import { BackupInfo, BackupOptions, BackupStats, RestoreResult } from "./backup";
import { UpdateStatus } from "./update";

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
      update: {
        check: () => Promise<IpcResponse<null>>;
        status: () => Promise<IpcResponse<UpdateStatus>>;
        download: () => Promise<IpcResponse<null>>;
        install: () => Promise<IpcResponse<null>>;
      };
      app: {
        reload: () => Promise<void>;
      };
      on: (channel: string, callback: (...args: unknown[]) => void) => void;
      off: (channel: string, callback: (...args: unknown[]) => void) => void;
    }
  }
}

export interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export { };

