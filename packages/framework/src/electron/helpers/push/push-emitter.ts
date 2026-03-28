/**
 * A typed emitter for push events.
 * Must be initialized via PushService.initializeChannel() before use.
 * Use `void` as type parameter for events with no payload.
 */
export class PushEmitter<T = void> {
  private sendFn: ((data: unknown) => void) | null = null;

  /** @internal Called by PushService.initializeChannel */
  _initialize(sendFn: (data: unknown) => void): void {
    this.sendFn = sendFn;
  }

  emit(...args: T extends void ? [] : [data: T]): void {
    if (!this.sendFn) {
      throw new Error('PushEmitter not initialized. Ensure PushService.initializeChannel() was called.');
    }
    this.sendFn(args[0]);
  }
}
