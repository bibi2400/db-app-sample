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

      /**
       * Set the zoom level of the renderer window.
       * Level 0 = 100%, 1 = 120%, -1 = ~83%, etc. (each step = ×1.2)
       */
      setZoomLevel: (level: number) => void;

      /**
       * Get the current zoom level of the renderer window.
       */
      getZoomLevel: () => number;
    }
  }
}

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export { };