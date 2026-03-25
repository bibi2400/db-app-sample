declare global {
  interface Window {
    electronAPI: {
      /**
       * Generic IPC invoke method. Use this to call any IPC handler.
       * @param channel - The full channel name (e.g., 'backup:create', 'update:check')
       * @param args - Arguments to pass to the handler
       */
      invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;

      /**
       * Subscribe to push events from main process.
       * Only channels starting with 'push:' are allowed.
       */
      on: (channel: string, callback: (...args: unknown[]) => void) => void;

      /**
       * Unsubscribe from push events.
       */
      off: (channel: string, callback: (...args: unknown[]) => void) => void;
    }
  }
}

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export { };