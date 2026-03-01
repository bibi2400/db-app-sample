import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { getIpcHandlerMetadata } from '../decorators/ipc-handler.decorator';

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export type Handler = (...args: unknown[]) => Promise<IpcResponse>;

export abstract class BaseController {
  protected channelPrefix: string;

  constructor(channelPrefix: string) {
    this.channelPrefix = channelPrefix;
  }

  public registerHandlers(): void {
    const metadata = getIpcHandlerMetadata(Object.getPrototypeOf(this));
    metadata.forEach(({ channel, methodName }) => {
      console.log(`Registering IPC handler: ${this.channelPrefix}:${channel} -> ${methodName}`);
      const handler = (this as unknown as Record<string, Handler>)[methodName].bind(this);
      ipcMain.handle(`${this.channelPrefix}:${channel}`, (_event, ...args) => {
        return handler(...args);
      });
    });
  }

  protected success<T>(data: T): IpcResponse<T> {
    return { success: true, data };
  }

  protected error(error: string | Error | unknown): IpcResponse {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

