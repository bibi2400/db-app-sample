import { BrowserWindow } from 'electron';
import { getPushChannelPrefix, getPushEventMetadata } from '../decorators/push-channel.decorator';
import { Injectable } from '../helpers/mini-pie/decorators';
import { Logger } from '../helpers/logger';
import { PushEmitter } from '../helpers/push/push-emitter';

/**
 * Injectable service that manages push events from Electron main process to renderer.
 * Holds a reference to the BrowserWindow and sends events via webContents.send().
 *
 * All push channels are prefixed with `push:` for security (preload filters on this).
 */
@Injectable()
export class PushService {
  private win: BrowserWindow | null = null;

  constructor() {

  }

  setWindow(win: BrowserWindow): void {
    this.win = win;
  }

  send<T>(channel: string, data: T): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send(channel, data);
    }
  }

  /**
   * Reads @PushChannel and @PushEvent metadata from the instance
   * and initializes all PushEmitter properties with their full channel names.
   */
  initializeChannel(instance: object): void {
    const proto = Object.getPrototypeOf(instance);
    const constructor = proto.constructor;
    const prefix = getPushChannelPrefix(constructor);

    if (!prefix) {
      Logger.warn('PushService.initializeChannel called on a class without @PushChannel decorator');
      return;
    }

    const events = getPushEventMetadata(proto);
    for (const { propertyKey, eventName } of events) {
      const emitter = (instance as Record<string, unknown>)[propertyKey];
      if (emitter instanceof PushEmitter) {
        const fullChannel = `push:${prefix}:${eventName}`;
        emitter._initialize((data: unknown) => this.send(fullChannel, data));
        Logger.info(`[Push] Registered channel: ${fullChannel}`);
      }
    }
  }
}
