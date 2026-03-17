import { Logger } from '../logger.js';
import 'reflect-metadata';
import { Any, Constructor } from './types.js';

/**
 * Use this Symbol to mark the class and recognize it as an Injectable class
 */
const INJECTABLE_ID = Symbol.for('Q29mZmVlIHBsZWFzZSE=');
/**
 * Use this Symbol to create the boostrap method property in Injectable class
 */
const BOOSTRAP_METHOD_ID = Symbol.for('QmFyZCBiZXN0IGNsYXNz');

/**
 * The bootstrap method type on `@Injectable` decorator in `bootstrap` param
 */
type BootstrapMethod = () => Any | void | Promise<Any> | Promise<void>;

/**
 * Defines an Injectable class with it's properties
 */
export type InjectableConstructor = Constructor & {
  [x: string | symbol | number]: Any;
  _hasBootstrap?: boolean;
};

export class Injector {
  /**
   * It contains all injectable classes instance
   */
  static readonly injectables: InstanceType<InjectableConstructor>[] = [];
  /**
   * It contains an array of classes loaded via the
   * {@link Injector.load | Injector.load} method and instancieted
   * into the {@link Injector.injectables | Injector.injectables} class parameter
   */
  static readonly loaded: InjectableConstructor[] = [];
  /**
   * Generated during the load phase, it is the array containing
   * the promises which (each of them) will returns the elements contained into
   * {@link Injector.loaded | Injector.loaded}
   *
   */
  static readonly injectablePromises: {
    name: string;
    value: Promise<InstanceType<InjectableConstructor>>;
  }[] = [];

  /**
   * It inject (returns) an instance of the passed `constructor`
   * if it has been loaded via {@link Injector.load | Injector.load}
   * and decorated with `@Injectable`
   *
   * @param constructor the class to return instancieted
   * @return an instance of constructor
   */
  static inject<T extends InjectableConstructor>(constructor: T): InstanceType<T> {
    Logger.addTag('Injector').addTag('inject');

    let result = this.getLoadedInjectable(constructor.name);

    if (!result) {
      Logger.debug('Cant find', constructor.name, ' - do instance');

      const controllerArgs = this.getDependencies(constructor);

      result = new constructor(...controllerArgs) as InstanceType<InjectableConstructor>;

      if (!this.isConstructorLoaded(result.constructor.name)) {
        Injector.loaded.push(result);
      }
    } else {
      Logger.debug('Found', result?.constructor.name);
    }

    Logger.removeTag('Injector');
    Logger.removeTag('inject');

    return result;
  }

  /**
   * It checks if a class has been loaded as an injectable class
   *
   * @param constructorName the name of a given constructor class
   */
  static isConstructorLoaded(constructorName: string) {
    return Injector.loaded.find(element => element.name === constructorName);
  }

  /**
   * It returns if the given `constructor` is an injectable class.
   * To be considered as an Injectable class, the class must be
   * decorated with the `@Injectable` decorator
   *
   * @param constructor
   * @returns `true` if it is an Injectable class, `false` otherwise
   */
  static isInjectableConstructor(constructor: Constructor): constructor is InjectableConstructor {
    return (
      typeof (<InjectableConstructor>constructor)[INJECTABLE_ID] === 'string' &&
      typeof parseInt((<InjectableConstructor>constructor)[INJECTABLE_ID]) === 'number'
    );
  }

  /**
   * Retrieves a class constructor dependencies.
   * It can only retrieve instances that have been loaded
   * with {@link Injector.load | Injector.load} and that have been
    decorate with `@Injectable`
   *
   * @param constructor
   */
  static getDependencies(constructor: InjectableConstructor) {
    Logger.addTag('Injector').addTag('getDependencies');

    const args: InjectableConstructor[] = [];

    Logger.debug('getDependencies for', constructor.name);

    const dependencies = extractConstructorDependeciesMetadata(constructor);

    Logger.debug(
      'Dependencies are represented by',
      dependencies?.map(dep => `(${dep.index})${dep.class.name}`).join(', ') || 'NONE'
    );

    if (dependencies?.length) {
      for (const injector of dependencies) {
        const name = injector.class.name;

        Logger.debug('Follow dependecy for', name);

        const dependecy = Injector.getLoadedInjectable(name) as (typeof args)[number];

        if (!dependecy) {
          throw new Error(`Cant find dependency ${name} for ${constructor.name}, ` + 'Did you load it?');
        }

        args.push(dependecy);
      }
    }

    Logger.debug('Final args are', args.map(arg => arg?.constructor.name || arg).join(', '));

    Logger.removeTag('Injector');
    Logger.removeTag('getDependencies');

    return args;
  }

  static getInstanceWithDependencies(constructor: InjectableConstructor) {
    return new constructor(...this.getDependencies(constructor));
  }

  /**
   * It's used to load a pull of classes that will become injectable.
   * The method only accepts classes that have been decorated with `@Injectable`.
   * If a non decorated class is provided, the method will raise an Error
   */
  static async load(injectables: Constructor[]) {
    Logger.addTag('Injector').addTag('load');

    for (const injectable of injectables) {
      if (!Injector.isInjectableConstructor(injectable)) {
        throw new Error(`Cant load class ${injectable.name}, must decorate with @Injectable`);
      }
    }

    const loadList = await buildLoadList(injectables as InjectableConstructor[]);

    for (const injectable of loadList) {
      // Skip items that are not constructors (e.g. instances added by inject() before load())
      if (typeof injectable !== 'function') continue;

      if (!Injector.injectables.find(el => el.constructor.name === injectable.name)) {
        Logger.debug('Loading', injectable.name);

        await load(injectable);
      } else {
        Logger.debug('Skip Loading', injectable.name);
      }
    }

    Logger.removeTag('Injector');
    Logger.removeTag('load');
  }

  /**
   * Find a specific injectable class instance by name into the
   * {@link Injector.injectables | injectables} and returns it
   *
   * @param name the name of loaded injectable class
   * @returns an instance of injectable
   */
  static getLoadedInjectable(name: string): InstanceType<InjectableConstructor> {
    return Injector.injectables.find(injectable => injectable.constructor.name === name);
  }
}

/**
 * Given the array of injectable classes, it sorts them in such a way
 * that the class in position n always represents a dependency of
 * class n + 1 and never vice versa.
 *
 * If a circular dependency injections occur
 * the function should throws an Error
 */
const buildLoadList = async (injectables: InjectableConstructor[]) => {
  const injectablesLength = injectables.length;
  const list = Injector.loaded;

  const initListLength = list.length;

  const now = Date.now();
  const MAX_EXECUTION_TIME = 1_000;

  while (injectables?.length > 0 && Date.now() - now < MAX_EXECUTION_TIME) {
    for (const i in injectables) {
      const injectable = injectables[i];

      const dependencies = extractConstructorDependeciesMetadata(injectable);

      const loaded = !!list.find(element => element.name === injectable.name);

      if (!dependencies?.length) {
        Logger.debug('No dependencies for', injectable.name, 'loaded is', loaded);

        if (!loaded) {
          Logger.debug('Then load', injectable.name);

          list.push(injectable);

          injectables.splice(parseInt(i), 1);
        } else {
          Logger.debug('Then dont load', injectable.name);
        }
      } else {
        let insert = true;

        for (const dependecy of dependencies) {
          const inList = list.find(element => element.name === dependecy.class.name);

          if (!inList) {
            insert = false;
          }
        }

        if (insert && !loaded) {
          list.push(injectable);

          injectables.splice(parseInt(i), 1);
        }
      }
    }
  }

  if (injectablesLength !== list.length - initListLength) {
    throw new Error("Probabily there's a circulary dependency injection");
  }

  return list;
};

/**
 * Given a class, extracts all parameters required into the constructor
 * and returns an Arry of objects which report the requested class
 * as information and the position index in the constructor where it is requested
 */
const extractConstructorDependeciesMetadata = (injectable: Constructor) => {
  const classes = Reflect.getMetadata('design:paramtypes', injectable);

  const dependencies: {
    class: Constructor;
    index: number;
  }[] = [];

  for (const i in classes) {
    const constructor = classes[parseInt(i)];

    dependencies.push({
      class: constructor,
      index: parseInt(i),
    });
  }

  return dependencies;
};

/**
 * Given an injectable class, it instanciete it
 *
 * @param injectable the injectable class
 * @returns a Promise of the injectable class instance
 */
const load = async (injectable: InjectableConstructor) => {
  const { injectables } = Injector;

  Injector.injectablePromises.unshift({
    name: injectable.name,
    value: new Promise(async (resolve, reject) => {
      const args = Injector.getDependencies(injectable);
      const instance = new injectable(...args);

      if (injectable._hasBootstrap) {
        try {
          await injectable[BOOSTRAP_METHOD_ID].call(instance);
        } catch (err) {
          return reject(err);
        }
      }

      injectables.unshift(instance);

      resolve(instance);
    }),
  });

  return await Injector.injectablePromises[0].value;
};

export const INJECTOR_DECORATORS = {
  /**
   * Used as a decorator, Injectable sets a class as Injectable.
   * In this way it will be possible to directly inject an instance of
   * that class into a `Router` class constructor, into a `Policy` constructor
   * or by requesting it directly by using `Injector.inject(YourClass)`
   *
   * @param options
   * @returns
   */
  Injectable(
    options: {
      /**
       * Define a method which will be executed during the load
       * of the class as an injectable.
       * Until this method is not executed, the injectable class is not
       * available
       */
      bootstrap?: BootstrapMethod;
    } = {}
  ) {
    return function (constructor: InjectableConstructor) {
      constructor[INJECTABLE_ID] = id();
      constructor[BOOSTRAP_METHOD_ID] = options?.bootstrap;

      constructor._hasBootstrap = !!constructor[BOOSTRAP_METHOD_ID];
    };
  },
};

/**
 * Generate a random number
 *
 * @returns a number between 0 and 999.999.999
 */
const id = () =>
  Math.floor(Math.random() * 999_999_999)
    .toString()
    .padStart(9, '0');
