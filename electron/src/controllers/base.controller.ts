export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Base class for all controllers.
 * Provides helper methods for creating standardized IPC responses.
 *
 * Controllers should:
 * 1. Extend this class
 * 2. Be decorated with @Controller({ prefix: 'your-prefix' })
 * 3. Declare dependencies in the constructor (they will be auto-injected)
 * 4. Use @IpcHandler('channel') on methods to register IPC handlers
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

