import { Logger } from '../logger';
import 'reflect-metadata';
import { Any, Constructor } from './types';

const INJECTABLE_ID = Symbol.for('Q29mZmVlIHBsZWFzZSE=');
const BOOSTRAP_METHOD_ID = Symbol.for('QmFyZCBiZXN0IGNsYXNz');

type BootstrapMethod = () => Any | void | Promise<Any> | Promise<void>;

export type InjectableConstructor = Constructor & {
  [x: string | symbol | number]: Any;
  _hasBootstrap?: boolean;
};

export class Injector {
  static readonly injectables: InstanceType<InjectableConstructor>[] = [];
  static readonly loaded: InjectableConstructor[] = [];
  static readonly injectablePromises: {
    name: string;
    value: Promise<InstanceType<InjectableConstructor>>;
  }[] = [];

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

  static isConstructorLoaded(constructorName: string) {
    return Injector.loaded.find(element => element.name === constructorName);
  }

  static isInjectableConstructor(constructor: Constructor): constructor is InjectableConstructor {
    return (
      typeof (<InjectableConstructor>constructor)[INJECTABLE_ID] === 'string' &&
      typeof parseInt((<InjectableConstructor>constructor)[INJECTABLE_ID]) === 'number'
    );
  }

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
        let dependecy = Injector.getLoadedInjectable(name) as (typeof args)[number];

        if (!dependecy) {
          Logger.debug('Dependency', name, 'not loaded, resolving recursively');
          if (!Injector.isInjectableConstructor(injector.class)) {
            throw new Error(
              `Cant find dependency ${name} for ${constructor.name}, ` +
              'and it is not an Injectable class'
            );
          }
          dependecy = Injector.inject(injector.class as InjectableConstructor);
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

  static async load(injectables: Constructor[]) {
    Logger.addTag('Injector').addTag('load');

    for (const injectable of injectables) {
      if (!Injector.isInjectableConstructor(injectable)) {
        throw new Error(`Cant load class ${injectable.name}, must decorate with @Injectable`);
      }
    }

    const loadList = await buildLoadList(injectables as InjectableConstructor[]);

    for (const injectable of loadList) {
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

  static getLoadedInjectable(name: string): InstanceType<InjectableConstructor> {
    return Injector.injectables.find(injectable => injectable.constructor.name === name);
  }
}

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
        if (!loaded) {
          list.push(injectable);
          injectables.splice(parseInt(i), 1);
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

const extractConstructorDependeciesMetadata = (injectable: Constructor) => {
  const classes = Reflect.getMetadata('design:paramtypes', injectable);
  const dependencies: { class: Constructor; index: number; }[] = [];
  for (const i in classes) {
    const constructor = classes[parseInt(i)];
    dependencies.push({ class: constructor, index: parseInt(i) });
  }
  return dependencies;
};

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
  Injectable(
    options: {
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

const id = () =>
  Math.floor(Math.random() * 999_999_999)
    .toString()
    .padStart(9, '0');
