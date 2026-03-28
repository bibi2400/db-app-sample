import { ipcMain } from 'electron';
import { Injectable } from '../../helpers/mini-pie/decorators';
import { Injector } from '../../helpers/mini-pie/injector';
import { Constructor } from '../../helpers/mini-pie/types';
import { Logger } from '../../helpers/logger';
import { getControllerMetadata, getRegisteredControllers, isController } from '../../decorators/controller.decorator';
import { getIpcHandlerMetadata } from '../../decorators/ipc-handler.decorator';
import { ErrorNotificationService } from './error-notification.service';

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

type Handler = (...args: unknown[]) => Promise<IpcResponse>;

interface RegisteredChannel {
  fullChannel: string;
  prefix: string;
  channel: string;
  methodName: string;
  controllerName: string;
}

@Injectable()
export class ControllerService {
  private controllerInstances: Map<string, object> = new Map();
  private registeredChannels: RegisteredChannel[] = [];

  constructor(private readonly errorNotificationService: ErrorNotificationService) {}

  /**
   * Registers all controllers that have been decorated with @Controller.
   * Controllers are instantiated with automatic dependency injection.
   */
  registerAllControllers(): void {
    const controllers = getRegisteredControllers();

    for (const controller of controllers) {
      this.registerController(controller);
    }

    Logger.info(`[ControllerService] ${controllers.length} controller(s) registered`);
    Logger.info(`[ControllerService] ${this.registeredChannels.length} IPC channel(s) registered`);
  }

  /**
   * Registers a single controller class.
   * The controller is instantiated with automatic DI using the Injector.
   */
  registerController(controllerClass: Constructor): void {
    if (!isController(controllerClass)) {
      throw new Error(`Class ${controllerClass.name} is not decorated with @Controller`);
    }

    const metadata = getControllerMetadata(controllerClass);
    if (!metadata) {
      throw new Error(`No metadata found for controller ${controllerClass.name}`);
    }

    // Instantiate with automatic DI
    const instance = Injector.getInstanceWithDependencies(controllerClass);
    this.controllerInstances.set(controllerClass.name, instance);

    // Register IPC handlers
    this.registerIpcHandlers(instance, metadata.channelPrefix);

    Logger.info(`[ControllerService] Registered controller: ${controllerClass.name} (prefix: ${metadata.channelPrefix})`);
  }

  /**
   * Registers all IPC handlers for a controller instance.
   */
  private registerIpcHandlers(instance: object, channelPrefix: string): void {
    const handlerMetadata = getIpcHandlerMetadata(Object.getPrototypeOf(instance));

    for (const { channel, methodName } of handlerMetadata) {
      const fullChannel = channelPrefix ? `${channelPrefix}:${channel}` : channel;

      Logger.debug(`[ControllerService] Registering IPC handler: ${fullChannel} -> ${methodName}`);

      const handler = (instance as Record<string, Handler>)[methodName].bind(instance);

      ipcMain.handle(fullChannel, async (_event, ...args) => {
        try {
          return await handler(...args);
        } catch (error) {
          this.errorNotificationService.reportControllerError(fullChannel, error);
          return ControllerService.error(error);
        }
      });

      this.registeredChannels.push({
        fullChannel,
        prefix: channelPrefix,
        channel,
        methodName,
        controllerName: instance.constructor.name,
      });
    }
  }

  /**
   * Returns all registered IPC channels.
   * This can be used by the preloader to dynamically expose the API.
   */
  getRegisteredChannels(): RegisteredChannel[] {
    return [...this.registeredChannels];
  }

  /**
   * Returns channels grouped by prefix for easier API construction.
   */
  getChannelsByPrefix(): Record<string, string[]> {
    const grouped: Record<string, string[]> = {};

    for (const { prefix, channel } of this.registeredChannels) {
      if (!grouped[prefix]) {
        grouped[prefix] = [];
      }
      grouped[prefix].push(channel);
    }

    return grouped;
  }

  /**
   * Returns a controller instance by class name.
   */
  getController<T>(controllerName: string): T | undefined {
    return this.controllerInstances.get(controllerName) as T | undefined;
  }

  // Helper methods for controller responses
  static success<T>(data: T): IpcResponse<T> {
    return { success: true, data };
  }

  static error(error: string | Error | unknown): IpcResponse {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
