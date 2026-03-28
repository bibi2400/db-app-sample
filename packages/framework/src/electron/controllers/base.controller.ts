export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Base class for all controllers.
 * Provides helper methods for creating standardized IPC responses.
 */
export abstract class BaseController {
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
