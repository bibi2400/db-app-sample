import { inject, Injectable, NgZone } from '@angular/core';
import { map, Observable } from 'rxjs';

/**
 * Centralized service for receiving push events from the Electron main process.
 * Wraps ipcRenderer.on/off into typed RxJS Observables.
 *
 * All channels are prefixed with `push:` (enforced by the preload layer).
 */
@Injectable({
  providedIn: 'root'
})
export class ElectronPushService {
  private ngZone = inject(NgZone);

  /**
   * Subscribe to a push channel from the Electron main process.
   * Returns an Observable that emits whenever the main process sends data on this channel.
   * Automatically cleans up the listener when unsubscribed.
   *
   * @param channel Full channel name (e.g. 'push:update:status-changed')
   */
  on<T>(channel: string): Observable<T> {
    return new Observable<T>(subscriber => {
      const handler = (...args: unknown[]) => {
        // args[0] is the IPC event, args[1] is the data
        const data = args[1] as T;
        // Run inside Angular zone to trigger change detection
        this.ngZone.run(() => subscriber.next(data));
      };

      window.electronAPI.on(channel, handler);

      return () => {
        window.electronAPI.off(channel, handler);
      };
    }).pipe(map(e => {
      console.info('%c🎯 Push Event%c received from backend', 'color: #f39121; font-weight: bold', 'color: inherit', channel, e);
      return e;
    }));
  }
}
