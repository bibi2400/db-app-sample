import { AsyncLocalStorage } from "async_hooks";
import { Injectable } from "../../helpers/mini-pie/decorators";

interface MaintenanceContext {
  exclusive: boolean;
  counted?: boolean;
  finished?: boolean;
}

/** Drains active IPC requests before database/file maintenance begins. */
@Injectable()
export class MaintenanceService {
  private readonly context = new AsyncLocalStorage<MaintenanceContext>();
  private active = 0;
  private pending = 0;
  private drained?: () => void;
  private queue: Promise<unknown> = Promise.resolve();
  private failure?: string;

  async runRequest<T>(operation: () => Promise<T>, waitForMaintenance = false): Promise<T> {
    if (this.context.getStore()) return operation();
    if (waitForMaintenance) {
      while (this.pending > 0) await this.queue;
    }
    if (this.failure) throw new Error(this.failure);
    if (this.pending > 0) {
      throw new Error("Manutenzione dei backup in corso. Attendi il completamento e riprova.");
    }
    this.active++;
    const request: MaintenanceContext = { exclusive: false, counted: true };
    try {
      return await this.context.run(request, operation);
    } finally {
      request.finished = true;
      if (request.counted) this.active--;
      if (this.active === 0) this.drained?.();
    }
  }

  runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const request = this.context.getStore();
    if (request?.exclusive) return operation();
    this.pending++;
    // Consumer controllers may request a backup themselves; do not wait on the caller.
    if (request?.counted) {
      request.counted = false;
      this.active--;
      if (this.active === 0) this.drained?.();
    }
    const result = this.queue.then(async () => {
      if (this.failure) throw new Error(this.failure);
      if (this.active > 0) {
        await new Promise<void>(resolve => { this.drained = resolve; });
        this.drained = undefined;
      }
      return this.context.run({ exclusive: true }, operation);
    });
    const completed = result.finally(() => {
      if (request && !request.finished) {
        request.counted = true;
        this.active++;
      }
      this.pending--;
    });
    this.queue = completed.catch(() => {});
    return completed;
  }

  /** Keep IPC blocked if neither the restored database nor rollback can be opened. */
  failClosed(message: string): void {
    this.failure = message;
  }
}
