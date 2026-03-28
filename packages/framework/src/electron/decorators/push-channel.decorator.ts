import 'reflect-metadata';

const PUSH_CHANNEL_KEY = Symbol('push:channel');
const PUSH_EVENT_KEY = Symbol('push:events');

export interface PushEventMetadata {
  propertyKey: string;
  eventName: string;
}

export function PushChannel(prefix: string): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(PUSH_CHANNEL_KEY, prefix, target);
  };
}

export function PushEvent(eventName: string): PropertyDecorator {
  return (target, propertyKey) => {
    const events: PushEventMetadata[] = Reflect.getMetadata(PUSH_EVENT_KEY, target) ?? [];
    events.push({ propertyKey: propertyKey.toString(), eventName });
    Reflect.defineMetadata(PUSH_EVENT_KEY, events, target);
  };
}

export function getPushChannelPrefix(target: object): string | undefined {
  return Reflect.getMetadata(PUSH_CHANNEL_KEY, target);
}

export function getPushEventMetadata(target: object): PushEventMetadata[] {
  return Reflect.getMetadata(PUSH_EVENT_KEY, target) ?? [];
}
