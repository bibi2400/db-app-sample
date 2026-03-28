export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
