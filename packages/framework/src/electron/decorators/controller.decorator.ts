import 'reflect-metadata';
import { Constructor } from '../helpers/mini-pie/types';

const CONTROLLER_METADATA_KEY = Symbol('controller:metadata');

export interface ControllerMetadata {
  channelPrefix: string;
}

export interface ControllerOptions {
  prefix: string;
}

const controllerRegistry: Constructor[] = [];

export function Controller(options: ControllerOptions): ClassDecorator {
  return (target: Function) => {
    const metadata: ControllerMetadata = {
      channelPrefix: options.prefix,
    };
    Reflect.defineMetadata(CONTROLLER_METADATA_KEY, metadata, target);
    controllerRegistry.push(target as Constructor);
  };
}

export function getControllerMetadata(target: Constructor): ControllerMetadata | undefined {
  return Reflect.getMetadata(CONTROLLER_METADATA_KEY, target);
}

export function getRegisteredControllers(): Constructor[] {
  return [...controllerRegistry];
}

export function isController(target: Constructor): boolean {
  return Reflect.hasMetadata(CONTROLLER_METADATA_KEY, target);
}
