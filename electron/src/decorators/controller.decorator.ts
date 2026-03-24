import 'reflect-metadata';
import { Constructor } from '../helpers/mini-pie/types';

const CONTROLLER_METADATA_KEY = Symbol('controller:metadata');
const CONTROLLER_REGISTRY_KEY = Symbol.for('controller:registry');

export interface ControllerMetadata {
  channelPrefix: string;
}

export interface ControllerOptions {
  prefix: string;
}

// Global registry for controller classes
const controllerRegistry: Constructor[] = [];

/**
 * Decorator that marks a class as a Controller.
 * It stores the channel prefix metadata and registers the controller in the global registry.
 */
export function Controller(options: ControllerOptions): ClassDecorator {
  return (target: Function) => {
    const metadata: ControllerMetadata = {
      channelPrefix: options.prefix,
    };
    Reflect.defineMetadata(CONTROLLER_METADATA_KEY, metadata, target);
    controllerRegistry.push(target as Constructor);
  };
}

/**
 * Retrieves the controller metadata from a controller class.
 */
export function getControllerMetadata(target: Constructor): ControllerMetadata | undefined {
  return Reflect.getMetadata(CONTROLLER_METADATA_KEY, target);
}

/**
 * Returns all registered controller classes.
 */
export function getRegisteredControllers(): Constructor[] {
  return [...controllerRegistry];
}

/**
 * Checks if a class is a controller (decorated with @Controller).
 */
export function isController(target: Constructor): boolean {
  return Reflect.hasMetadata(CONTROLLER_METADATA_KEY, target);
}
