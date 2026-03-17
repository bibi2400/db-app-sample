import 'reflect-metadata';
import { INJECTOR_DECORATORS } from './injector.js';

/**
 * @see {@link INJECTOR_DECORATORS.Injectable | INJECTOR_DECORATORS.Injectable}
 */
export function Injectable(...args: Parameters<(typeof INJECTOR_DECORATORS)['Injectable']>) {
  return INJECTOR_DECORATORS.Injectable(...args);
}

export function HasDependency() {
  return (target: any) => {};
}

// // TEST: It wraps class with an anonymus class breaking this.constructor
// // It's ok with classes that wont make use of reflect-metadata like Tasks
// export function AutoDependency() {
//   return function <T extends { new (...args: any[]): {} }>(constr: T) {
//     return class extends constr {
//       parentConstructor = constr;
//       static parentName = constr.name;

//       constructor(...args: any[]) {
//         super(...Injector.getDependencies(constr));
//       }
//     };
//   };
// }
