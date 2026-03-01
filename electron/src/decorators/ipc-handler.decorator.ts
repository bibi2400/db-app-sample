const IPC_HANDLERS_METADATA_KEY = Symbol('ipc:handlers');

export interface IpcHandlerMetadata {
  channel: string;
  methodName: string;
}

export function IpcHandler(channel: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    const handlers: IpcHandlerMetadata[] = Reflect.getMetadata(IPC_HANDLERS_METADATA_KEY, target) ?? [];
    handlers.push({ channel, methodName: propertyKey.toString() });
    Reflect.defineMetadata(IPC_HANDLERS_METADATA_KEY, handlers, target);
  };
}

export function getIpcHandlerMetadata(target: object): IpcHandlerMetadata[] {
  return Reflect.getMetadata(IPC_HANDLERS_METADATA_KEY, target) ?? [];
}