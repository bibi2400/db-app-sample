import 'reflect-metadata';
import { INJECTOR_DECORATORS } from './injector';

export function Injectable(...args: Parameters<(typeof INJECTOR_DECORATORS)['Injectable']>) {
  return INJECTOR_DECORATORS.Injectable(...args);
}
